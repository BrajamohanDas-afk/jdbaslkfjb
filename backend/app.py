"""Gale Desk API: thin read-only HTTP surface over analytics.py."""

import os
from datetime import date
from pathlib import Path

from fastapi import FastAPI, HTTPException
from fastapi.responses import FileResponse, JSONResponse

import analytics

try:
    ARTIFACT = analytics.load()
except FileNotFoundError:
    raise RuntimeError(f"Artifact not found at {analytics.ARTIFACT_PATH}") from None

DAYS = sorted({r["settlementDate"] for r in ARTIFACT["actuals"]})
DAY_SET = set(DAYS)
GATES = list(analytics.GATE_TIMES)
DEFAULT_GATE = "n2ex"
_SUMMARIES = {}
STATIC_DIR = Path(os.getenv("STATIC_DIR", Path(__file__).parent / "static"))

app = FastAPI(title="Gale Desk API")


def _gate_or_400(gate):
    if gate not in analytics.GATE_TIMES:
        raise HTTPException(400, f"Unknown gate {gate!r}; use one of: {', '.join(GATES)}")
    return gate


def _summary(gate):
    # Computed once per gate; summary() rebuilds all 31 days and bands.
    if gate not in _SUMMARIES:
        _SUMMARIES[gate] = analytics.summary(ARTIFACT, gate)
    return _SUMMARIES[gate]


@app.get("/api/meta")
def get_meta():
    base = analytics.meta(ARTIFACT)
    window = base["window"]
    return {
        "window": {key: window[key] for key in
                   ("decision_from", "decision_to", "delivery_from", "delivery_to")},
        "gates": [{"id": gate, "label": analytics.GATE_LABELS[gate],
                   "cutoff": f"{analytics.GATE_TIMES[gate].strftime('%H:%M')}Z"} for gate in GATES],
        "defaultGate": DEFAULT_GATE,
        "actualRows": base["actual_rows"],
        "deliveryDays": base["delivery_days"],
        "exclusions": _summary(DEFAULT_GATE)["methodology"]["exclusions"],
        "caveats": base["caveats"],
        "generatedAt": ARTIFACT["meta"]["generated_at"],
    }


@app.get("/api/days")
def get_days():
    return {"days": DAYS}


@app.get("/api/day/{delivery_date}")
def get_day(delivery_date: str, gate: str = DEFAULT_GATE):
    try:
        parsed = date.fromisoformat(delivery_date)
    except ValueError:
        raise HTTPException(400, f"Invalid date {delivery_date!r}; expected YYYY-MM-DD") from None
    if parsed.isoformat() != delivery_date:
        raise HTTPException(400, f"Invalid date {delivery_date!r}; expected YYYY-MM-DD")
    _gate_or_400(gate)
    if delivery_date not in DAY_SET:
        raise HTTPException(404, f"No delivery day {delivery_date}; window is {DAYS[0]} to {DAYS[-1]}")
    return analytics.build_day(ARTIFACT, delivery_date, gate)


@app.get("/api/summary")
def get_summary(gate: str = DEFAULT_GATE):
    return _summary(_gate_or_400(gate))


@app.api_route("/api/{rest:path}", methods=["GET", "POST", "PUT", "PATCH", "DELETE", "HEAD", "OPTIONS"],
               include_in_schema=False)
def api_not_found(rest: str):
    return JSONResponse({"detail": "Not found"}, status_code=404)


if STATIC_DIR.is_dir():
    _ROOT = STATIC_DIR.resolve()
    _INDEX = _ROOT / "index.html"

    @app.get("/{path:path}", include_in_schema=False)
    def static_or_spa(path: str):
        candidate = (_ROOT / path).resolve()
        if candidate.is_file() and candidate.is_relative_to(_ROOT):
            return FileResponse(candidate)
        return FileResponse(_INDEX)
else:
    @app.get("/")
    def root():
        return {"service": "Gale Desk API", "docs": "/docs"}
