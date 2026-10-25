"""FastAPI application: HTTP layer only. All analysis lives in `analysis.py`."""

from __future__ import annotations

from datetime import date, time
from typing import Annotated

from fastapi import FastAPI, HTTPException, Query, Response
from fastapi.middleware.cors import CORSMiddleware
from fastapi.middleware.gzip import GZipMiddleware

from backend.app import analysis
from backend.app.config import (
    DECISION_END,
    DECISION_START,
    DEFAULT_CONFIDENCE,
    DEFAULT_GATE_CLOSURE,
    DEFAULT_LOOKBACK_DAYS,
    GATE_CLOSURES,
)
from backend.app.store import fmt_ts, get_dataset

app = FastAPI(
    title="WindSight API",
    description="Day-ahead wind forecast decision support for GB (Elexon FUELHH + WINDFOR).",
    version="1.0.0",
    docs_url="/api/docs",
    openapi_url="/api/openapi.json",
)
app.add_middleware(GZipMiddleware, minimum_size=1000)
app.add_middleware(CORSMiddleware, allow_origins=["*"], allow_methods=["GET"], allow_headers=["*"])

GateParam = Annotated[str, Query(pattern=r"^([01]\d|2[0-3]):[0-5]\d$", description="UK local time HH:MM")]
ConfidenceParam = Annotated[float, Query(ge=0.5, le=0.99)]
LookbackParam = Annotated[int, Query(ge=3, le=60)]
DEFAULT_GATE = DEFAULT_GATE_CLOSURE.strftime("%H:%M")
CACHE_HEADER = {"Cache-Control": "public, max-age=300, s-maxage=86400"}


def _gate(value: str) -> time:
    return time.fromisoformat(value)


def _check_decision_date(d: date) -> None:
    if not DECISION_START <= d <= DECISION_END:
        raise HTTPException(422, f"decision_date must be between {DECISION_START} and {DECISION_END}")


@app.get("/api/health")
def health() -> dict:
    return {"status": "ok"}


@app.get("/api/meta")
def meta(response: Response) -> dict:
    ds = get_dataset()
    response.headers.update(CACHE_HEADER)
    return {
        "decision_start": DECISION_START.isoformat(),
        "decision_end": DECISION_END.isoformat(),
        "default_gate_closure": DEFAULT_GATE,
        "gate_closures": {k: v.strftime("%H:%M") for k, v in GATE_CLOSURES.items()},
        "default_confidence": DEFAULT_CONFIDENCE,
        "default_lookback_days": DEFAULT_LOOKBACK_DAYS,
        "data": {
            "fetched_at": ds.fetched_at,
            "actuals_from": fmt_ts(next(iter(ds.actuals))),
            "actuals_to": fmt_ts(next(reversed(ds.actuals))),
            "forecast_runs": len(ds.runs),
            "publish_times_utc": sorted({r.publish_time.strftime("%H:%M") for r in ds.runs}),
        },
    }


@app.get("/api/day-ahead")
def day_ahead(
    response: Response,
    decision_date: date,
    gate_closure: GateParam = DEFAULT_GATE,
    confidence: ConfidenceParam = DEFAULT_CONFIDENCE,
    lookback_days: LookbackParam = DEFAULT_LOOKBACK_DAYS,
    demand_mw: Annotated[float | None, Query(ge=0, le=100_000)] = None,
) -> dict:
    _check_decision_date(decision_date)
    response.headers.update(CACHE_HEADER)
    return analysis.day_ahead_view(decision_date, _gate(gate_closure), confidence, lookback_days, demand_mw)


@app.get("/api/vintages")
def vintages(
    response: Response,
    delivery_date: date,
    gate_closure: GateParam = DEFAULT_GATE,
) -> dict:
    _check_decision_date(date.fromordinal(delivery_date.toordinal() - 1))
    response.headers.update(CACHE_HEADER)
    return analysis.vintages_view(delivery_date, _gate(gate_closure))


@app.get("/api/accuracy")
def accuracy(
    response: Response,
    gate_closure: GateParam = DEFAULT_GATE,
    confidence: ConfidenceParam = DEFAULT_CONFIDENCE,
    lookback_days: LookbackParam = DEFAULT_LOOKBACK_DAYS,
    start: date = DECISION_START,
    end: date = DECISION_END,
) -> dict:
    _check_decision_date(start)
    _check_decision_date(end)
    if start > end:
        raise HTTPException(422, "start must not be after end")
    response.headers.update(CACHE_HEADER)
    return analysis.accuracy_view(_gate(gate_closure), confidence, lookback_days, start, end)


@app.get("/api/accuracy/horizon")
def accuracy_horizon(response: Response) -> dict:
    response.headers.update(CACHE_HEADER)
    return analysis.horizon_view()
