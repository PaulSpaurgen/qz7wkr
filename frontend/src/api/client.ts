import type { Accuracy, DayAhead, Horizon, Meta, Vintages } from './types'

const BASE = import.meta.env.VITE_API_BASE ?? ''

type Params = Record<string, string | number | null | undefined>

export function buildUrl(path: string, params: Params = {}): string {
  const qs = new URLSearchParams()
  for (const [k, v] of Object.entries(params)) {
    if (v !== null && v !== undefined && v !== '') qs.set(k, String(v))
  }
  const q = qs.toString()
  return `${BASE}${path}${q ? `?${q}` : ''}`
}

async function get<T>(path: string, params: Params, signal?: AbortSignal): Promise<T> {
  const res = await fetch(buildUrl(path, params), { signal })
  if (!res.ok) {
    let detail = res.statusText
    try {
      const body = await res.json()
      detail = typeof body.detail === 'string' ? body.detail : JSON.stringify(body.detail)
    } catch {
      /* non-JSON error body */
    }
    throw new Error(`${res.status}: ${detail}`)
  }
  return res.json() as Promise<T>
}

export interface Settings {
  gateClosure: string
  confidence: number
  lookbackDays: number
}

export const api = {
  meta: (signal?: AbortSignal) => get<Meta>('/api/meta', {}, signal),
  dayAhead: (decisionDate: string, s: Settings, demandMw: number | null, signal?: AbortSignal) =>
    get<DayAhead>(
      '/api/day-ahead',
      {
        decision_date: decisionDate,
        gate_closure: s.gateClosure,
        confidence: s.confidence,
        lookback_days: s.lookbackDays,
        demand_mw: demandMw,
      },
      signal,
    ),
  vintages: (deliveryDate: string, gateClosure: string, signal?: AbortSignal) =>
    get<Vintages>('/api/vintages', { delivery_date: deliveryDate, gate_closure: gateClosure }, signal),
  accuracy: (s: Settings, signal?: AbortSignal) =>
    get<Accuracy>(
      '/api/accuracy',
      { gate_closure: s.gateClosure, confidence: s.confidence, lookback_days: s.lookbackDays },
      signal,
    ),
  horizon: (signal?: AbortSignal) => get<Horizon>('/api/accuracy/horizon', {}, signal),
}
