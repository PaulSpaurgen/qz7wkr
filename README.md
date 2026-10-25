# WindSight: GB day-ahead wind decision support

WindSight helps a UK utility's day-ahead trading desk answer two questions before each auction deadline:

1. **What is the latest national wind forecast we can actually use?** It shows the newest Elexon `WINDFOR` run published before gate closure, for the next delivery day.
2. **How much can we trust it?** It backtests every January 2026 purchase decision against metered generation (Elexon `FUELHH`, `WIND`) and turns the error into a calibrated **"firm wind"** figure and a **power-to-buy** estimate.

- **Live app:** _LIVE_URL_
- **API docs (OpenAPI):** _LIVE_URL_/api/docs
- **Video walkthrough:** _VIDEO_URL_

## What the January 2026 analysis shows

| | Value |
|---|---|
| Typical day-ahead error (MAE) | **2,023 MW** (17.9% of mean output), RMSE 2,498 MW |
| Systematic bias | **−1,744 MW**: the forecast over-predicted delivered wind by 13.4% on average |
| Days with less wind than forecast | **27 of 31** (19 days more than 10% short) |
| Bad half-hours (P90 absolute error) | 4,141 MW. Worst shortfall: 6,894 MW |
| Bias-adjusted forecast (trailing median, no look-ahead) | MAE **1,463 MW (−28%)** |
| "Firm wind @ 90%" reliability (out-of-sample) | Held **89.9%** of the time (target 90%) |
| Error vs lead time | 1.65 GW MAE at 0–6 h, 2.32 GW at 42–48 h. Day-ahead decisions use 16.5–40 h ahead |

These figures use the EPEX deadline of 09:20 UK. With Nord Pool's 09:50 deadline, the 09:30 run becomes usable and MAE drops to 1,996 MW.

## Features

- **Day-Ahead Desk.** Pick a decision day and auction deadline (EPEX 09:20, N2EX 09:50 or custom). The desk shows:
  - which forecast run you would have had and how old it was;
  - the half-hourly forecast with a P10–P90 risk band, a bias-adjusted expected line and a firm-wind floor;
  - an optional demand input that gives power to buy, including the risk buffer;
  - a hindsight toggle that reveals actuals;
  - how that day's forecast evolved run by run.
- **Forecast Accuracy.** A month-level backtest: MAE, RMSE, bias, nMAE and P90 error, plus calibration of the firm-wind level, daily energy error, error distribution, error by hour of day, error vs lead time, a forecast-vs-actual scatter, a bias-correction comparison and a daily table.
- **Methodology.** Every definition and assumption, in the app.

## Repository layout

```
.
├── api/index.py               Vercel serverless entry; re-exports the FastAPI app
├── backend/
│   ├── app/
│   │   ├── main.py            HTTP layer: routes, validation, caching headers (FastAPI)
│   │   ├── analysis.py        Use cases: day-ahead view, accuracy backtest, vintages, horizon
│   │   ├── forecast.py        Domain logic: gate closure (UK tz), delivery slots, forecast selection
│   │   ├── metrics.py         Pure error statistics (MAE, RMSE, quantiles, histogram…)
│   │   ├── store.py           Loads the data snapshot into memory; interpolation, run lookup
│   │   ├── elexon.py          Elexon BMRS client (chunked, retried)
│   │   └── config.py          Analysis window, auction deadlines, defaults
│   ├── data/                  JSON snapshot of FUELHH WIND + WINDFOR (25 Nov 2025 – 2 Feb 2026)
│   ├── scripts/fetch_snapshot.py   Re-downloads the snapshot from Elexon
│   ├── tests/                 pytest: metrics, forecast selection, API, Elexon client (mocked)
│   ├── Dockerfile
│   └── requirements-dev.txt
├── frontend/
│   ├── src/
│   │   ├── api/               typed API client + response types
│   │   ├── pages/             DayAheadPage, AccuracyPage, MethodologyPage
│   │   ├── components/        charts (Recharts), settings bar, layout, UI primitives
│   │   ├── hooks/useApi.ts    fetch hook with abort + keep-previous-data
│   │   ├── state/settings.tsx shared market assumptions (deadline, confidence, window)
│   │   └── lib/format.ts      number/time formatting (UK time)
│   ├── Dockerfile, nginx.conf build + serve, proxy /api
│   └── vite.config.ts
├── docs/
│   ├── ARCHITECTURE.md        design, data flow, decisions, trade-offs
│   └── VIDEO_SCRIPT.md        outline for the demo video
├── docker-compose.yml         api (FastAPI) + web (nginx) → http://localhost:8080
├── vercel.json                static frontend + Python function routing
├── requirements.txt           backend runtime dependencies (also used by Vercel)
├── pytest.ini, ruff.toml      test + lint config
└── .github/workflows/ci.yml   lint, test, build, docker build
```

## Running it

### Docker (recommended)

```bash
docker compose up --build
```

Open http://localhost:8080. The API is also exposed on http://localhost:8000/api/docs.

### Local development

Requires Python 3.12+ and Node 22+.

```bash
# backend
python -m venv backend/.venv
backend/.venv/Scripts/activate        # Windows; use `source backend/.venv/bin/activate` on macOS/Linux
pip install -r backend/requirements-dev.txt
uvicorn backend.app.main:app --reload --port 8000

# frontend (second terminal) – Vite proxies /api to :8000
cd frontend
npm install
npm run dev                           # http://localhost:5173
```

### Tests and checks

```bash
pytest                                 # backend: 35 tests
ruff check .
cd frontend && npm run lint && npm test && npm run build
```

### Refreshing the data

The app serves a committed snapshot. January 2026 is historical, so the app needs no runtime calls to Elexon, which keeps it fast and immune to API outages. To re-download:

```bash
python -m backend.scripts.fetch_snapshot
```

## API

| Endpoint | Purpose |
|---|---|
| `GET /api/meta` | Decision window, deadlines, data provenance |
| `GET /api/day-ahead?decision_date=2026-01-15&gate_closure=09:20&confidence=0.9&lookback_days=30&demand_mw=30000` | Forecast at deadline, risk band, KPIs, hindsight, procurement |
| `GET /api/vintages?delivery_date=2026-01-16&gate_closure=09:20` | Every forecast run for a delivery day, flagged before/after deadline |
| `GET /api/accuracy?gate_closure=09:20&confidence=0.9&lookback_days=30` | January backtest: summary, calibration, by day/hour, histogram, series |
| `GET /api/accuracy/horizon` | Error by lead time across all runs |

Interactive docs: `/api/docs`.

## Key assumptions

- A decision on day **D−1** covers UK delivery day **D** (00:00–24:00, 48 settlement periods). Decision days are 1–31 Jan 2026.
- The forecast used is the **latest `WINDFOR` run with `publishTime` ≤ the auction deadline**. The default deadline is the EPEX GB day-ahead auction at 09:20 UK; N2EX closes at 09:50.
- Hourly forecasts are linearly interpolated to half-hours. Error = actual − forecast.
- Risk bands use only errors from half-hours that had already been settled before each deadline, so there is no look-ahead.
- Both datasets cover transmission-metered wind. Embedded wind is excluded. `FUELHH` is metered output after curtailment, which likely explains much of the over-forecast bias.

See [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) and the in-app Methodology page for details.

## Deployment

Deployed on **Vercel**. `vercel.json` builds the Vite app to static files and serves `api/index.py` (FastAPI via ASGI) as a Python serverless function, with the data snapshot bundled alongside. A rewrite sends `/api/*` to the function, and every other path falls back to `index.html` for client-side routing.

## Use of AI tools

This project was built with substantial help from **Claude Code**, Anthropic's AI coding agent. It was used for:

- domain research, such as the GB day-ahead auction deadlines;
- solution design;
- backend and frontend implementation;
- tests;
- documentation.

Results were checked against the raw Elexon API and by the automated test suites.
