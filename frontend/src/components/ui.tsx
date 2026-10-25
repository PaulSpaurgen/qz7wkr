import type { ReactNode } from 'react'

export function Panel({
  title,
  subtitle,
  actions,
  children,
  className = '',
}: {
  title: string
  subtitle?: ReactNode
  actions?: ReactNode
  children: ReactNode
  className?: string
}) {
  return (
    <section className={`min-w-0 rounded-xl border border-line bg-surface p-4 sm:p-5 ${className}`}>
      <header className="mb-3 flex flex-wrap items-start justify-between gap-2">
        <div>
          <h2 className="text-[15px] font-semibold text-ink">{title}</h2>
          {subtitle && <p className="mt-0.5 text-[13px] text-ink-2">{subtitle}</p>}
        </div>
        {actions}
      </header>
      {children}
    </section>
  )
}

export function Kpi({
  label,
  value,
  sub,
  tone,
}: {
  label: string
  value: ReactNode
  sub?: ReactNode
  tone?: 'good' | 'critical'
}) {
  const toneCls = tone === 'good' ? 'text-good' : tone === 'critical' ? 'text-critical' : 'text-ink'
  return (
    <div className="rounded-xl border border-line bg-surface p-4">
      <div className="text-[12px] font-medium tracking-wide text-ink-2 uppercase">{label}</div>
      <div className={`mt-1.5 text-2xl font-semibold ${toneCls}`}>{value}</div>
      {sub && <div className="mt-1 text-[12.5px] leading-snug text-ink-2">{sub}</div>}
    </div>
  )
}

export function LegendItem({ color, label, dashed, area }: { color: string; label: string; dashed?: boolean; area?: boolean }) {
  return (
    <span className="inline-flex items-center gap-1.5 text-[12.5px] text-ink-2">
      {area ? (
        <span className="inline-block h-2.5 w-4 rounded-sm" style={{ background: color }} />
      ) : (
        <svg width="18" height="6" aria-hidden>
          <line x1="1" y1="3" x2="17" y2="3" stroke={color} strokeWidth="2" strokeDasharray={dashed ? '4 3' : undefined} strokeLinecap="round" />
        </svg>
      )}
      {label}
    </span>
  )
}

export function Legend({ children }: { children: ReactNode }) {
  return <div className="mb-2 flex flex-wrap gap-x-4 gap-y-1">{children}</div>
}

export function Loading({ label = 'Loading…' }: { label?: string }) {
  return (
    <div className="flex h-40 items-center justify-center text-sm text-muted" role="status">
      <span className="mr-2 inline-block h-3 w-3 animate-spin rounded-full border-2 border-accent border-t-transparent" />
      {label}
    </div>
  )
}

export function ErrorBox({ message }: { message: string }) {
  return (
    <div role="alert" className="rounded-lg border border-critical/40 bg-critical/10 p-3 text-sm text-critical">
      Couldn’t load data — {message}
    </div>
  )
}

/** Tooltip shell shared by all charts: values lead, labels follow, line-keys identify series. */
export function TooltipCard({ title, rows }: { title: string; rows: { color?: string; label: string; value: string; dashed?: boolean }[] }) {
  return (
    <div className="min-w-44 rounded-lg border border-line bg-surface px-3 py-2 text-[12.5px] shadow-lg">
      <div className="mb-1 font-medium text-ink-2">{title}</div>
      {rows.map((r) => (
        <div key={r.label} className="flex items-center justify-between gap-4 py-0.5">
          <span className="inline-flex items-center gap-1.5 text-ink-2">
            {r.color && (
              <svg width="12" height="6" aria-hidden>
                <line x1="1" y1="3" x2="11" y2="3" stroke={r.color} strokeWidth="2" strokeDasharray={r.dashed ? '3 2' : undefined} />
              </svg>
            )}
            {r.label}
          </span>
          <span className="tabular font-semibold text-ink">{r.value}</span>
        </div>
      ))}
    </div>
  )
}

export function Segmented<T extends string | number>({
  label,
  value,
  options,
  onChange,
}: {
  label: string
  value: T
  options: { value: T; label: string }[]
  onChange: (v: T) => void
}) {
  return (
    <div className="flex flex-col gap-1">
      <span className="text-[11px] font-medium tracking-wide text-muted uppercase">{label}</span>
      <div role="radiogroup" aria-label={label} className="inline-flex rounded-lg border border-line bg-surface-2 p-0.5">
        {options.map((o) => (
          <button
            key={String(o.value)}
            role="radio"
            aria-checked={o.value === value}
            onClick={() => onChange(o.value)}
            className={`rounded-md px-2.5 py-1 text-[13px] whitespace-nowrap transition-colors ${
              o.value === value ? 'bg-surface font-semibold text-ink shadow-sm' : 'text-ink-2 hover:text-ink'
            }`}
          >
            {o.label}
          </button>
        ))}
      </div>
    </div>
  )
}
