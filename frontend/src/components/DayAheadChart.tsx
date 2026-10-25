import { Area, CartesianGrid, ComposedChart, Line, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import type { SeriesPoint } from '../api/types'
import { fmtMw, fmtTime } from '../lib/format'
import { Legend, LegendItem, TooltipCard } from './ui'

const gw = (v: number) => (v / 1000).toFixed(0)

export function DayAheadChart({
  series,
  showActual,
  confidence,
}: {
  series: SeriesPoint[]
  showActual: boolean
  confidence: number
}) {
  const pct = Math.round(confidence * 100)
  const data = series.map((s) => ({ ...s, band: s.low !== null && s.high !== null ? [s.low, s.high] : null }))
  const ticks = series.filter((_, i) => i % 6 === 0).map((s) => s.time)

  return (
    <div>
      <Legend>
        <LegendItem color="var(--s-forecast)" label="Published forecast" />
        <LegendItem color="var(--s-expected)" label="Expected (bias-adjusted)" dashed />
        <LegendItem color="var(--band)" label={`${100 - pct}–${pct}% range`} area />
        <LegendItem color="var(--firm)" label={`Firm wind (P${100 - pct})`} dashed />
        {showActual && <LegendItem color="var(--s-actual)" label="Actual (hindsight)" />}
      </Legend>
      <div className="h-[340px] w-full">
        <ResponsiveContainer>
          <ComposedChart data={data} margin={{ top: 8, right: 8, bottom: 0, left: -12 }}>
            <CartesianGrid vertical={false} />
            <XAxis dataKey="time" ticks={ticks} tickFormatter={fmtTime} tickLine={false} minTickGap={16} />
            <YAxis
              tickFormatter={gw}
              tickLine={false}
              axisLine={false}
              width={52}
            />
            <Tooltip
              cursor={{ stroke: 'var(--axis)', strokeWidth: 1 }}
              content={({ active, payload }) => {
                if (!active || !payload?.length) return null
                const d = payload[0].payload as SeriesPoint
                const rows = [
                  { color: 'var(--s-forecast)', label: 'Forecast', value: fmtMw(d.forecast) },
                  { color: 'var(--s-expected)', label: 'Expected', value: fmtMw(d.expected), dashed: true },
                  { label: `Range P${100 - pct}–P${pct}`, value: `${fmtMw(d.low)} – ${fmtMw(d.high)}` },
                  { color: 'var(--firm)', label: 'Firm wind', value: fmtMw(d.firm), dashed: true },
                ]
                if (showActual) rows.push({ color: 'var(--s-actual)', label: 'Actual', value: fmtMw(d.actual) })
                return <TooltipCard title={`${fmtTime(d.time)} – ${fmtTime(new Date(new Date(d.time).getTime() + 1800e3).toISOString())}`} rows={rows} />
              }}
            />
            <Area dataKey="band" stroke="none" fill="var(--band)" fillOpacity={0.7} isAnimationActive={false} />
            <Line dataKey="firm" stroke="var(--firm)" strokeWidth={1.5} strokeDasharray="4 3" dot={false} isAnimationActive={false} />
            <Line dataKey="expected" stroke="var(--s-expected)" strokeWidth={2} strokeDasharray="6 4" dot={false} isAnimationActive={false} />
            <Line dataKey="forecast" stroke="var(--s-forecast)" strokeWidth={2.25} dot={false} activeDot={{ r: 4 }} isAnimationActive={false} />
            {showActual && (
              <Line dataKey="actual" stroke="var(--s-actual)" strokeWidth={2.25} dot={false} activeDot={{ r: 4 }} isAnimationActive={false} />
            )}
          </ComposedChart>
        </ResponsiveContainer>
      </div>
    </div>
  )
}
