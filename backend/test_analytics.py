"""Offline tests for analytics.py: selection, join, QA, metrics, real artifact."""

import math
from datetime import datetime

import pytest

import analytics

ART = analytics.load()
DAYS = sorted({r["settlementDate"] for r in ART["actuals"]})
GATES = ("epex", "n2ex")
VINTAGES = sorted({r["publishTime"] for r in ART["forecasts"]})


@pytest.fixture(scope="module")
def summaries():
    return {gate: analytics.summary(ART, gate) for gate in GATES}


def _parse(text):
    return datetime.fromisoformat(text.replace("Z", "+00:00"))


def _synthetic(zero_period=1):
    day = "2026-01-15"
    periods = [(hour, minute) for hour in range(24) for minute in (0, 30)]
    actuals = [
        {
            "startTime": f"{day}T{hour:02d}:{minute:02d}:00Z",
            "settlementDate": day,
            "settlementPeriod": index + 1,
            "generation": 0 if index + 1 == zero_period else 1000,
        }
        for index, (hour, minute) in enumerate(periods)
    ]
    forecasts = [
        {
            "publishTime": "2026-01-14T07:30:00Z",
            "startTime": f"{day}T{hour:02d}:00:00Z",
            "generation": 900,
        }
        for hour in range(24)
    ]
    return {"meta": {}, "actuals": actuals, "forecasts": forecasts}


def test_gate_selection():
    assert analytics.select_vintage(ART["forecasts"], "2026-01-15", "epex") == "2026-01-14T07:30:00Z"
    assert analytics.select_vintage(ART["forecasts"], "2026-01-15", "n2ex") == "2026-01-14T09:30:00Z"
    with pytest.raises(ValueError):
        analytics.gate_cutoff("2026-01-15", "nope")


def test_no_lookahead():
    for day in DAYS:
        for gate in GATES:
            cutoff = analytics.gate_cutoff(day, gate)
            cutoff_text = cutoff.strftime("%Y-%m-%dT%H:%M:%SZ")
            vintage = analytics.select_vintage(ART["forecasts"], day, gate)
            assert vintage is not None, f"no vintage for {day} {gate}"
            assert _parse(vintage) <= cutoff
            # the selected run is the newest eligible one, never a later run
            assert vintage == max(v for v in VINTAGES if v <= cutoff_text)


def test_step_hold():
    for day in DAYS:
        for gate in GATES:
            hold = analytics.step_hold(ART["forecasts"], day, gate)
            assert len(hold) == 48, f"{day} {gate}"
            for hour in range(24):
                assert hold[f"{day}T{hour:02d}:00:00Z"] == hold[f"{day}T{hour:02d}:30:00Z"]


def test_metrics_toy():
    rows = [{"forecast": 10, "actual": 8}, {"forecast": 20, "actual": 25}]
    result = analytics.metrics(rows)
    errors = [10 - 8, 20 - 25]
    assert result["n"] == 2
    assert result["mae"] == pytest.approx(sum(abs(e) for e in errors) / 2, abs=1e-3) == 3.5
    assert result["rmse"] == pytest.approx(math.sqrt(sum(e**2 for e in errors) / 2), abs=1e-3)
    assert result["rmse"] == pytest.approx(3.8079, abs=1e-3)
    assert result["bias"] == pytest.approx(sum(errors) / 2, abs=1e-3) == -1.5
    assert result["wape"] == pytest.approx(sum(abs(e) for e in errors) / 33 * 100, abs=1e-3)
    assert result["wape"] == pytest.approx(21.2121, abs=1e-3)


def test_outage_excluded():
    built = analytics.build_day(_synthetic(), "2026-01-15", "epex")
    assert len(built["periods"]) == 48
    first = built["periods"][0]
    assert first["settlementPeriod"] == 1
    assert first["actual"] is None
    assert first["error"] is None
    assert built["excluded"] == {"missingActual": 0, "outageZero": 1, "missingForecast": 0}


def test_real_artifact(summaries):
    for gate in GATES:
        for day in DAYS:
            built = analytics.build_day(ART, day, gate)
            assert len(built["periods"]) == 48, f"{day} {gate}"
            assert [p["settlementPeriod"] for p in built["periods"]] == list(range(1, 49))
            assert built["publishTime"] is not None
        assert summaries[gate]["kpis"]["n"] == 1488


def test_wape_percent(summaries):
    toy = analytics.metrics([{"forecast": 10, "actual": 8}, {"forecast": 20, "actual": 25}])
    assert 0 < toy["wape"] < 100
    for gate in GATES:
        assert 0 < summaries[gate]["kpis"]["wape"] < 100
