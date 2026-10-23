"""Vintage selection, step-hold join, QA and accuracy metrics for the REint artifact.

Plain Python + numpy; no FastAPI, no network. January is GMT (no DST).
"""

import json
from bisect import bisect_right
from datetime import date, datetime, time, timedelta, timezone
from pathlib import Path

import numpy as np

ARTIFACT_PATH = Path(__file__).parent / "data" / "artifact.json"
GATE_TIMES = {"epex": time(9, 20), "n2ex": time(9, 50)}
GATE_LABELS = {"epex": "EPEX GB DA", "n2ex": "N2EX GB DA"}
HIST_BINS = [("0-250", 0, 250), ("250-500", 250, 500), ("500-1000", 500, 1000),
             ("1000-1500", 1000, 1500), ("1500-2000", 1500, 2000), ("2000+", 2000, None)]
LEAD_BINS = [("12-18h", 12, 18), ("18-24h", 18, 24), ("24-30h", 24, 30),
             ("30-36h", 30, 36), ("36-42h", 36, 42), ("42-48h", 42, 48)]
_BAND_CACHE = {}


def load(path=None):
    """Read the JSON artifact; no network access."""
    return json.loads(Path(path or ARTIFACT_PATH).read_text(encoding="utf-8"))


def _iso(dt):
    return dt.strftime("%Y-%m-%dT%H:%M:%SZ")


def _parse(text):
    return datetime.fromisoformat(text.replace("Z", "+00:00"))


def _r2(value):
    return round(value, 2) if value is not None else None


def _days(artifact):
    return sorted({r["settlementDate"] for r in artifact["actuals"]})


def _hour(row):
    return int(row["startTime"][11:13])


def gate_cutoff(delivery_date, gate):
    """D-1 at the gate cutoff, aware UTC."""
    if gate not in GATE_TIMES:
        raise ValueError(f"unknown gate: {gate!r}")
    day = date.fromisoformat(delivery_date) - timedelta(days=1)
    return datetime.combine(day, GATE_TIMES[gate], tzinfo=timezone.utc)


def _select(vintages, cutoff):
    # fixed-format UTC strings: lexicographic order is chronological order
    index = bisect_right(vintages, _iso(cutoff))
    if index == 0:
        return None
    vintage = vintages[index - 1]
    return None if cutoff - _parse(vintage) > timedelta(hours=24) else vintage


def select_vintage(forecasts, delivery_date, gate):
    """Newest run published at or before the cutoff; never a later run."""
    vintages = sorted({r["publishTime"] for r in forecasts})
    return _select(vintages, gate_cutoff(delivery_date, gate))


def step_hold(forecasts, delivery_date, gate):
    """24 hourly forecasts step-held onto 48 half-hourly startTimes; {} if no vintage."""
    vintage = select_vintage(forecasts, delivery_date, gate)
    if vintage is None:
        return {}
    hourly = {r["startTime"]: r["generation"] for r in forecasts if r["publishTime"] == vintage}
    start = datetime.combine(date.fromisoformat(delivery_date), time(0, 0), tzinfo=timezone.utc)
    hold = {}
    for hour in range(24):
        value = hourly.get(_iso(start + timedelta(hours=hour)))
        if value is None:
            continue
        hold[_iso(start + timedelta(hours=hour))] = value
        hold[_iso(start + timedelta(hours=hour, minutes=30))] = value
    if len(hold) < 48:
        raise ValueError(f"step_hold: {delivery_date} {gate} has {len(hold) // 2}/24 hours")
    return hold


def _day_rows(artifact, delivery_date, gate):
    cutoff = gate_cutoff(delivery_date, gate)
    vintage = select_vintage(artifact["forecasts"], delivery_date, gate)
    hold = step_hold(artifact["forecasts"], delivery_date, gate) if vintage else {}
    actuals = {r["startTime"]: r["generation"] for r in artifact["actuals"]}
    start = datetime.combine(date.fromisoformat(delivery_date), time(0, 0), tzinfo=timezone.utc)
    excluded = {"missingActual": 0, "outageZero": 0, "missingForecast": 0}
    periods = []
    for index in range(48):
        start_time = _iso(start + timedelta(minutes=30 * index))
        actual, forecast = actuals.get(start_time), hold.get(start_time)
        if actual is None:
            excluded["missingActual"] += 1
        elif actual == 0:  # vacuous in this window: transmission-metered wind min is 1695 MW
            excluded["outageZero"] += 1
            actual = None
        if forecast is None:
            excluded["missingForecast"] += 1
        error = forecast - actual if forecast is not None and actual is not None else None
        periods.append({"settlementPeriod": index + 1, "startTime": start_time, "forecast": forecast,
                        "actual": actual, "error": error})
    age = int((cutoff - _parse(vintage)).total_seconds() // 60) if vintage else None
    return {"date": delivery_date, "gate": {"id": gate, "label": GATE_LABELS[gate], "cutoff": _iso(cutoff)},
            "publishTime": vintage, "ageMinutes": age, "periods": periods, "excluded": excluded}


def band_by_hour(all_rows):
    """In-sample P90 absolute error per delivery hour (0..23) over the whole window."""
    bands = {}
    for hour in range(24):
        errors = [abs(r["error"]) for r in all_rows if r["error"] is not None and _hour(r) == hour]
        bands[hour] = float(np.percentile(errors, 90)) if errors else 0.0
    return bands


def _bands(artifact, gate):
    key = (id(artifact), gate)  # in-sample over the whole artifact, so cache per artifact
    if key not in _BAND_CACHE:
        rows = [r for day in _days(artifact) for r in _day_rows(artifact, day, gate)["periods"]]
        _BAND_CACHE[key] = band_by_hour(rows)
    return _BAND_CACHE[key]


def build_day(artifact, delivery_date, gate):
    day = _day_rows(artifact, delivery_date, gate)
    bands = _bands(artifact, gate)
    for period in day["periods"]:
        p90 = bands[_hour(period)]
        period["bandLow"] = None if period["forecast"] is None else round(period["forecast"] - p90, 2)
        period["bandHigh"] = None if period["forecast"] is None else round(period["forecast"] + p90, 2)
    return day


def metrics(rows):
    """Accuracy over non-null errors, unrounded (summary() rounds for output)."""
    pairs = [
        (r["error"] if r.get("error") is not None else r["forecast"] - r["actual"], r["actual"])
        for r in rows
        if r.get("actual") not in (None, 0) and (r.get("error") is not None or r.get("forecast") is not None)
    ]
    n = len(pairs)
    if not n:
        return {"n": 0, "mae": None, "rmse": None, "bias": None, "p90": None, "wape": None}
    errors = np.array([error for error, _ in pairs], dtype=float)
    actuals = np.array([actual for _, actual in pairs], dtype=float)
    abs_errors = np.abs(errors)
    return {"n": n, "mae": float(abs_errors.mean()), "rmse": float(np.sqrt((errors**2).mean())),
            "bias": float(errors.mean()), "p90": float(np.percentile(abs_errors, 90)),
            "wape": float(abs_errors.sum() / actuals.sum() * 100)}


def summary(artifact, gate):
    rows, leads = [], []
    excluded = {"missingActual": 0, "outageZero": 0, "missingForecast": 0}
    daily = []
    for day in _days(artifact):
        built = build_day(artifact, day, gate)
        publish = _parse(built["publishTime"]) if built["publishTime"] else None
        for period in built["periods"]:
            rows.append(period)
            lead = (_parse(period["startTime"]) - publish).total_seconds() / 3600 if publish else None
            leads.append(lead)
        for key in excluded:
            excluded[key] += built["excluded"][key]
        stats = metrics(built["periods"])
        daily.append({"date": day, "mae": _r2(stats["mae"]), "bias": _r2(stats["bias"]), "n": stats["n"]})

    abs_errors = [abs(r["error"]) for r in rows if r["error"] is not None]
    histogram = [{"bin": label, "count": sum(1 for e in abs_errors if e >= low and (high is None or e < high))}
                 for label, low, high in HIST_BINS]
    by_hour = []
    for hour in range(24):
        stats = metrics([r for r in rows if _hour(r) == hour])
        by_hour.append({"hour": hour, "mae": _r2(stats["mae"]), "bias": _r2(stats["bias"]), "n": stats["n"]})
    by_lead = []
    for label, low, high in LEAD_BINS:
        subset = [r for r, lead in zip(rows, leads) if r["error"] is not None and lead is not None and low <= lead < high]
        if subset:
            stats = metrics(subset)
            by_lead.append({"bucket": label, "mae": _r2(stats["mae"]), "n": stats["n"]})

    overall = metrics(rows)
    worst = sorted((d for d in daily if d["n"]), key=lambda d: d["mae"], reverse=True)[:5]
    worst_days = []
    for item in worst:
        errors = [abs(r["error"]) for r in rows if r["startTime"][:10] == item["date"] and r["error"] is not None]
        worst_days.append({"date": item["date"], "mae": item["mae"], "maxAbsError": _r2(max(errors)) if errors else None})
    return {
        "gate": gate,
        "kpis": {key: _r2(overall[key]) for key in ("mae", "rmse", "bias", "p90", "wape", "n")},
        "daily": daily, "histogram": histogram, "byHour": by_hour, "byLead": by_lead, "worstDays": worst_days,
        "methodology": {"band": "in-sample P90 absolute error by delivery hour", "exclusions": excluded,
                        "leadCollinearity": "hour-of-day and lead time are collinear in this window",
                        "wape": "percent"},
    }


def meta(artifact):
    caveats = ["Actuals cover transmission-metered wind only, not embedded wind.",
               "The P90 band is in-sample, not an out-of-sample prediction interval.",
               "Hour-of-day and forecast lead time are collinear in this window.",
               "MAPE rejected in favour of WAPE because near-zero actuals would blow it up.",
               "FUELHH WIND is transmission-metered outturn; WINDFOR is NGESO's national wind forecast. "
               "Part of the mean positive bias may be a scope difference rather than forecast skill."]
    return {"window": artifact["meta"]["window"], "gates": artifact["meta"]["gates"],
            "actual_rows": len(artifact["actuals"]), "delivery_days": len(_days(artifact)),
            "caveats": caveats}


if __name__ == "__main__":
    artifact = load()
    for gate in GATE_TIMES:
        result = summary(artifact, gate)
        kpis = result["kpis"]
        print(f"gate={gate} n={kpis['n']} mae={kpis['mae']} rmse={kpis['rmse']} "
              f"bias={kpis['bias']} p90={kpis['p90']} wape={kpis['wape']}")
        print(f"worst_day={result['worstDays'][0]['date']} mae={result['worstDays'][0]['mae']}")
    sample = " ".join(f"{gate} vintage={select_vintage(artifact['forecasts'], '2026-01-15', gate)}"
                      for gate in GATE_TIMES)
    print(f"2026-01-15 {sample}")
