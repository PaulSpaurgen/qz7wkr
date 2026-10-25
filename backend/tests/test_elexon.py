import itertools
from datetime import UTC, date, datetime

import httpx

from backend.app import elexon


def _client(handler):
    return httpx.Client(transport=httpx.MockTransport(handler))


def test_date_chunks_cover_range_without_overlap():
    chunks = list(elexon._date_chunks(date(2026, 1, 1), date(2026, 1, 20)))
    assert chunks[0] == (date(2026, 1, 1), date(2026, 1, 7))
    assert chunks[-1][1] == date(2026, 1, 20)
    for (_, a_end), (b_start, _) in itertools.pairwise(chunks):
        assert (b_start - a_end).days == 1


def test_fetch_wind_actuals_filters_wind_and_sorts():
    def handler(request: httpx.Request) -> httpx.Response:
        assert request.url.params["fuelType"] == "WIND"
        return httpx.Response(
            200,
            json=[
                {"startTime": "2026-01-01T00:30:00Z", "fuelType": "WIND", "generation": 2},
                {"startTime": "2026-01-01T00:00:00Z", "fuelType": "WIND", "generation": 1},
                {"startTime": "2026-01-01T00:00:00Z", "fuelType": "CCGT", "generation": 99},
            ],
        )

    out = elexon.fetch_wind_actuals(date(2026, 1, 1), date(2026, 1, 1), _client(handler))
    assert out == {"2026-01-01T00:00:00Z": 1.0, "2026-01-01T00:30:00Z": 2.0}


def test_fetch_wind_forecasts_groups_by_publish_time_and_dedupes_chunk_edges():
    def handler(request: httpx.Request) -> httpx.Response:
        frm = request.url.params["publishDateTimeFrom"]
        rows = [
            {"publishTime": "2026-01-01T02:30:00Z", "startTime": "2026-01-01T04:00:00Z", "generation": 10},
            {"publishTime": "2026-01-01T02:30:00Z", "startTime": "2026-01-01T03:00:00Z", "generation": 9},
            # boundary row returned by both chunk requests; must only be kept once
            {"publishTime": "2026-01-08T00:00:00Z", "startTime": "2026-01-08T01:00:00Z", "generation": 5},
        ]
        return httpx.Response(200, json=rows if frm.startswith("2026-01-01") else rows[2:])

    out = elexon.fetch_wind_forecasts(
        datetime(2026, 1, 1, tzinfo=UTC), datetime(2026, 1, 10, tzinfo=UTC), _client(handler)
    )
    assert out["2026-01-01T02:30:00Z"] == [["2026-01-01T03:00:00Z", 9.0], ["2026-01-01T04:00:00Z", 10.0]]
    assert out["2026-01-08T00:00:00Z"] == [["2026-01-08T01:00:00Z", 5.0]]


def test_get_retries_then_succeeds(monkeypatch):
    monkeypatch.setattr(elexon.time, "sleep", lambda _: None)
    calls = {"n": 0}

    def handler(request: httpx.Request) -> httpx.Response:
        calls["n"] += 1
        return httpx.Response(503) if calls["n"] < 3 else httpx.Response(200, json=[])

    assert elexon._get(_client(handler), "https://example.test/x", {}) == []
    assert calls["n"] == 3
