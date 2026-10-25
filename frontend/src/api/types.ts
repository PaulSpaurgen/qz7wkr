// Response shapes of the FastAPI backend (see backend/app/analysis.py).

export interface Meta {
  decision_start: string
  decision_end: string
  default_gate_closure: string
  gate_closures: Record<string, string>
  default_confidence: number
  default_lookback_days: number
  data: {
    fetched_at: string
    actuals_from: string
    actuals_to: string
    forecast_runs: number
    publish_times_utc: string[]
  }
}

export interface SeriesPoint {
  time: string
  forecast: number | null
  expected: number | null
  low: number | null
  high: number | null
  firm: number | null
  actual: number | null
}

export interface DayAhead {
  decision_date: string
  delivery_date: string
  gate_closure: string
  forecast_run: {
    publish_time: string
    age_minutes: number
    lead_hours_min: number
    lead_hours_max: number
  } | null
  uncertainty: {
    confidence: number
    lookback_days: number
    n_samples: number
    q_low: number | null
    q_mid: number | null
    q_high: number | null
  }
  series: SeriesPoint[]
  kpis: {
    slots: number
    forecast_slots: number
    forecast_mwh: number | null
    expected_mwh: number | null
    firm_mwh: number | null
    mean_mw: number | null
    peak_mw: number | null
    min_mw: number | null
  }
  hindsight: {
    actual_mwh: number
    error_mwh: number
    mae: number
    firm_breaches: number
    slots: number
  } | null
  procurement: {
    demand_mw: number
    demand_mwh: number
    need_vs_forecast_mwh: number
    need_vs_firm_mwh: number | null
    risk_buffer_mwh: number | null
  } | null
}

export interface Vintages {
  delivery_date: string
  gate_closure: string
  selected_publish_time: string | null
  runs: { publish_time: string; before_gate: boolean; mean_mw: number; points: [string, number][] }[]
  actuals: [string, number][]
}

export interface Summary {
  n: number
  mae: number
  rmse: number
  bias: number
  nmae_pct: number | null
  p50_abs: number
  p90_abs: number
  p95_abs: number
  max_shortfall: number
  max_surplus: number
  mean_actual: number
  mean_forecast: number
  correlation: number | null
}

export interface Accuracy {
  gate_closure_local: string
  decision_start: string
  decision_end: string
  summary: Summary
  bias_adjusted_summary: Summary
  calibration: {
    confidence: number
    lookback_days: number
    expected_breach_rate: number
    breach_rate: number | null
    n: number
  }
  by_day: {
    decision_date: string
    delivery_date: string
    lead_hours_min: number
    mae: number
    bias: number
    forecast_mwh: number
    actual_mwh: number
    energy_error_pct: number | null
    q_low: number | null
  }[]
  by_hour: { hour: number; mae: number; bias: number; p90_abs: number }[]
  histogram: { start: number; end: number; count: number }[]
  timeseries: { time: string; forecast: number; actual: number }[]
  lead_hours: { min: number; max: number }
}

export interface Horizon {
  bucket_hours: number
  buckets: { lead_from: number; lead_to: number; n: number; mae: number; rmse: number; bias: number; nmae_pct: number }[]
}
