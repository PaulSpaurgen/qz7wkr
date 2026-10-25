"""API tests against the committed January 2026 snapshot."""

import pytest
from fastapi.testclient import TestClient

from backend.app.main import app

client = TestClient(app)


def test_health():
    assert client.get("/api/health").json() == {"status": "ok"}


def test_meta():
    m = client.get("/api/meta").json()
    assert m["decision_start"] == "2026-01-01"
    assert m["decision_end"] == "2026-01-31"
    assert m["gate_closures"] == {"EPEX": "09:20", "N2EX": "09:50"}
    assert m["data"]["forecast_runs"] > 500


def test_day_ahead_uses_latest_run_before_gate():
    r = client.get("/api/day-ahead", params={"decision_date": "2026-01-15", "gate_closure": "09:20"}).json()
    assert r["delivery_date"] == "2026-01-16"
    assert r["forecast_run"]["publish_time"] == "2026-01-15T07:30:00Z"
    assert len(r["series"]) == 48
    r = client.get("/api/day-ahead", params={"decision_date": "2026-01-15", "gate_closure": "09:50"}).json()
    assert r["forecast_run"]["publish_time"] == "2026-01-15T09:30:00Z"


def test_day_ahead_band_ordering_and_procurement():
    r = client.get("/api/day-ahead", params={"decision_date": "2026-01-10", "demand_mw": 30000}).json()
    for s in r["series"]:
        assert s["low"] <= s["expected"] <= s["high"]
        assert s["firm"] == s["low"]
    p = r["procurement"]
    assert p["need_vs_firm_mwh"] >= p["need_vs_forecast_mwh"]
    assert p["demand_mwh"] == 30000 * 24


def test_day_ahead_uncertainty_uses_only_past_data():
    r = client.get("/api/day-ahead", params={"decision_date": "2026-01-10", "lookback_days": 30}).json()
    # 30 days of half-hours strictly before the 09:20 gate closure
    assert r["uncertainty"]["n_samples"] <= 30 * 48


@pytest.mark.parametrize(
    "params",
    [
        {"decision_date": "2025-12-31"},
        {"decision_date": "2026-02-01"},
        {"decision_date": "2026-01-10", "gate_closure": "25:00"},
        {"decision_date": "2026-01-10", "confidence": 1.5},
        {"decision_date": "2026-01-10", "lookback_days": 0},
    ],
)
def test_day_ahead_validation(params):
    assert client.get("/api/day-ahead", params=params).status_code == 422


def test_accuracy_month():
    r = client.get("/api/accuracy").json()
    s = r["summary"]
    assert s["n"] == 31 * 48
    assert 0 < s["mae"] < s["rmse"]
    assert len(r["by_day"]) == 31
    assert [h["hour"] for h in r["by_hour"]] == list(range(24))
    assert sum(b["count"] for b in r["histogram"]) == s["n"]
    assert 0 <= r["calibration"]["breach_rate"] <= 1
    assert r["bias_adjusted_summary"]["n"] == s["n"]


def test_accuracy_rejects_inverted_range():
    assert client.get("/api/accuracy", params={"start": "2026-01-20", "end": "2026-01-10"}).status_code == 422


def test_horizon_buckets_are_ordered():
    b = client.get("/api/accuracy/horizon").json()["buckets"]
    assert b[0]["lead_from"] == 0
    assert [x["lead_from"] for x in b] == sorted(x["lead_from"] for x in b)


def test_vintages_flag_gate():
    r = client.get("/api/vintages", params={"delivery_date": "2026-01-16"}).json()
    assert r["selected_publish_time"] == "2026-01-15T07:30:00Z"
    before = [v for v in r["runs"] if v["before_gate"]]
    assert before and before[-1]["publish_time"] == r["selected_publish_time"]
    assert len(r["actuals"]) == 48
