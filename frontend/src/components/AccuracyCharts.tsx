import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Line,
  LineChart,
  ReferenceArea,
  ReferenceLine,
  ResponsiveContainer,
  Scatter,
  ScatterChart,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
import type { Accuracy, Horizon } from '../api/types'
import { fmtDate, fmtDateTime, fmtMw, fmtPct, fmtSigned } from '../lib/format'
import { Legend, LegendItem, TooltipCard } from './ui'

const gw = (v: number) => (v / 1000).toFixed(0)
const CURSOR = { stroke: 'var(--axis)', strokeWidth: 1 }
const BAR_CURSOR = { fill: 'var(--surface-2)' }

export function MonthChart({ data }: { data: Accuracy['timeseries'] }) {
  // One tick per week (Mondays) keeps the axis readable.
  const ticks = data.filter((d) => d.time.endsWith('T00:00:00Z') && new Date(d.time).getUTCDay() === 1).map((d) => d.time)
  return (
    <div>
      <Legend>
        <LegendItem color="var(--s-forecast)" label="Day-ahead forecast" />
        <LegendItem color="var(--s-actual)" label="Actual" />
      </Legend>
      <div className="h-[280px]">
        <ResponsiveContainer>
          <LineChart data={data} margin={{ top: 8, right: 8, bottom: 0, left: -12 }}>
            <CartesianGrid vertical={false} />
            <XAxis dataKey="time" ticks={ticks} tickFormatter={(t) => fmtDate(t, { weekday: undefined })} tickLine={false} />
            <YAxis tickFormatter={gw} tickLine={false} axisLine={false} width={52} />
            <Tooltip
              cursor={CURSOR}
              content={({ active, payload }) => {
                if (!active || !payload?.length) return null
                const p = payload[0].payload as Accuracy['timeseries'][number]
                return (
                  <TooltipCard
                    title={fmtDateTime(p.time)}
                    rows={[
                      { color: 'var(--s-forecast)', label: 'Forecast', value: fmtMw(p.forecast) },
                      { color: 'var(--s-actual)', label: 'Actual', value: fmtMw(p.actual) },
                      { label: 'Error', value: fmtSigned(p.actual - p.forecast, 'MW') },
                    ]}
                  />
                )
              }}
            />
            <Line dataKey="forecast" stroke="var(--s-forecast)" strokeWidth={1.5} dot={false} isAnimationActive={false} />
            <Line dataKey="actual" stroke="var(--s-actual)" strokeWidth={1.5} dot={false} isAnimationActive={false} />
          </LineChart>
        </ResponsiveContainer>
      </div>
    </div>
  )
}

export function DailyErrorChart({ data }: { data: Accuracy['by_day'] }) {
  return (
    <div>
      <Legend>
        <LegendItem color="var(--neg)" label="Less wind than forecast" area />
        <LegendItem color="var(--pos)" label="More wind than forecast" area />
      </Legend>
      <div className="h-[240px]">
        <ResponsiveContainer>
          <BarChart data={data} margin={{ top: 8, right: 8, bottom: 0, left: -12 }} barCategoryGap={2}>
            <CartesianGrid vertical={false} />
            <XAxis dataKey="delivery_date" tickFormatter={(t) => String(Number(t.slice(8)))} tickLine={false} interval={2} />
            <YAxis tickFormatter={(v) => `${v}%`} tickLine={false} axisLine={false} width={52} />
            <ReferenceLine y={0} stroke="var(--axis)" />
            <Tooltip
              cursor={BAR_CURSOR}
              content={({ active, payload }) => {
                if (!active || !payload?.length) return null
                const p = payload[0].payload as Accuracy['by_day'][number]
                return (
                  <TooltipCard
                    title={`Delivery ${fmtDate(p.delivery_date)}`}
                    rows={[
                      { label: 'Energy error', value: fmtSigned(p.energy_error_pct ?? 0, '%', 1) },
                      { label: 'Forecast', value: `${(p.forecast_mwh / 1000).toFixed(1)} GWh` },
                      { label: 'Actual', value: `${(p.actual_mwh / 1000).toFixed(1)} GWh` },
                      { label: 'MAE', value: fmtMw(p.mae) },
                    ]}
                  />
                )
              }}
            />
            <Bar dataKey="energy_error_pct" radius={[3, 3, 3, 3]} isAnimationActive={false}>
              {data.map((d) => (
                <Cell key={d.delivery_date} fill={(d.energy_error_pct ?? 0) < 0 ? 'var(--neg)' : 'var(--pos)'} />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  )
}

export function HourChart({ data }: { data: Accuracy['by_hour'] }) {
  return (
    <div className="h-[240px]">
      <ResponsiveContainer>
        <BarChart data={data} margin={{ top: 8, right: 8, bottom: 0, left: -12 }} barCategoryGap={2}>
          <CartesianGrid vertical={false} />
          <XAxis dataKey="hour" tickFormatter={(h) => `${String(h).padStart(2, '0')}`} tickLine={false} interval={2} />
          <YAxis tickFormatter={(v) => (v / 1000).toFixed(1)} tickLine={false} axisLine={false} width={52} />
          <Tooltip
            cursor={BAR_CURSOR}
            content={({ active, payload }) => {
              if (!active || !payload?.length) return null
              const p = payload[0].payload as Accuracy['by_hour'][number]
              return (
                <TooltipCard
                  title={`${String(p.hour).padStart(2, '0')}:00–${String(p.hour).padStart(2, '0')}:59`}
                  rows={[
                    { color: 'var(--s-forecast)', label: 'Mean absolute error', value: fmtMw(p.mae) },
                    { label: 'Bias', value: fmtSigned(p.bias, 'MW') },
                    { label: '90th pct abs error', value: fmtMw(p.p90_abs) },
                  ]}
                />
              )
            }}
          />
          <Bar dataKey="mae" fill="var(--s-forecast)" radius={[4, 4, 0, 0]} isAnimationActive={false} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  )
}

export function HistogramChart({ data }: { data: Accuracy['histogram'] }) {
  const rows = data.map((b) => ({ ...b, mid: (b.start + b.end) / 2 }))
  return (
    <div className="h-[240px]">
      <ResponsiveContainer>
        <BarChart data={rows} margin={{ top: 8, right: 8, bottom: 0, left: -12 }} barCategoryGap={1}>
          <CartesianGrid vertical={false} />
          <XAxis
            dataKey="mid"
            tickFormatter={(v) => (v / 1000).toFixed(1)}
            tickLine={false}
            interval={1}
            label={{ value: 'actual − forecast (GW)', position: 'insideBottomRight', dy: 2, fontSize: 11 }}
            height={36}
          />
          <YAxis tickLine={false} axisLine={false} width={52} allowDecimals={false} />
          <Tooltip
            cursor={BAR_CURSOR}
            content={({ active, payload }) => {
              if (!active || !payload?.length) return null
              const p = payload[0].payload as (typeof rows)[number]
              return <TooltipCard title={`${fmtSigned(p.start, '')} to ${fmtSigned(p.end, 'MW')}`} rows={[{ label: 'Half-hours', value: String(p.count) }]} />
            }}
          />
          <Bar dataKey="count" radius={[3, 3, 0, 0]} isAnimationActive={false}>
            {rows.map((b) => (
              <Cell key={b.start} fill={b.mid < 0 ? 'var(--neg)' : 'var(--pos)'} />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  )
}

export function HorizonChart({ data, dayAhead }: { data: Horizon; dayAhead: { min: number; max: number } }) {
  const rows = data.buckets.map((b) => ({ ...b, mid: (b.lead_from + b.lead_to) / 2 }))
  return (
    <div>
      <Legend>
        <LegendItem color="var(--s-forecast)" label="MAE, all forecast runs" />
        <LegendItem color="var(--band)" label="Lead times used for day-ahead decisions" area />
      </Legend>
      <div className="h-[240px]">
        <ResponsiveContainer>
          <LineChart data={rows} margin={{ top: 8, right: 12, bottom: 0, left: -12 }}>
            <CartesianGrid vertical={false} />
            <ReferenceArea x1={dayAhead.min} x2={dayAhead.max} fill="var(--band)" fillOpacity={0.6} />
            <XAxis type="number" dataKey="mid" domain={[0, 72]} ticks={[0, 12, 24, 36, 48, 60, 72]} tickFormatter={(h) => `${h}h`} tickLine={false} />
            <YAxis tickFormatter={(v) => (v / 1000).toFixed(1)} tickLine={false} axisLine={false} width={52} domain={[0, 'auto']} />
            <Tooltip
              cursor={CURSOR}
              content={({ active, payload }) => {
                if (!active || !payload?.length) return null
                const p = payload[0].payload as (typeof rows)[number]
                return (
                  <TooltipCard
                    title={`${p.lead_from}–${p.lead_to} h ahead`}
                    rows={[
                      { color: 'var(--s-forecast)', label: 'MAE', value: fmtMw(p.mae) },
                      { label: 'nMAE', value: fmtPct(p.nmae_pct) },
                      { label: 'Bias', value: fmtSigned(p.bias, 'MW') },
                      { label: 'Samples', value: p.n.toLocaleString('en-GB') },
                    ]}
                  />
                )
              }}
            />
            <Line
              dataKey="mae"
              stroke="var(--s-forecast)"
              strokeWidth={2}
              dot={{ r: 3.5, fill: 'var(--s-forecast)', stroke: 'var(--surface)', strokeWidth: 2 }}
              isAnimationActive={false}
            />
          </LineChart>
        </ResponsiveContainer>
      </div>
    </div>
  )
}

export function ScatterFit({ data }: { data: Accuracy['timeseries'] }) {
  const max = Math.ceil(Math.max(...data.map((d) => Math.max(d.forecast, d.actual))) / 2000) * 2000
  return (
    <div className="h-[280px]">
      <ResponsiveContainer>
        <ScatterChart margin={{ top: 8, right: 12, bottom: 0, left: -12 }}>
          <CartesianGrid />
          <XAxis
            type="number"
            dataKey="forecast"
            domain={[0, max]}
            tickFormatter={gw}
            tickLine={false}
            label={{ value: 'Forecast (GW) →', position: 'insideBottomRight', dy: 2, fontSize: 11 }}
            height={36}
          />
          <YAxis type="number" dataKey="actual" domain={[0, max]} tickFormatter={gw} tickLine={false} axisLine={false} width={52} />
          <ReferenceLine segment={[{ x: 0, y: 0 }, { x: max, y: max }]} stroke="var(--ink-2)" strokeDasharray="4 4" />
          <Tooltip
            cursor={false}
            content={({ active, payload }) => {
              if (!active || !payload?.length) return null
              const p = payload[0].payload as Accuracy['timeseries'][number]
              return (
                <TooltipCard
                  title={fmtDateTime(p.time)}
                  rows={[
                    { label: 'Forecast', value: fmtMw(p.forecast) },
                    { label: 'Actual', value: fmtMw(p.actual) },
                  ]}
                />
              )
            }}
          />
          <Scatter
            data={data}
            isAnimationActive={false}
            shape={(p: { cx?: number; cy?: number }) => <circle cx={p.cx} cy={p.cy} r={2.5} fill="var(--s-forecast)" fillOpacity={0.4} />}
          />
        </ScatterChart>
      </ResponsiveContainer>
    </div>
  )
}
