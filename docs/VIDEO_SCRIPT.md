# Video script (≤ 10 min total)

Record at 1080p with the live Vercel URL open. Run the screen at about 110% zoom so the charts are legible. Timings are targets.

---

## Part 1: Customer pitch (≤ 5 min)

**Audience:** the utility's day-ahead trading team. **Goal:** show that it is useful, show the insight, and leave them wanting the next phase.

**0:00–0:30 · The problem in their words**
> "Every morning before 09:20 you commit tomorrow's purchases. Wind is your swing factor: on a windy day it covers a big share of demand, and on a calm day it covers very little. You need two answers: what is the latest wind forecast I can trade on, and how wrong is it likely to be? We built WindSight in a pilot on your January 2026 decisions to answer both."

**0:30–2:15 · Day-Ahead Desk (live demo)**
- Decision day **15 Jan**. Point out the deadline: *"EPEX 09:20 → the 07:30 run is the latest usable forecast. It was published 1 h 50 min earlier and looks 16.5–40 h ahead."* Toggle **N2EX 09:50** to show it switches to the 09:30 run.
- KPI cards: forecast 190.9 GWh, **expected (bias-adjusted) 169.8 GWh**, firm wind at 90%.
- Chart: forecast line, shaded P10–P90 band, dashed firm-wind line. *"This isn't a guess. The band comes from how wrong the forecast actually was over the previous 30 days, using only information you'd have had that morning."*
- Type a demand of **30,000 MW**. *"That's how much to buy, including the risk buffer you'd need to be 90% covered."*
- Tick **Reveal actuals**. Show where the actuals landed relative to the band.
- Scroll to the evolution chart: *"Here's how the forecast moved run by run. The grey runs came too late to trade on."*

**2:15–4:15 · Forecast Accuracy (the insight)**
- **MAE 2.0 GW (~18%)**, and the striking part, **bias −1.7 GW**: *"In January the forecast over-promised wind on 27 of 31 days, and 19 of those were short by more than 10%. If you plan on the raw forecast, you are systematically short and buying at the last minute."*
- **Bias correction cuts the error 28%** (bias table).
- **Firm-wind reliability 89.9% vs 90% target**: *"When we say you can count on X MW with 90% confidence, that held 90% of the time, tested out of sample."*
- Quick tour:
  - error-by-hour: worst in the early hours;
  - error vs lead time: forecasts degrade with horizon, and your decisions sit at 16–40 h;
  - histogram: skewed towards shortfall.

**4:15–5:00 · Close**
> "In short: you see the right forecast at the right moment, a quantified risk range you can trust, and a bias correction worth about 28% in accuracy. Next we'd add your demand forecast and prices to recommend bid volumes, plus live ingestion and alerts when a new run shifts your position."

---

## Part 2: Tech-lead walkthrough (≤ 5 min)

**Goal:** make the review easy and transfer knowledge.

**0:00–0:40 · Shape of the system.** Show the mermaid diagram in `docs/ARCHITECTURE.md`. Elexon → snapshot → `store` → `forecast` → `analysis` → FastAPI → React. Deployed on Vercel: a static Vite build plus one Python function. Docker Compose (api + nginx) runs locally. Dependencies point inward, and the domain and statistics code are pure.

**0:40–2:00 · The core logic (show code)**
- `forecast.py`: `gate_closure_utc` uses Europe/London time. `delivery_slots` handles 46/48/50 periods. `day_ahead_forecast` relies on `Dataset.latest_run_before`, a bisect over publish times with `≤ deadline`.
- `store.py` `ForecastRun.value_at`: hourly → half-hourly interpolation.
- `analysis.py` `trailing_quantiles`: only errors with `time < cutoff`, so there is no look-ahead. Mention the out-of-sample calibration check and why the default is 30 days (14 days under-covers at 13.4%).
- `metrics.py`: pure, numpy-compatible quantile with no pandas, which keeps cold start and bundle size small.

**2:00–2:50 · API & frontend**
- `main.py`: per-screen endpoints, Pydantic validation (422s), gzip, CDN cache headers. Open `/api/docs`.
- Frontend:
  - `api/client.ts` and `types.ts` give the typed contract;
  - `useApi` aborts stale requests and keeps the old data while reloading;
  - `SettingsProvider` shares the assumptions across pages;
  - the chart palette is colour-blind-validated, with designed dark mode and a responsive layout.

**2:50–3:50 · Quality**
- `pytest`: 35 tests. The synthetic dataset pins the selection rules, metrics are hand-computed, and Elexon is mocked with `MockTransport`.
- Vitest: 9 tests. Ruff, TypeScript build and oxlint.
- GitHub Actions CI runs lint, tests, build and `docker compose build`.
- Show a green CI run and `docker compose up`.

**3:50–5:00 · Trade-offs & next steps**
- A snapshot rather than a DB: the data is historical and the app is deterministic. For live operation, add scheduled ingestion into Postgres/Timescale.
- Pooled quantiles: the next step is error models conditioned on forecast level or lead time.
- Curtailment: FUELHH is post-curtailment, which is likely a large part of the bias. Bring in constraint data to separate the two.
- AI tooling: built with Claude Code, disclosed in the README.
