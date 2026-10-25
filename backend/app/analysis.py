"""Use-case layer: builds the views the API serves from the dataset, selection and metrics modules."""

from __future__ import annotations

from datetime import date, datetime, time, timedelta
from functools import lru_cache

from backend.app import metrics
from backend.app.config import DECISION_END, DECISION_START, SNAPSHOT
from backend.app.forecast import (
    SlotError,
    date_range,
    day_ahead_errors,
    day_ahead_forecast,
    delivery_slots,
    gate_closure_utc,
    horizon_errors,
    uk_hour,
)
from backend.app.store import Dataset, fmt_ts, get_dataset

MWH_PER_SLOT = 0.5  # MW averaged over a half-hour -> MWh
HISTOGRAM_BIN_MW = 500
HORIZON_BUCKET_HOURS = 6


def _history_start() -> date:
    # Earliest decision date whose day-ahead forecast and actuals are both in the snapshot.
    return date.fromisoformat(SNAPSHOT["actuals"][0])


@lru_cache(maxsize=32)
def all_day_ahead_errors(gate_time: time) -> tuple[SlotError, ...]:
    """Day-ahead errors for every decision date in the snapshot (history + January), cached per gate time."""
    ds = get_dataset()
    return tuple(day_ahead_errors(ds, date_range(_history_start(), DECISION_END), gate_time))


def trailing_quantiles(errors: tuple[SlotError, ...], cutoff: datetime, lookback_days: int, confidence: float) -> dict:
    """Error quantiles from half-hours that had *already happened* before `cutoff` (no look-ahead)."""
    start = cutoff - timedelta(days=lookback_days)
    sample = [e.error for e in errors if start <= e.time < cutoff]
    if len(sample) < 48:
        return {"n_samples": len(sample), "q_low": None, "q_mid": None, "q_high": None}
    return {
        "n_samples": len(sample),
        "q_low": metrics.quantile(sample, 1 - confidence),
        "q_mid": metrics.quantile(sample, 0.5),
        "q_high": metrics.quantile(sample, confidence),
    }


def _mwh(values: list[float]) -> float:
    return sum(values) * MWH_PER_SLOT


def day_ahead_view(
    decision_date: date,
    gate_time: time,
    confidence: float,
    lookback_days: int,
    demand_mw: float | None = None,
    ds: Dataset | None = None,
) -> dict:
    ds = ds or get_dataset()
    fc = day_ahead_forecast(ds, decision_date, gate_time)
    q = trailing_quantiles(all_day_ahead_errors(gate_time), fc.cutoff, lookback_days, confidence)

    series = []
    for t, f in zip(fc.slots, fc.forecast, strict=True):
        low = expected = high = firm = None
        if f is not None and q["q_low"] is not None:
            low = max(f + q["q_low"], 0.0)
            expected = max(f + q["q_mid"], 0.0)
            high = max(f + q["q_high"], 0.0)
            firm = low
        series.append(
            {
                "time": fmt_ts(t),
                "forecast": f,
                "expected": expected,
                "low": low,
                "high": high,
                "firm": firm,
                "actual": ds.actuals.get(t),
            }
        )

    fvals = [s["forecast"] for s in series if s["forecast"] is not None]
    expected_vals = [s["expected"] for s in series if s["expected"] is not None]
    firm_vals = [s["firm"] for s in series if s["firm"] is not None]
    pairs = [(s["forecast"], s["actual"]) for s in series if s["forecast"] is not None and s["actual"] is not None]

    kpis: dict = {
        "slots": len(fc.slots),
        "forecast_slots": len(fvals),
        "forecast_mwh": _mwh(fvals) if fvals else None,
        "expected_mwh": _mwh(expected_vals) if expected_vals else None,
        "firm_mwh": _mwh(firm_vals) if firm_vals else None,
        "mean_mw": sum(fvals) / len(fvals) if fvals else None,
        "peak_mw": max(fvals) if fvals else None,
        "min_mw": min(fvals) if fvals else None,
    }
    hindsight = None
    if pairs:
        f_, a_ = zip(*pairs, strict=True)
        breaches = sum(
            1 for s in series if s["firm"] is not None and s["actual"] is not None and s["actual"] < s["firm"]
        )
        hindsight = {
            "actual_mwh": _mwh(list(a_)),
            "error_mwh": _mwh(list(a_)) - _mwh(list(f_)),
            "mae": metrics.summarize(f_, a_)["mae"],
            "firm_breaches": breaches,
            "slots": len(pairs),
        }

    procurement = None
    if demand_mw is not None and fvals:
        need_fc = [max(demand_mw - s["forecast"], 0.0) for s in series if s["forecast"] is not None]
        need_firm = [max(demand_mw - s["firm"], 0.0) for s in series if s["firm"] is not None]
        procurement = {
            "demand_mw": demand_mw,
            "demand_mwh": demand_mw * len(fc.slots) * MWH_PER_SLOT,
            "need_vs_forecast_mwh": _mwh(need_fc),
            "need_vs_firm_mwh": _mwh(need_firm) if need_firm else None,
            "risk_buffer_mwh": (_mwh(need_firm) - _mwh(need_fc)) if need_firm else None,
        }

    run = fc.run
    return {
        "decision_date": decision_date.isoformat(),
        "delivery_date": fc.delivery_date.isoformat(),
        "gate_closure": fmt_ts(fc.cutoff),
        "forecast_run": None
        if run is None
        else {
            "publish_time": fmt_ts(run.publish_time),
            "age_minutes": (fc.cutoff - run.publish_time).total_seconds() / 60,
            "lead_hours_min": (fc.slots[0] - run.publish_time).total_seconds() / 3600,
            "lead_hours_max": (fc.slots[-1] - run.publish_time).total_seconds() / 3600,
        },
        "uncertainty": {"confidence": confidence, "lookback_days": lookback_days, **q},
        "series": series,
        "kpis": kpis,
        "hindsight": hindsight,
        "procurement": procurement,
    }


def vintages_view(delivery_date: date, gate_time: time, ds: Dataset | None = None) -> dict:
    """Every forecast run that covered `delivery_date`, flagged by whether it beat gate closure on D-1."""
    ds = ds or get_dataset()
    slots = delivery_slots(delivery_date)
    start, end = slots[0], slots[-1] + timedelta(minutes=30)
    cutoff = gate_closure_utc(delivery_date - timedelta(days=1), gate_time)
    runs = []
    for run in ds.runs_between(start - timedelta(days=3), end):
        pts = [[fmt_ts(t), run.points[t]] for t in run.times if start <= t < end]
        if len(pts) < 12:
            continue
        runs.append(
            {
                "publish_time": fmt_ts(run.publish_time),
                "before_gate": run.publish_time <= cutoff,
                "mean_mw": sum(p[1] for p in pts) / len(pts),
                "points": pts,
            }
        )
    latest = ds.latest_run_before(cutoff)
    return {
        "delivery_date": delivery_date.isoformat(),
        "gate_closure": fmt_ts(cutoff),
        "selected_publish_time": fmt_ts(latest.publish_time) if latest else None,
        "runs": runs,
        "actuals": [[fmt_ts(t), ds.actuals[t]] for t in slots if t in ds.actuals],
    }


def accuracy_view(
    gate_time: time,
    confidence: float,
    lookback_days: int,
    start: date = DECISION_START,
    end: date = DECISION_END,
) -> dict:
    hist = all_day_ahead_errors(gate_time)
    errs = [e for e in hist if start <= e.decision_date <= end]
    if not errs:
        return {"summary": {"n": 0}}
    f = [e.forecast for e in errs]
    a = [e.actual for e in errs]

    # Calibration: would the "firm wind" (lower quantile) have held, using only past errors each day?
    breaches = covered = 0
    adj_f: list[float] = []  # bias-adjusted forecast (forecast + trailing median error)
    adj_a: list[float] = []
    by_day = []
    for d, day_errs in metrics.group_by(errs, lambda e: e.decision_date).items():
        cutoff = gate_closure_utc(d, gate_time)
        q = trailing_quantiles(hist, cutoff, lookback_days, confidence)
        if q["q_low"] is not None:
            covered += len(day_errs)
            breaches += sum(1 for e in day_errs if e.error < q["q_low"])
            adj_f.extend(max(e.forecast + q["q_mid"], 0.0) for e in day_errs)
            adj_a.extend(e.actual for e in day_errs)
        df = [e.forecast for e in day_errs]
        da = [e.actual for e in day_errs]
        s = metrics.summarize(df, da)
        f_mwh, a_mwh = _mwh(df), _mwh(da)
        by_day.append(
            {
                "decision_date": d.isoformat(),
                "delivery_date": (d + timedelta(days=1)).isoformat(),
                "lead_hours_min": min(e.lead_hours for e in day_errs),
                "mae": s["mae"],
                "bias": s["bias"],
                "forecast_mwh": f_mwh,
                "actual_mwh": a_mwh,
                "energy_error_pct": 100 * (a_mwh - f_mwh) / f_mwh if f_mwh else None,
                "q_low": q["q_low"],
            }
        )

    by_hour = []
    for h, hour_errs in metrics.group_by(errs, lambda e: uk_hour(e.time)).items():
        s = metrics.summarize([e.forecast for e in hour_errs], [e.actual for e in hour_errs])
        by_hour.append({"hour": h, "mae": s["mae"], "bias": s["bias"], "p90_abs": s["p90_abs"]})

    return {
        "gate_closure_local": gate_time.strftime("%H:%M"),
        "decision_start": start.isoformat(),
        "decision_end": end.isoformat(),
        "summary": metrics.summarize(f, a),
        "bias_adjusted_summary": metrics.summarize(adj_f, adj_a),
        "calibration": {
            "confidence": confidence,
            "lookback_days": lookback_days,
            "expected_breach_rate": 1 - confidence,
            "breach_rate": breaches / covered if covered else None,
            "n": covered,
        },
        "by_day": by_day,
        "by_hour": by_hour,
        "histogram": metrics.histogram([e.error for e in errs], HISTOGRAM_BIN_MW),
        "timeseries": [{"time": fmt_ts(e.time), "forecast": e.forecast, "actual": e.actual} for e in errs],
        "lead_hours": {"min": min(e.lead_hours for e in errs), "max": max(e.lead_hours for e in errs)},
    }


def horizon_view(start: date = DECISION_START, end: date = DECISION_END, ds: Dataset | None = None) -> dict:
    """Accuracy of every forecast run vs lead time, over the delivery days of the decision window."""
    ds = ds or get_dataset()
    target_start = delivery_slots(start + timedelta(days=1))[0]
    target_end = delivery_slots(end + timedelta(days=2))[0]
    pts = horizon_errors(ds, target_start, target_end)
    buckets = []
    for b, items in metrics.group_by(pts, lambda p: int(p[0] // HORIZON_BUCKET_HOURS)).items():
        s = metrics.summarize([p[1] for p in items], [p[2] for p in items])
        buckets.append(
            {
                "lead_from": b * HORIZON_BUCKET_HOURS,
                "lead_to": (b + 1) * HORIZON_BUCKET_HOURS,
                "n": s["n"],
                "mae": s["mae"],
                "rmse": s["rmse"],
                "bias": s["bias"],
                "nmae_pct": s["nmae_pct"],
            }
        )
    return {"bucket_hours": HORIZON_BUCKET_HOURS, "buckets": buckets}
