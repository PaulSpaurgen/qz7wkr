"""Synthetic dataset fixtures so selection logic can be tested without the real snapshot."""

from datetime import UTC, datetime, timedelta

import pytest

from backend.app.store import ForecastRun, build_dataset, fmt_ts


def make_run(publish: datetime, start: datetime, hours: int, value_fn) -> tuple[str, list]:
    pts = [[fmt_ts(start + timedelta(hours=h)), value_fn(h)] for h in range(hours)]
    return fmt_ts(publish), pts


@pytest.fixture
def synthetic_ds():
    """Two days of flat 1000 MW actuals; runs published 07:30 (=1000 MW) and 09:30 (=2000 MW) on 1 Jan."""
    day0 = datetime(2026, 1, 1, tzinfo=UTC)
    actuals = {fmt_ts(day0 + timedelta(minutes=30 * i)): 1000.0 for i in range(48 * 3)}
    forecasts = dict(
        [
            make_run(day0 + timedelta(hours=7, minutes=30), day0, 72, lambda h: 1000.0 + h),
            make_run(day0 + timedelta(hours=9, minutes=30), day0, 72, lambda h: 2000.0),
        ]
    )
    return build_dataset(actuals, forecasts)


@pytest.fixture
def ramp_run():
    t0 = datetime(2026, 1, 1, tzinfo=UTC)
    return ForecastRun.build(t0, {t0: 0.0, t0 + timedelta(hours=1): 100.0, t0 + timedelta(hours=2): 300.0})
