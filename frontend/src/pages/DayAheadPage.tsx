import { useState } from 'react'
import { api } from '../api/client'
import { DayAheadChart } from '../components/DayAheadChart'
import { EvolutionChart } from '../components/EvolutionChart'
import { SettingsBar } from '../components/SettingsBar'
import { ErrorBox, Kpi, Loading, Panel } from '../components/ui'
import { useApi } from '../hooks/useApi'
import { addDays, fmtDate, fmtDuration, fmtGwh, fmtMw, fmtPct, fmtSigned, fmtTime } from '../lib/format'
import { useSettings } from '../state/settings'

export function DayAheadPage() {
  const { meta, settings } = useSettings()
  const [decisionDate, setDecisionDate] = useState('2026-01-15')
  const [demandInput, setDemandInput] = useState('')
  const [showActual, setShowActual] = useState(false)
  const demandMw = demandInput.trim() === '' ? null : Number(demandInput)
  const validDemand = demandMw === null || (Number.isFinite(demandMw) && demandMw >= 0)
  const deliveryDate = addDays(decisionDate, 1)

  const da = useApi(
    (s) => api.dayAhead(decisionDate, settings, validDemand ? demandMw : null, s),
    [decisionDate, settings, validDemand ? demandMw : null],
  )
  const vint = useApi((s) => api.vintages(deliveryDate, settings.gateClosure, s), [deliveryDate, settings.gateClosure])

  const canPrev = decisionDate > meta.decision_start
  const canNext = decisionDate < meta.decision_end
  const d = da.data
  const pct = Math.round(settings.confidence * 100)

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight text-ink">How much wind can we count on tomorrow?</h1>
        <p className="mt-1 max-w-3xl text-[14px] text-ink-2">
          The latest national wind forecast available at the day-ahead auction deadline, with a risk range
          calibrated on recent forecast errors, so you can size the extra power to buy.
        </p>
      </div>

      <div className="flex flex-wrap items-end gap-x-6 gap-y-4 rounded-xl border border-line bg-surface p-4">
        <div className="flex flex-col gap-1">
          <span className="text-[11px] font-medium tracking-wide text-muted uppercase">Decision day</span>
          <div className="flex items-center gap-1">
            <button
              aria-label="Previous day"
              disabled={!canPrev}
              onClick={() => setDecisionDate(addDays(decisionDate, -1))}
              className="h-[34px] w-8 rounded-lg border border-line text-ink-2 hover:text-ink disabled:opacity-40"
            >
              ‹
            </button>
            <input
              type="date"
              aria-label="Decision day"
              value={decisionDate}
              min={meta.decision_start}
              max={meta.decision_end}
              onChange={(e) => e.target.value && setDecisionDate(e.target.value)}
              className="h-[34px] rounded-lg border border-line bg-surface px-2 text-[13px] text-ink"
            />
            <button
              aria-label="Next day"
              disabled={!canNext}
              onClick={() => setDecisionDate(addDays(decisionDate, 1))}
              className="h-[34px] w-8 rounded-lg border border-line text-ink-2 hover:text-ink disabled:opacity-40"
            >
              ›
            </button>
          </div>
        </div>
        <SettingsBar />
        <label className="flex flex-col gap-1">
          <span className="text-[11px] font-medium tracking-wide text-muted uppercase">Expected demand (optional)</span>
          <span className="flex items-center gap-1.5">
            <input
              inputMode="numeric"
              placeholder="e.g. 30000"
              value={demandInput}
              onChange={(e) => setDemandInput(e.target.value.replace(/[^\d.]/g, ''))}
              className={`h-[34px] w-32 rounded-lg border bg-surface px-2 text-[13px] text-ink ${validDemand ? 'border-line' : 'border-critical'}`}
            />
            <span className="text-[13px] text-ink-2">MW</span>
          </span>
        </label>
      </div>

      <p className="text-[13.5px] text-ink-2">
        Bids due <b className="text-ink">{fmtDate(decisionDate)} at {settings.gateClosure}</b> for delivery on{' '}
        <b className="text-ink">{fmtDate(deliveryDate, { weekday: 'long' })}</b> (00:00–24:00, 48 half-hours).
      </p>

      {da.error && <ErrorBox message={da.error} />}
      {!d && !da.error && <Loading />}
      {d && (
        <div className={`space-y-5 transition-opacity ${da.loading ? 'opacity-60' : ''}`}>
          <div className={`grid grid-cols-1 gap-3 sm:grid-cols-2 ${d.procurement ? 'lg:grid-cols-5' : 'lg:grid-cols-4'}`}>
            <Kpi
              label="Forecast used"
              value={d.forecast_run ? `${fmtTime(d.forecast_run.publish_time)} run` : 'None available'}
              sub={
                d.forecast_run
                  ? `Published ${fmtDate(d.forecast_run.publish_time)}, ${fmtDuration(d.forecast_run.age_minutes)} before the deadline. Looks ${d.forecast_run.lead_hours_min.toFixed(1)}–${d.forecast_run.lead_hours_max.toFixed(0)} h ahead.`
                  : 'No forecast was published before this deadline.'
              }
            />
            <Kpi
              label="Forecast wind energy"
              value={fmtGwh(d.kpis.forecast_mwh)}
              sub={`Average ${fmtMw(d.kpis.mean_mw)} · peak ${fmtMw(d.kpis.peak_mw)} · low ${fmtMw(d.kpis.min_mw)}`}
            />
            <Kpi
              label="Expected (bias-adjusted)"
              value={fmtGwh(d.kpis.expected_mwh)}
              sub={
                d.uncertainty.q_mid !== null
                  ? `Forecast shifted by the median error of the last ${d.uncertainty.lookback_days} days (${fmtSigned(d.uncertainty.q_mid, 'MW')})`
                  : 'Not enough history'
              }
            />
            <Kpi
              label={`Firm wind · ${pct}% confidence`}
              value={fmtGwh(d.kpis.firm_mwh)}
              sub={`In ${pct}% of recent half-hours, wind came in at or above this level.`}
            />
            {d.procurement && (
              <Kpi
                label="Power to buy"
                value={fmtGwh(d.procurement.need_vs_firm_mwh)}
                sub={
                  d.procurement.risk_buffer_mwh !== null
                    ? `Covers demand at ${pct}% confidence: ${fmtGwh(d.procurement.need_vs_forecast_mwh)} to cover the forecast, plus a ${fmtGwh(d.procurement.risk_buffer_mwh)} risk buffer`
                    : undefined
                }
              />
            )}
          </div>

          <Panel
            title={`Wind generation forecast · ${fmtDate(deliveryDate, { weekday: 'long' })}`}
            subtitle={`Half-hourly national wind (GW). The shaded range is the P${100 - pct}–P${pct} spread of past day-ahead errors over the last ${d.uncertainty.lookback_days} days (${d.uncertainty.n_samples.toLocaleString('en-GB')} half-hours).`}
            actions={
              <label className="inline-flex cursor-pointer items-center gap-2 text-[13px] text-ink-2 select-none">
                <input type="checkbox" checked={showActual} onChange={(e) => setShowActual(e.target.checked)} className="accent-[var(--s-actual)]" />
                Reveal actuals (hindsight)
              </label>
            }
          >
            <DayAheadChart series={d.series} showActual={showActual} confidence={settings.confidence} />
            {showActual && d.hindsight && (
              <div className="mt-4 grid grid-cols-2 gap-3 border-t border-line pt-4 text-[13px] sm:grid-cols-4">
                <Stat label="Actual wind energy" value={fmtGwh(d.hindsight.actual_mwh)} />
                <Stat
                  label="Actual vs forecast"
                  value={`${fmtSigned(d.hindsight.error_mwh / 1000, 'GWh', 1)} (${fmtPct((100 * d.hindsight.error_mwh) / (d.kpis.forecast_mwh ?? 1))})`}
                />
                <Stat label="Mean absolute error" value={fmtMw(d.hindsight.mae)} />
                <Stat
                  label="Half-hours below firm wind"
                  value={`${d.hindsight.firm_breaches} of ${d.hindsight.slots}`}
                  tone={d.hindsight.firm_breaches / d.hindsight.slots > 1 - settings.confidence ? 'critical' : 'good'}
                />
              </div>
            )}
          </Panel>
        </div>
      )}

      <Panel
        title="How the forecast for this day changed"
        subtitle="Each dot is one forecast run's average (GW) for the delivery day. Runs published after the deadline arrive too late to trade on."
      >
        {vint.error && <ErrorBox message={vint.error} />}
        {vint.data ? <EvolutionChart data={vint.data} /> : !vint.error && <Loading />}
      </Panel>
    </div>
  )
}

function Stat({ label, value, tone }: { label: string; value: string; tone?: 'good' | 'critical' }) {
  return (
    <div>
      <div className="text-ink-2">{label}</div>
      <div className={`tabular mt-0.5 text-[16px] font-semibold ${tone === 'critical' ? 'text-critical' : tone === 'good' ? 'text-good' : 'text-ink'}`}>
        {value}
      </div>
    </div>
  )
}
