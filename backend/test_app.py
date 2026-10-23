"""Contract tests for the FastAPI surface in app.py."""

import app as api
from fastapi.testclient import TestClient

client = TestClient(api.app)


def test_meta():
    res = client.get("/api/meta")
    assert res.status_code == 200
    body = res.json()
    assert len(body["gates"]) == 2
    assert body["defaultGate"] == "n2ex"
    assert body["actualRows"] == 1488


def test_days():
    res = client.get("/api/days")
    assert res.status_code == 200
    days = res.json()["days"]
    assert len(days) == 31
    assert days[0] == "2026-01-02"
    assert days[-1] == "2026-02-01"
    assert days == sorted(days)


def test_day_n2ex():
    res = client.get("/api/day/2026-01-15?gate=n2ex")
    assert res.status_code == 200
    body = res.json()
    assert len(body["periods"]) == 48
    assert body["publishTime"] == "2026-01-14T09:30:00Z"
    assert body["ageMinutes"] == 20
    assert body["periods"][0]["startTime"] == "2026-01-15T00:00:00Z"


def test_day_epex():
    res = client.get("/api/day/2026-01-15?gate=epex")
    assert res.status_code == 200
    assert res.json()["publishTime"] == "2026-01-14T07:30:00Z"


def test_bad_gate_and_summary():
    res = client.get("/api/day/2026-01-15?gate=bogus")
    assert res.status_code == 400
    assert res.json()["detail"]

    res = client.get("/api/summary?gate=n2ex")
    assert res.status_code == 200
    kpis = res.json()["kpis"]
    assert kpis["n"] == 1488
    assert 0 < kpis["wape"] < 100
