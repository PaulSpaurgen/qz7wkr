import { CartesianGrid, ReferenceLine, ResponsiveContainer, Scatter, ScatterChart, Tooltip, XAxis, YAxis } from 'recharts'
import type { Vintages } from '../api/types'
import { fmtDateTime, fmtMw } from '../lib/format'
import { Legend, LegendItem, TooltipCard } from './ui'

/** Average forecast for one delivery day, per forecast run, against the run's publish time. */
export function EvolutionChart({ data }: { data: Vintages }) {
  const points = data.runs.map((r) => ({
    t: new Date(r.publish_time).getTime(),
    mw: r.mean_mw,
    publish: r.publish_time,
    beforeGate: r.before_gate,
    selected: r.publish_time === data.selected_publish_time,
  }))
  const actualMean = data.actuals.length ? data.actuals.reduce((a, [, v]) => a + v, 0) / data.actuals.length : null
  const gate = new Date(data.gate_closure).getTime()
  // One tick per UK midnight between the first and last run.
  const ticks: number[] = []
  if (points.length) {
    const first = new Date(points[0].t)
    for (let t = Date.UTC(first.getUTCFullYear(), first.getUTCMonth(), first.getUTCDate() + 1); t <= points[points.length - 1].t; t += 864e5) ticks.push(t)
  }
  const before = points.filter((p) => p.beforeGate && !p.selected)
  const after = points.filter((p) => !p.beforeGate)
  const selected = points.filter((p) => p.selected)

  return (
    <div>
      <Legend>
        <LegendItem color="var(--s-forecast)" label="Available before deadline" area />
        <LegendItem color="var(--ghost)" label="Published after deadline" area />
        {actualMean !== null && <LegendItem color="var(--s-actual)" label="Actual daily average" dashed />}
      </Legend>
      <div className="h-[230px] w-full">
        <ResponsiveContainer>
          <ScatterChart margin={{ top: 16, right: 12, bottom: 0, left: -12 }}>
            <CartesianGrid vertical={false} />
            <XAxis
              type="number"
              dataKey="t"
              domain={['dataMin', 'dataMax']}
              scale="time"
              tickFormatter={(t) => new Date(t).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', timeZone: 'Europe/London' })}
              ticks={ticks}
              tickLine={false}
            />
            <YAxis type="number" dataKey="mw" tickFormatter={(v) => (v / 1000).toFixed(1)} tickLine={false} axisLine={false} width={52} domain={['auto', 'auto']} />
            <ReferenceLine x={gate} stroke="var(--ink-2)" strokeDasharray="3 3" label={{ value: 'Deadline', position: 'top', fill: 'var(--ink-2)', fontSize: 11 }} />
            {actualMean !== null && <ReferenceLine y={actualMean} stroke="var(--s-actual)" strokeDasharray="5 4" strokeWidth={1.5} />}
            <Tooltip
              cursor={false}
              content={({ active, payload }) => {
                if (!active || !payload?.length) return null
                const p = payload[0].payload as (typeof points)[number]
                return (
                  <TooltipCard
                    title={`Run published ${fmtDateTime(p.publish)}`}
                    rows={[
                      { label: 'Avg forecast for the day', value: fmtMw(p.mw) },
                      ...(actualMean !== null ? [{ label: 'Actual average', value: fmtMw(actualMean) }] : []),
                      { label: 'Status', value: p.selected ? 'Used for the decision' : p.beforeGate ? 'Superseded' : 'Too late' },
                    ]}
                  />
                )
              }}
            />
            <Scatter data={before} fill="var(--s-forecast)" fillOpacity={0.45} isAnimationActive={false} />
            <Scatter data={after} fill="var(--ghost)" isAnimationActive={false} />
            <Scatter
              data={selected}
              isAnimationActive={false}
              shape={(p: { cx?: number; cy?: number }) => (
                <circle cx={p.cx} cy={p.cy} r={7} fill="var(--s-forecast)" stroke="var(--surface)" strokeWidth={2} />
              )}
            />
          </ScatterChart>
        </ResponsiveContainer>
      </div>
    </div>
  )
}
