"""Thin client for the Elexon BMRS Insights API (FUELHH + WINDFOR stream endpoints)."""

from __future__ import annotations

import time
from collections.abc import Iterator
from datetime import date, datetime, timedelta

import httpx

BASE_URL = "https://data.elexon.co.uk/bmrs/api/v1/datasets"
CHUNK_DAYS = 7


def _iso_z(dt: datetime) -> str:
    return dt.strftime("%Y-%m-%dT%H:%M:%SZ")


def _get(client: httpx.Client, url: str, params: dict, retries: int = 3) -> list[dict]:
    for attempt in range(retries):
        try:
            resp = client.get(url, params=params, timeout=60)
            resp.raise_for_status()
            return resp.json()
        except (httpx.HTTPError, ValueError):
            if attempt == retries - 1:
                raise
            time.sleep(2**attempt)
    return []  # unreachable


def _date_chunks(start: date, end: date) -> Iterator[tuple[date, date]]:
    """Split the inclusive range [start, end] into CHUNK_DAYS-sized inclusive ranges."""
    cur = start
    while cur <= end:
        chunk_end = min(cur + timedelta(days=CHUNK_DAYS - 1), end)
        yield cur, chunk_end
        cur = chunk_end + timedelta(days=1)


def fetch_wind_actuals(start: date, end: date, client: httpx.Client | None = None) -> dict[str, float]:
    """Half-hourly metered wind generation (MW) keyed by ISO startTime, settlement dates [start, end]."""
    own = client is None
    client = client or httpx.Client()
    out: dict[str, float] = {}
    try:
        for a, b in _date_chunks(start, end):
            rows = _get(
                client,
                f"{BASE_URL}/FUELHH/stream",
                {"settlementDateFrom": a.isoformat(), "settlementDateTo": b.isoformat(), "fuelType": "WIND"},
            )
            for r in rows:
                if r.get("fuelType") == "WIND" and r.get("generation") is not None:
                    out[r["startTime"]] = float(r["generation"])
    finally:
        if own:
            client.close()
    return dict(sorted(out.items()))


def fetch_wind_forecasts(start: datetime, end: datetime, client: httpx.Client | None = None) -> dict[str, list[list]]:
    """All WINDFOR forecast runs published in [start, end), as {publishTime: [[startTime, MW], ...]}."""
    own = client is None
    client = client or httpx.Client()
    runs: dict[str, dict[str, float]] = {}
    try:
        cur = start
        while cur < end:
            nxt = min(cur + timedelta(days=CHUNK_DAYS), end)
            rows = _get(
                client,
                f"{BASE_URL}/WINDFOR/stream",
                {"publishDateTimeFrom": _iso_z(cur), "publishDateTimeTo": _iso_z(nxt)},
            )
            for r in rows:
                if r.get("generation") is None:
                    continue
                # The API's range is inclusive at both ends; keep the half-open interval to avoid duplicates.
                if not (_iso_z(cur) <= r["publishTime"] < _iso_z(nxt)):
                    continue
                runs.setdefault(r["publishTime"], {})[r["startTime"]] = float(r["generation"])
            cur = nxt
    finally:
        if own:
            client.close()
    return {pt: sorted([[st, g] for st, g in pts.items()]) for pt, pts in sorted(runs.items())}
