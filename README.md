# Gale Desk

A day-ahead wind forecast desk for a UK electricity supplier — a January 2026 replay.

The app does **not** predict wind and does **not** calculate procurement. NGESO publishes the wind forecast; this tool shows the forecast that was genuinely available at the moment the desk had to buy, and measures how wrong those forecasts were.

**Live demo:** _deployment in progress — link added after the Vercel deploy._

![Decision desk](docs/decision-desk.png)

![Forecast accuracy](docs/accuracy.png)

## The two product requirements

**1. Show the forecast that was available at decision time.**

For a delivery day `D`, the desk buys at a day-ahead auction on `D-1`. The app finds the newest WINDFOR run published at or before that gate:

- **EPEX GB DA** gate `09:20Z` → the `07:30Z` run (1 h 50 m old at gate)
- **N2EX GB DA** gate `09:50Z` → the `09:30Z` run (20 min old at gate)

The Decision desk shows all 48 settlement periods for the chosen day: forecast, actual, error, and a P90 error band. The band is the quantified error from requirement 2 feeding the buying decision.

**2. Quantify forecast accuracy.**

The Accuracy tab scores every settlement period in the window:

| Metric (N2EX gate) | Value |
|---|---|
| MAE | 2,016 MW |
| RMSE | 2,510 MW |
| Bias | +1,730 MW |
| P90 absolute error | 4,197 MW |
| WAPE | 17.9% |
| Settlement periods | 1,488 |

Also shown: daily MAE and bias, error distribution, error by hour of day, error by forecast horizon, and the worst delivery days. Worst day: **28 Jan 2026**, MAE 5,375 MW.

## Data window

The brief scopes **purchase decisions made in January 2026**, so the app is scoped by decision date:

- decision gates: **1–31 Jan 2026**
- delivery days: **2 Jan – 1 Feb 2026** (31 days, 1,488 half-hours)
- forecasts fetched by `publishTime`; actuals by `settlementDate`

Sources (Elexon BMRS, public, no API key):

- `FUELHH` actual generation, `fuelType=WIND`, 30-minute resolution
- `WINDFOR` wind generation forecasts, hourly, 8 runs per day

`ingest.py` fetches both in ≤7-day chunks (10 requests) and writes `backend/data/artifact.json` (1.84 MB, committed so the app runs without network access).

## How the analysis works

- **Vintage selection.** For delivery day `D` and gate `G`, take the latest `publishTime <= (D-1 at G)`. Never borrow a later run; drop a vintage older than 24 hours.
- **Step-hold.** WINDFOR is hourly and FUELHH is half-hourly. Each hourly forecast is held across both settlement periods. The join is on `(publishTime, startTime)`, never `startTime` alone — otherwise 8 overlapping vintages duplicate every hour.
- **QA.** Zero or missing actuals are excluded and counted (none occurred in this window). Missing forecast hours are excluded and counted.
- **Metrics.** `error = forecast - actual`. MAE, RMSE, bias, P90 absolute error, and WAPE = `Σ|error| / Σactual`. MAPE is deliberately rejected: it is undefined at zero and unstable at low wind.
- **Band.** The P90 band is the 90th percentile of absolute error for each delivery hour, computed over the whole window. It is in-sample: it describes January's observed misses, not a guarantee.

## Project structure

```
app/
  backend/
    ingest.py            # Elexon FUELHH + WINDFOR -> data/artifact.json
    analytics.py         # vintage selection, step-hold, QA, metrics
    app.py               # FastAPI: /api/meta, /api/days, /api/day, /api/summary
    test_analytics.py    # 7 tests: selection, look-ahead, join, QA, metrics
    test_app.py          # 5 tests: contract, error paths, real numbers
    requirements.txt
    data/artifact.json   # committed January 2026 dataset
  frontend/
    src/App.jsx          # shell, gate toggle, date picker, tabs
    src/DecisionDesk.jsx # 48-SP chart + P90 band + table
    src/Accuracy.jsx     # KPIs, daily/histogram/by-hour/by-lead, worst days
    src/api.js           # fetch helpers
    src/format.js        # UTC/MW/percent formatting
    src/styles.css
  Dockerfile             # multi-stage: node build -> python:3.12-slim
  .dockerignore
```

## Run locally

Backend (Python 3.12):

```
cd backend
python -m venv .venv
.venv\Scripts\activate        # Windows
# source .venv/bin/activate   # macOS/Linux
pip install -r requirements.txt
uvicorn app:app --reload --port 8000
```

Frontend (Node 20+):

```
cd frontend
npm install
npm run dev
```

Open <http://localhost:5173>. Vite proxies `/api` to `http://localhost:8000`.

API docs: <http://localhost:8000/docs>.

## Run with Docker

```
cd app
docker build -t gale-desk .
docker run --rm -p 8000:8000 gale-desk
```

Open <http://localhost:8000>. One container serves the React build and the API from the same origin.

## Tests

```
cd backend
pytest -q
```

12 tests pass: vintage selection, no look-ahead over 31 days × 2 gates, step-hold, QA exclusion, toy metric values, full 48-SP join, API contract and error paths.

## Deployment

Heroku has no free tier (Eco dyno is a paid plan), so the app is deployed on **Vercel**:

- React static build
- FastAPI as a Vercel Python service
- the same `Dockerfile` remains the reproducible single-container build

_Replace this section with the live URL once deployed._

## Caveats

- `FUELHH` WIND is **transmission-metered** outturn, not total GB wind. `WINDFOR` is NGESO's national wind forecast. Part of the +1.73 GW mean bias may be a scope difference rather than forecast skill.
- The P90 band is **in-sample**.
- Hour-of-day and forecast lead time are collinear in this window; do not read the two charts as independent effects.
- No demand, price or other-fuel data is used. The app does not calculate procurement.

## AI tools

Built with AI coding agents (OpenCode sessions, DeepSeek V4.1) for implementation, review and test execution. Domain research, Elexon API verification and data-quality checks were also AI-assisted. Every number in this README comes from the committed pipeline; no metric is hand-entered.
