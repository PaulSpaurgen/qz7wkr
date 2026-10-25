"""Day-ahead forecast selection: which forecast was available when the purchase decision was made."""

from __future__ import annotations

from dataclasses import dataclass
from datetime import date, datetime, time, timedelta
from zoneinfo import ZoneInfo

from backend.app.config import UK_TZ
from backend.app.store import Dataset, ForecastRun

UK = ZoneInfo(UK_TZ)
UTC = ZoneInfo("UTC")
HALF_HOUR = timedelta(minutes=30)


def gate_closure_utc(decision_date: date, gate_time: time) -> datetime:
    """The decision cut-off on `decision_date` (UK local wall-clock time) as a UTC datetime."""
    return datetime.combine(decision_date, gate_time, tzinfo=UK).astimezone(UTC)


def delivery_slots(delivery_date: date) -> list[datetime]:
    """UTC start times of the half-hourly settlement periods of a UK delivery day (46/48/50 periods)."""
    start = datetime.combine(delivery_date, time(0), tzinfo=UK).astimezone(UTC)
    end = datetime.combine(delivery_date + timedelta(days=1), time(0), tzinfo=UK).astimezone(UTC)
    slots, t = [], start
    while t < end:
        slots.append(t)
        t += HALF_HOUR
    return slots


def uk_hour(t: datetime) -> int:
    return t.astimezone(UK).hour


@dataclass(frozen=True)
class SlotError:
    """One half-hour of a day-ahead decision: what was forecast vs what happened."""

    decision_date: date
    time: datetime
    forecast: float
    actual: float
    lead_hours: float  # target time minus forecast publish time

    @property
    def error(self) -> float:
        """actual - forecast. Negative = less wind than forecast (shortfall to cover)."""
        return self.actual - self.forecast


@dataclass(frozen=True)
class DayAheadForecast:
    decision_date: date
    delivery_date: date
    cutoff: datetime
    run: ForecastRun | None
    slots: list[datetime]
    forecast: list[float | None]  # aligned with slots


def day_ahead_forecast(ds: Dataset, decision_date: date, gate_time: time) -> DayAheadForecast:
    """The latest forecast published before gate closure on `decision_date`, for the next UK day."""
    cutoff = gate_closure_utc(decision_date, gate_time)
    delivery = decision_date + timedelta(days=1)
    slots = delivery_slots(delivery)
    run = ds.latest_run_before(cutoff)
    values = [run.value_at(t) if run else None for t in slots]
    return DayAheadForecast(decision_date, delivery, cutoff, run, slots, values)


def day_ahead_errors(ds: Dataset, decision_dates: list[date], gate_time: time) -> list[SlotError]:
    """Forecast-vs-actual pairs for every half-hour where both the day-ahead forecast and actual exist."""
    out: list[SlotError] = []
    for d in decision_dates:
        fc = day_ahead_forecast(ds, d, gate_time)
        if fc.run is None:
            continue
        for t, f in zip(fc.slots, fc.forecast, strict=True):
            a = ds.actuals.get(t)
            if f is None or a is None:
                continue
            lead = (t - fc.run.publish_time).total_seconds() / 3600
            out.append(SlotError(d, t, f, a, lead))
    return out


def date_range(start: date, end: date) -> list[date]:
    return [start + timedelta(days=i) for i in range((end - start).days + 1)]


def horizon_errors(
    ds: Dataset, target_start: datetime, target_end: datetime, max_lead_hours: float = 72
) -> list[tuple[float, float, float]]:
    """(lead_hours, forecast, actual) for every forecast point of every run targeting [start, end).

    Uses the hourly forecast points directly (no interpolation), matched with the half-hour
    actual starting at the same time. Points targeting times before their publish time are skipped.
    """
    out: list[tuple[float, float, float]] = []
    for run in ds.runs_between(target_start - timedelta(hours=max_lead_hours), target_end):
        for t, f in run.points.items():
            if not (target_start <= t < target_end):
                continue
            lead = (t - run.publish_time).total_seconds() / 3600
            a = ds.actuals.get(t)
            if a is None or lead < 0 or lead > max_lead_hours:
                continue
            out.append((lead, f, a))
    return out
