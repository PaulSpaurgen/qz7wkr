import { api } from '../api/client'
import type { Accuracy, Summary } from '../api/types'
import { DailyErrorChart, HistogramChart, HorizonChart, HourChart, MonthChart, ScatterFit } from '../components/AccuracyCharts'
import { SettingsBar } from '../components/SettingsBar'
import { ErrorBox, Kpi, Loading, Panel } from '../components/ui'
import { useApi } from '../hooks/useApi'
import { fmtDate, fmtGwh, fmtMw, fmtPct, fmtSigned } from '../lib/format'
import { useSettings } from '../state/settings'

export function AccuracyPage() {
  const { settings } = useSettings()
  const acc = useApi((s) => api.accuracy(settings, s), [settings])
  const hor = useApi((s) => api.horizon(s), [])
  const a = acc.data
  const pct = Math.round(settings.confidence * 100)

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight text-ink">How far can we trust the day-ahead forecast?</h1>
        <p className="mt-1 max-w-3xl text-[14px] text-ink-2">
          A backtest of every purchase decision in January 2026: the forecast available at each day’s deadline, compared
          with the wind that was actually generated the following day.
        </p>
      </div>

      <div className="rounded-xl border border-line bg-surface p-4">
        <SettingsBar />
      </div>

      {acc.error && <ErrorBox message={acc.error} />}
      {!a && !acc.error && <Loading />}
      {a && a.summary.n > 0 && (
        <div className={`space-y-5 transition-opacity ${acc.loading ? 'opacity-60' : ''}`}>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <Kpi
              label="Typical error (MAE)"
              value={fmtMw(a.summary.mae)}
              sub={`${fmtPct(a.summary.nmae_pct)} of average wind output · RMSE ${fmtMw(a.summary.rmse)}`}
            />
            <Kpi
              label="Systematic bias"
              value={fmtSigned(a.summary.bias, 'MW')}
              tone={Math.abs(a.summary.bias) > 0.3 * a.summary.mae ? 'critical' : undefined}
              sub={
                a.summary.bias < 0
                  ? `The forecast over-predicted delivered wind by ${fmtPct((-100 * a.summary.bias) / a.summary.mean_forecast)} on average`
                  : `The forecast under-predicted delivered wind by ${fmtPct((100 * a.summary.bias) / a.summary.mean_forecast)} on average`
              }
            />
            <Kpi
              label="Bad half-hours (P90 error)"
              value={fmtMw(a.summary.p90_abs)}
              sub={`1 in 10 half-hours missed by more than this. Worst shortfall: ${fmtMw(a.summary.max_shortfall)}`}
            />
            <Kpi
              label="Firm-wind reliability"
              value={a.calibration.breach_rate !== null ? fmtPct(100 * (1 - a.calibration.breach_rate)) : '–'}
              tone={a.calibration.breach_rate !== null && a.calibration.breach_rate <= a.calibration.expected_breach_rate + 0.02 ? 'good' : 'critical'}
              sub={`Wind met the ${pct}% firm level ${a.calibration.breach_rate !== null ? fmtPct(100 * (1 - a.calibration.breach_rate)) : '–'} of the time (target ${pct}%), using only past errors on each day`}
            />
          </div>

          <Insights a={a} />

          <Panel title="Forecast vs actual · January 2026 deliveries" subtitle="Half-hourly national wind generation (GW). Each day shows the forecast available at that day’s deadline.">
            <MonthChart data={a.timeseries} />
          </Panel>

          <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">
            <Panel title="Daily energy error" subtitle="Actual minus forecast wind energy for each delivery day, as % of forecast">
              <DailyErrorChart data={a.by_day} />
            </Panel>
            <Panel title="Error distribution" subtitle="Half-hourly errors. Left of zero = less wind than forecast, so more power to buy">
              <HistogramChart data={a.histogram} />
            </Panel>
            <Panel title="Error by time of day" subtitle="Mean absolute error (GW) by delivery hour, UK time">
              <HourChart data={a.by_hour} />
            </Panel>
            <Panel
              title="Error vs how far ahead"
              subtitle="Mean absolute error (GW) of all forecast runs, grouped by lead time. Day-ahead decisions sit in the shaded range."
            >
              {hor.error && <ErrorBox message={hor.error} />}
              {hor.data ? <HorizonChart data={hor.data} dayAhead={a.lead_hours} /> : !hor.error && <Loading />}
            </Panel>
            <Panel title="Forecast vs actual, every half-hour" subtitle="Actual (y) vs forecast (x), GW. Points on the dashed line are perfect forecasts. Points below it had less wind than forecast.">
              <ScatterFit data={a.timeseries} />
            </Panel>
            <Panel title="Bias correction" subtitle="Shifting each day’s forecast by the median of past errors (no look-ahead)">
              <BiasTable a={a} />
            </Panel>
          </div>

          <Panel title="Daily breakdown" subtitle="One row per purchase decision">
            <DailyTable rows={a.by_day} />
          </Panel>
        </div>
      )}
    </div>
  )
}

function Insights({ a }: { a: Accuracy }) {
  const worstHour = [...a.by_hour].sort((x, y) => y.mae - x.mae)[0]
  const bestHour = [...a.by_hour].sort((x, y) => x.mae - y.mae)[0]
  const improvement = 100 * (1 - a.bias_adjusted_summary.mae / a.summary.mae)
  const shortDays = a.by_day.filter((d) => (d.energy_error_pct ?? 0) < -10).length
  const items = [
    `Delivered wind fell short of the forecast on ${a.by_day.filter((d) => d.forecast_mwh > d.actual_mwh).length} of ${a.by_day.length} days, and fell more than 10% short on ${shortDays}. Planning on the raw forecast leaves you short.`,
    `Correcting for recent bias cuts the typical error by ${improvement.toFixed(0)}% (MAE ${fmtMw(a.summary.mae)} → ${fmtMw(a.bias_adjusted_summary.mae)}).`,
    `Errors peak around ${String(worstHour.hour).padStart(2, '0')}:00 (MAE ${fmtMw(worstHour.mae)}) and are smallest around ${String(bestHour.hour).padStart(2, '0')}:00 (${fmtMw(bestHour.mae)}).`,
  ]
  return (
    <ul className="grid grid-cols-1 gap-3 lg:grid-cols-3">
      {items.map((t) => (
        <li key={t} className="rounded-xl border border-line bg-surface-2 p-3.5 text-[13.5px] leading-snug text-ink">
          {t}
        </li>
      ))}
    </ul>
  )
}

function BiasTable({ a }: { a: Accuracy }) {
  const rows: [string, (s: Summary) => string][] = [
    ['MAE', (s) => fmtMw(s.mae)],
    ['RMSE', (s) => fmtMw(s.rmse)],
    ['Bias', (s) => fmtSigned(s.bias, 'MW')],
    ['nMAE', (s) => fmtPct(s.nmae_pct)],
    ['P90 absolute error', (s) => fmtMw(s.p90_abs)],
    ['Worst shortfall', (s) => fmtMw(s.max_shortfall)],
  ]
  return (
    <table className="tabular w-full text-[13.5px]">
      <thead>
        <tr className="border-b border-line text-left text-ink-2">
          <th className="py-2 font-medium">Metric</th>
          <th className="py-2 text-right font-medium">Published forecast</th>
          <th className="py-2 text-right font-medium">Bias-adjusted</th>
        </tr>
      </thead>
      <tbody>
        {rows.map(([label, f]) => (
          <tr key={label} className="border-b border-line last:border-0">
            <td className="py-2 text-ink-2">{label}</td>
            <td className="py-2 text-right text-ink">{f(a.summary)}</td>
            <td className="py-2 text-right font-semibold text-ink">{f(a.bias_adjusted_summary)}</td>
          </tr>
        ))}
      </tbody>
    </table>
  )
}

function DailyTable({ rows }: { rows: Accuracy['by_day'] }) {
  return (
    <div className="max-h-[420px] overflow-auto">
      <table className="tabular w-full min-w-[640px] text-[13px]">
        <thead className="sticky top-0 bg-surface">
          <tr className="border-b border-line text-left text-ink-2">
            <th className="py-2 font-medium">Decision</th>
            <th className="py-2 font-medium">Delivery</th>
            <th className="py-2 text-right font-medium">Forecast</th>
            <th className="py-2 text-right font-medium">Actual</th>
            <th className="py-2 text-right font-medium">Energy error</th>
            <th className="py-2 text-right font-medium">MAE</th>
            <th className="py-2 text-right font-medium">Bias</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.decision_date} className="border-b border-line last:border-0 hover:bg-surface-2">
              <td className="py-1.5 text-ink-2">{fmtDate(r.decision_date)}</td>
              <td className="py-1.5 text-ink">{fmtDate(r.delivery_date)}</td>
              <td className="py-1.5 text-right">{fmtGwh(r.forecast_mwh)}</td>
              <td className="py-1.5 text-right">{fmtGwh(r.actual_mwh)}</td>
              <td className={`py-1.5 text-right font-medium ${(r.energy_error_pct ?? 0) < -10 ? 'text-critical' : 'text-ink'}`}>
                {fmtSigned(r.energy_error_pct ?? 0, '%', 1)}
              </td>
              <td className="py-1.5 text-right">{fmtMw(r.mae)}</td>
              <td className="py-1.5 text-right">{fmtSigned(r.bias, 'MW')}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
