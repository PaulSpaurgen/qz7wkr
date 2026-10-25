"""Download the Elexon data the app needs and write it to backend/data/ as a JSON snapshot.

Usage (from repo root):  python -m backend.scripts.fetch_snapshot
"""

from __future__ import annotations

import json
from datetime import UTC, date, datetime

from backend.app.config import ACTUALS_FILE, DATA_DIR, FORECASTS_FILE, SNAPSHOT
from backend.app.elexon import fetch_wind_actuals, fetch_wind_forecasts


def main() -> None:
    DATA_DIR.mkdir(parents=True, exist_ok=True)
    a_start, a_end = (date.fromisoformat(d) for d in SNAPSHOT["actuals"])
    f_start, f_end = (datetime.fromisoformat(d).replace(tzinfo=UTC) for d in SNAPSHOT["forecasts"])

    print(f"Fetching FUELHH WIND actuals {a_start} -> {a_end} ...")
    actuals = fetch_wind_actuals(a_start, a_end)
    print(f"  {len(actuals)} half-hours")

    print(f"Fetching WINDFOR forecasts published {f_start} -> {f_end} ...")
    forecasts = fetch_wind_forecasts(f_start, f_end)
    print(f"  {len(forecasts)} forecast runs, {sum(len(v) for v in forecasts.values())} points")

    meta = {"fetchedAt": datetime.now(UTC).strftime("%Y-%m-%dT%H:%M:%SZ"), "source": "data.elexon.co.uk"}
    ACTUALS_FILE.write_text(json.dumps({"meta": meta, "data": actuals}, separators=(",", ":")))
    FORECASTS_FILE.write_text(json.dumps({"meta": meta, "data": forecasts}, separators=(",", ":")))
    print(f"Wrote {ACTUALS_FILE} and {FORECASTS_FILE}")


if __name__ == "__main__":
    main()
