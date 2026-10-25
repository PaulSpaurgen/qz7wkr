import math

import pytest

from backend.app import metrics


def test_quantile_matches_numpy_linear():
    xs = [1, 2, 3, 4]
    assert metrics.quantile(xs, 0) == 1
    assert metrics.quantile(xs, 1) == 4
    assert metrics.quantile(xs, 0.5) == 2.5
    assert metrics.quantile(xs, 0.1) == pytest.approx(1.3)
    assert metrics.quantile([5, 1, 3], 0.5) == 3  # unsorted input


def test_quantile_rejects_bad_input():
    with pytest.raises(ValueError):
        metrics.quantile([], 0.5)
    with pytest.raises(ValueError):
        metrics.quantile([1], 1.5)


def test_summarize_hand_computed():
    forecast = [100, 200, 300, 400]
    actual = [110, 180, 300, 360]  # errors: +10, -20, 0, -40
    s = metrics.summarize(forecast, actual)
    assert s["n"] == 4
    assert s["mae"] == pytest.approx(17.5)
    assert s["rmse"] == pytest.approx(math.sqrt((100 + 400 + 0 + 1600) / 4))
    assert s["bias"] == pytest.approx(-12.5)
    assert s["nmae_pct"] == pytest.approx(100 * 17.5 / 237.5)
    assert s["max_shortfall"] == 40
    assert s["max_surplus"] == 10


def test_summarize_empty_and_mismatch():
    assert metrics.summarize([], []) == {"n": 0}
    with pytest.raises(ValueError):
        metrics.summarize([1, 2], [1])


def test_perfect_forecast_has_zero_error_and_unit_correlation():
    s = metrics.summarize([1, 2, 3], [1, 2, 3])
    assert s["mae"] == 0 and s["rmse"] == 0 and s["bias"] == 0
    assert s["correlation"] == pytest.approx(1.0)


def test_histogram_bins_cover_all_values():
    bins = metrics.histogram([-750, -10, 0, 499, 500, 1200], 500)
    assert [b["start"] for b in bins] == [-1000, -500, 0, 500, 1000]
    assert [b["count"] for b in bins] == [1, 1, 2, 1, 1]
    assert sum(b["count"] for b in bins) == 6
    assert metrics.histogram([], 500) == []


def test_group_by_sorts_keys():
    g = metrics.group_by([3, 1, 2, 4], lambda x: x % 2)
    assert list(g) == [0, 1]
    assert g[0] == [2, 4] and g[1] == [3, 1]
