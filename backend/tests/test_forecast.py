import itertools
from datetime import UTC, date, datetime, time, timedelta

import pytest

from backend.app.forecast import (
    day_ahead_errors,
    day_ahead_forecast,
    delivery_slots,
    gate_closure_utc,
    horizon_errors,
)


def test_gate_closure_is_uk_local_time():
    # January: GMT == UTC
    assert gate_closure_utc(date(2026, 1, 15), time(9, 20)) == datetime(2026, 1, 15, 9, 20, tzinfo=UTC)
    # July: BST = UTC+1
    assert gate_closure_utc(date(2026, 7, 15), time(9, 20)) == datetime(2026, 7, 15, 8, 20, tzinfo=UTC)


@pytest.mark.parametrize(("day", "n"), [(date(2026, 1, 2), 48), (date(2026, 3, 29), 46), (date(2026, 10, 25), 50)])
def test_delivery_slots_handle_clock_changes(day, n):
    slots = delivery_slots(day)
    assert len(slots) == n
    assert all(b - a == timedelta(minutes=30) for a, b in itertools.pairwise(slots))


def test_value_at_interpolates_half_hours(ramp_run):
    t0 = ramp_run.publish_time
    assert ramp_run.value_at(t0) == 0
    assert ramp_run.value_at(t0 + timedelta(minutes=30)) == 50
    assert ramp_run.value_at(t0 + timedelta(minutes=90)) == 200
    assert ramp_run.value_at(t0 + timedelta(hours=2)) == 300
    assert ramp_run.value_at(t0 + timedelta(hours=2, minutes=30)) is None
    assert ramp_run.value_at(t0 - timedelta(minutes=30)) is None


def test_latest_run_before_gate_is_selected(synthetic_ds):
    # Gate 09:20 -> only the 07:30 run is available
    fc = day_ahead_forecast(synthetic_ds, date(2026, 1, 1), time(9, 20))
    assert fc.run.publish_time == datetime(2026, 1, 1, 7, 30, tzinfo=UTC)
    assert fc.delivery_date == date(2026, 1, 2)
    assert len(fc.forecast) == 48
    assert fc.forecast[0] == 1024.0  # hour 24 of the 07:30 run
    # Gate 09:50 -> the 09:30 run is the latest
    fc = day_ahead_forecast(synthetic_ds, date(2026, 1, 1), time(9, 50))
    assert fc.run.publish_time == datetime(2026, 1, 1, 9, 30, tzinfo=UTC)
    assert set(fc.forecast) == {2000.0}


def test_run_published_exactly_at_gate_counts(synthetic_ds):
    fc = day_ahead_forecast(synthetic_ds, date(2026, 1, 1), time(9, 30))
    assert fc.run.publish_time.hour == 9


def test_no_run_before_gate(synthetic_ds):
    fc = day_ahead_forecast(synthetic_ds, date(2026, 1, 1), time(7, 0))
    assert fc.run is None
    assert fc.forecast == [None] * 48
    assert day_ahead_errors(synthetic_ds, [date(2026, 1, 1)], time(7, 0)) == []


def test_day_ahead_errors_sign_and_lead(synthetic_ds):
    errs = day_ahead_errors(synthetic_ds, [date(2026, 1, 1)], time(9, 50))
    assert len(errs) == 48
    assert all(e.error == -1000.0 for e in errs)  # forecast 2000, actual 1000 -> shortfall
    assert errs[0].lead_hours == pytest.approx(14.5)  # 09:30 -> 00:00 next day


def test_horizon_errors_skip_points_before_publish(synthetic_ds):
    start = datetime(2026, 1, 1, tzinfo=UTC)
    pts = horizon_errors(synthetic_ds, start, start + timedelta(days=3))
    assert all(lead >= 0 for lead, _, _ in pts)
    assert min(lead for lead, _, _ in pts) == pytest.approx(0.5)  # 08:00 point of the 07:30 run
