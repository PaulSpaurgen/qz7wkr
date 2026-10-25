"""Forecast error statistics. Pure functions over plain lists; no numpy/pandas needed at this scale."""

from __future__ import annotations

import math
from collections.abc import Callable, Iterable, Sequence


def quantile(values: Sequence[float], q: float) -> float:
    """Linear-interpolated quantile (same as numpy's default 'linear' method)."""
    if not values:
        raise ValueError("quantile of empty sequence")
    if not 0 <= q <= 1:
        raise ValueError("q must be in [0, 1]")
    xs = sorted(values)
    pos = (len(xs) - 1) * q
    lo = math.floor(pos)
    hi = math.ceil(pos)
    return xs[lo] + (xs[hi] - xs[lo]) * (pos - lo)


def summarize(forecast: Sequence[float], actual: Sequence[float]) -> dict:
    """Headline accuracy metrics. Error convention: actual - forecast (negative = shortfall)."""
    n = len(forecast)
    if n != len(actual):
        raise ValueError("forecast and actual must have equal length")
    if n == 0:
        return {"n": 0}
    errors = [a - f for f, a in zip(forecast, actual, strict=True)]
    abs_err = [abs(e) for e in errors]
    mean_actual = sum(actual) / n
    mae = sum(abs_err) / n
    return {
        "n": n,
        "mae": mae,
        "rmse": math.sqrt(sum(e * e for e in errors) / n),
        "bias": sum(errors) / n,
        "nmae_pct": 100 * mae / mean_actual if mean_actual else None,
        "p50_abs": quantile(abs_err, 0.5),
        "p90_abs": quantile(abs_err, 0.9),
        "p95_abs": quantile(abs_err, 0.95),
        "max_shortfall": -min(errors),  # largest MW by which wind fell short of forecast
        "max_surplus": max(errors),
        "mean_actual": mean_actual,
        "mean_forecast": sum(forecast) / n,
        "correlation": _correlation(forecast, actual),
    }


def _correlation(xs: Sequence[float], ys: Sequence[float]) -> float | None:
    n = len(xs)
    if n < 2:
        return None
    mx, my = sum(xs) / n, sum(ys) / n
    sxy = sum((x - mx) * (y - my) for x, y in zip(xs, ys, strict=True))
    sxx = sum((x - mx) ** 2 for x in xs)
    syy = sum((y - my) ** 2 for y in ys)
    return sxy / math.sqrt(sxx * syy) if sxx and syy else None


def group_by[T, K](items: Iterable[T], key: Callable[[T], K]) -> dict[K, list[T]]:
    groups: dict[K, list[T]] = {}
    for it in items:
        groups.setdefault(key(it), []).append(it)
    return dict(sorted(groups.items(), key=lambda kv: kv[0]))  # type: ignore[arg-type, return-value]


def histogram(values: Sequence[float], bin_width: float) -> list[dict]:
    """Fixed-width bins aligned to multiples of bin_width: [{start, end, count}]."""
    if not values:
        return []
    lo = math.floor(min(values) / bin_width) * bin_width
    hi = math.floor(max(values) / bin_width) * bin_width
    counts: dict[float, int] = {}
    for v in values:
        b = math.floor(v / bin_width) * bin_width
        counts[b] = counts.get(b, 0) + 1
    bins = []
    b = lo
    while b <= hi + 1e-9:
        bins.append({"start": b, "end": b + bin_width, "count": counts.get(b, 0)})
        b += bin_width
    return bins
