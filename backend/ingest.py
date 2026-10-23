"""Fetch January 2026 GB wind actuals + forecasts into data/artifact.json."""

import json
import time
from collections import Counter, defaultdict
from datetime import date, datetime, timedelta, timezone
from pathlib import Path

import httpx

BASE = "https://data.elexon.co.uk/bmrs/api/v1/datasets"
ACTUALS_URL = f"{BASE}/FUELHH"
FORECASTS_URL = f"{BASE}/WINDFOR"
DELIVERY_FROM, DELIVERY_TO = date(2026, 1, 2), date(2026, 2, 1)
PUBLISH_FROM, PUBLISH_TO = date(2026, 1, 1), date(2026, 1, 31)
OUT = Path(__file__).parent / "data" / "artifact.json"


def get_json(url, params):
    for attempt in (1, 2, 3):
        try:
            r = httpx.get(url, params=params, timeout=60)
            r.raise_for_status()
            return r.json()["data"]
        except httpx.HTTPStatusError as e:
            if e.response.status_code == 400 or attempt == 3:
                raise
        except httpx.HTTPError:
            if attempt == 3:
                raise
        time.sleep(2 * attempt)  # 2s, then 4s


def chunks(start, end):
    while start <= end:
        stop = min(start + timedelta(days=6), end)
        yield start, stop
        start = stop + timedelta(days=1)


def fetch_chunk(label, url, params_fn, start, end):
    try:
        rows = get_json(url, params_fn(start, end))
        print(f"{label} {start}..{end} rows={len(rows)}", flush=True)
        return rows
    except httpx.HTTPStatusError as e:
        if e.response.status_code != 400 or start >= end:
            raise
        cut = min(start + timedelta(days=5), end - timedelta(days=1))
        print(f"{label} {start}..{end} HTTP 400 -> retrying as {start}..{cut} + {cut + timedelta(days=1)}..{end}", flush=True)
        return fetch_chunk(label, url, params_fn, start, cut) + fetch_chunk(
            label, url, params_fn, cut + timedelta(days=1), end
        )


def fetch_all(label, url, params_fn, start, end):
    rows = []
    for a, b in chunks(start, end):
        rows += fetch_chunk(label, url, params_fn, a, b)
    return rows


def actual_params(start, end):
    return {
        "settlementDateFrom": start.isoformat(),
        "settlementDateTo": end.isoformat(),
        "fuelType": "WIND",
        "format": "json",
    }


def forecast_params(start, end):
    return {
        "publishDateTimeFrom": f"{start.isoformat()}T00:00:00Z",
        "publishDateTimeTo": f"{end.isoformat()}T23:59:59Z",
        "format": "json",
    }


def main():
    actuals = sorted(
        (
            {
                "startTime": r["startTime"],
                "settlementDate": r["settlementDate"],
                "settlementPeriod": r["settlementPeriod"],
                "generation": r["generation"],
            }
            for r in fetch_all("actuals", ACTUALS_URL, actual_params, DELIVERY_FROM, DELIVERY_TO)
            if r["fuelType"] == "WIND"
        ),
        key=lambda r: r["startTime"],
    )

    forecasts, seen, duplicate_forecast_keys = [], set(), 0
    for r in fetch_all("forecasts", FORECASTS_URL, forecast_params, PUBLISH_FROM, PUBLISH_TO):
        key = (r["publishTime"], r["startTime"])
        if key in seen:
            duplicate_forecast_keys += 1
            continue
        seen.add(key)
        forecasts.append(
            {
                "publishTime": r["publishTime"],
                "startTime": r["startTime"],
                "generation": r["generation"],
            }
        )
    forecasts.sort(key=lambda r: (r["publishTime"], r["startTime"]))

    delivery_days = sorted({r["settlementDate"] for r in actuals})
    expected_days = [(DELIVERY_FROM + timedelta(days=i)).isoformat() for i in range(31)]
    missing_actual_days = [d for d in expected_days if d not in delivery_days]

    periods = defaultdict(list)
    for r in actuals:
        periods[r["settlementDate"]].append(r["settlementPeriod"])
    days_with_not_48 = {
        d: len(sps) for d, sps in periods.items() if len(sps) != 48 or sorted(sps) != list(range(1, 49))
    }

    vintages = sorted({r["publishTime"] for r in forecasts})
    vintages_per_day = Counter(v[:10] for v in vintages)
    publish_days = len(vintages_per_day)

    if len(delivery_days) != 31 or missing_actual_days or days_with_not_48:
        raise SystemExit(
            "validation failed: "
            f"delivery_days={len(delivery_days)} missing={missing_actual_days} bad_sp={days_with_not_48}"
        )

    artifact = {
        "meta": {
            "generated_at": datetime.now(timezone.utc).isoformat().replace("+00:00", "Z"),
            "sources": {"fuelhh": ACTUALS_URL, "windfor": FORECASTS_URL},
            "window": {
                "decision_from": "2026-01-01",
                "decision_to": "2026-01-31",
                "delivery_from": "2026-01-02",
                "delivery_to": "2026-02-01",
            },
            "gates": {"epex": "09:20Z", "n2ex": "09:50Z"},
            "counts": {
                "actual_rows": len(actuals),
                "forecast_rows": len(forecasts),
                "vintages": len(vintages),
                "delivery_days": len(delivery_days),
                "publish_days": publish_days,
            },
            "checks": {
                "missing_actual_days": missing_actual_days,
                "days_with_not_48": days_with_not_48,
                "vintages_per_day": dict(sorted(vintages_per_day.items())),
                "duplicate_forecast_keys": duplicate_forecast_keys,
            },
        },
        "actuals": actuals,
        "forecasts": forecasts,
    }

    OUT.parent.mkdir(parents=True, exist_ok=True)
    OUT.write_text(json.dumps(artifact, separators=(",", ":")), encoding="utf-8")

    print()
    print(f"actual_rows={len(actuals)}")
    print(f"forecast_rows={len(forecasts)}")
    print(f"vintages={len(vintages)}")
    print(f"delivery_days={len(delivery_days)}")
    print(f"missing_actual_days={missing_actual_days}")
    print(f"bad_sp_days={days_with_not_48}")
    print(f"duplicate_forecast_keys={duplicate_forecast_keys}")


if __name__ == "__main__":
    main()
