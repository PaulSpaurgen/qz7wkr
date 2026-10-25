"""In-memory dataset: actuals and forecast runs, loaded once from the JSON snapshot."""

from __future__ import annotations

import bisect
import json
from dataclasses import dataclass, field
from datetime import datetime
from functools import lru_cache

from backend.app.config import ACTUALS_FILE, FORECASTS_FILE


def parse_ts(s: str) -> datetime:
    return datetime.fromisoformat(s.replace("Z", "+00:00"))


def fmt_ts(dt: datetime) -> str:
    return dt.strftime("%Y-%m-%dT%H:%M:%SZ")


@dataclass(frozen=True)
class ForecastRun:
    publish_time: datetime
    points: dict[datetime, float]  # hourly target time -> MW
    times: list[datetime] = field(compare=False)  # sorted keys of points

    @classmethod
    def build(cls, publish_time: datetime, points: dict[datetime, float]) -> ForecastRun:
        return cls(publish_time, points, sorted(points))

    def value_at(self, t: datetime) -> float | None:
        """Forecast at time t, linearly interpolated between hourly points; None outside the run."""
        if t in self.points:
            return self.points[t]
        i = bisect.bisect_left(self.times, t)
        if i == 0 or i == len(self.times):
            return None
        t0, t1 = self.times[i - 1], self.times[i]
        w = (t - t0) / (t1 - t0)
        return self.points[t0] + w * (self.points[t1] - self.points[t0])


@dataclass(frozen=True)
class Dataset:
    actuals: dict[datetime, float]  # half-hourly start time -> MW
    runs: list[ForecastRun]  # sorted by publish_time
    fetched_at: str = ""

    @property
    def publish_times(self) -> list[datetime]:
        return [r.publish_time for r in self.runs]

    def latest_run_before(self, cutoff: datetime) -> ForecastRun | None:
        """The newest forecast run published at or before `cutoff`."""
        i = bisect.bisect_right(self.publish_times, cutoff)
        return self.runs[i - 1] if i else None

    def runs_between(self, start: datetime, end: datetime) -> list[ForecastRun]:
        return [r for r in self.runs if start <= r.publish_time < end]


def build_dataset(actuals_raw: dict[str, float], forecasts_raw: dict[str, list], fetched_at: str = "") -> Dataset:
    actuals = {parse_ts(k): float(v) for k, v in actuals_raw.items()}
    runs = [
        ForecastRun.build(parse_ts(pt), {parse_ts(st): float(g) for st, g in pts}) for pt, pts in forecasts_raw.items()
    ]
    runs.sort(key=lambda r: r.publish_time)
    return Dataset(actuals=dict(sorted(actuals.items())), runs=runs, fetched_at=fetched_at)


@lru_cache(maxsize=1)
def get_dataset() -> Dataset:
    actuals = json.loads(ACTUALS_FILE.read_text())
    forecasts = json.loads(FORECASTS_FILE.read_text())
    return build_dataset(actuals["data"], forecasts["data"], actuals.get("meta", {}).get("fetchedAt", ""))
