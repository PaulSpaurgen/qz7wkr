"""Static configuration: the analysis window, market timings and data locations."""

from __future__ import annotations

from datetime import date, time
from pathlib import Path

DATA_DIR = Path(__file__).resolve().parent.parent / "data"
ACTUALS_FILE = DATA_DIR / "actuals_wind.json"
FORECASTS_FILE = DATA_DIR / "forecasts_windfor.json"

# Purchase decisions in scope: made on 1-31 January 2026, for delivery the following day.
DECISION_START = date(2026, 1, 1)
DECISION_END = date(2026, 1, 31)

# Snapshot ranges. December 2025 is included so that error statistics for early-January
# decisions can be calibrated on a trailing window of genuinely past data.
SNAPSHOT = {
    "actuals": ("2025-11-25", "2026-02-02"),  # settlement dates, inclusive
    "forecasts": ("2025-11-22T00:00:00", "2026-02-02T00:00:00"),  # publish times, [from, to)
}

# GB day-ahead auction gate closures (UK local time). Since Brexit (Jan 2021) the GB
# auctions run before the European SDAC auction at 11:00 UK.
GATE_CLOSURES = {
    "EPEX": time(9, 20),  # EPEX SPOT GB hourly day-ahead auction
    "N2EX": time(9, 50),  # Nord Pool N2EX GB day-ahead auction
}
DEFAULT_GATE_CLOSURE = GATE_CLOSURES["EPEX"]

UK_TZ = "Europe/London"

DEFAULT_CONFIDENCE = 0.9
DEFAULT_LOOKBACK_DAYS = 30
