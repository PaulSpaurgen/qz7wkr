// Number and time formatting. All times are shown in UK local time (Europe/London).

const UK = 'Europe/London'

export function fmtMw(v: number | null | undefined, digits = 0): string {
  if (v === null || v === undefined || Number.isNaN(v)) return '–'
  return `${v.toLocaleString('en-GB', { maximumFractionDigits: digits, minimumFractionDigits: digits })} MW`
}

export function fmtGw(v: number | null | undefined, digits = 1): string {
  if (v === null || v === undefined || Number.isNaN(v)) return '–'
  return `${(v / 1000).toFixed(digits)} GW`
}

/** MWh → GWh with one decimal, e.g. 190908 → "190.9 GWh". */
export function fmtGwh(v: number | null | undefined, digits = 1): string {
  if (v === null || v === undefined || Number.isNaN(v)) return '–'
  return `${(v / 1000).toLocaleString('en-GB', { maximumFractionDigits: digits, minimumFractionDigits: digits })} GWh`
}

export function fmtSigned(v: number, unit: string, digits = 0): string {
  const s = Math.abs(v).toLocaleString('en-GB', { maximumFractionDigits: digits, minimumFractionDigits: digits })
  return `${v > 0 ? '+' : v < 0 ? '−' : ''}${s}${unit ? ` ${unit}` : ''}`
}

export function fmtPct(v: number | null | undefined, digits = 1): string {
  if (v === null || v === undefined || Number.isNaN(v)) return '–'
  return `${v.toFixed(digits)}%`
}

export function fmtTime(iso: string): string {
  return new Date(iso).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit', timeZone: UK })
}

export function fmtDate(isoDate: string, opts: Intl.DateTimeFormatOptions = {}): string {
  // Date-only strings are calendar dates; render them without timezone shifting.
  const d = isoDate.length === 10 ? new Date(`${isoDate}T12:00:00Z`) : new Date(isoDate)
  return d.toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short', timeZone: UK, ...opts })
}

export function fmtDateTime(iso: string): string {
  return `${fmtDate(iso)} ${fmtTime(iso)}`
}

export function addDays(isoDate: string, days: number): string {
  const d = new Date(`${isoDate}T12:00:00Z`)
  d.setUTCDate(d.getUTCDate() + days)
  return d.toISOString().slice(0, 10)
}

export function fmtDuration(minutes: number): string {
  const h = Math.floor(minutes / 60)
  const m = Math.round(minutes % 60)
  return h ? `${h} h ${m.toString().padStart(2, '0')} min` : `${m} min`
}
