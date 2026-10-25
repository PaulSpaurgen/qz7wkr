import { NavLink, Outlet } from 'react-router-dom'
import { useSettings } from '../state/settings'
import { fmtDateTime } from '../lib/format'

const NAV = [
  { to: '/', label: 'Day-Ahead Desk' },
  { to: '/accuracy', label: 'Forecast Accuracy' },
  { to: '/methodology', label: 'Methodology' },
]

export function Layout() {
  const { meta } = useSettings()
  return (
    <div className="min-h-screen">
      <header className="sticky top-0 z-20 border-b border-line bg-surface/90 backdrop-blur">
        <div className="mx-auto flex max-w-7xl flex-wrap items-center gap-x-8 gap-y-2 px-4 py-3 sm:px-6">
          <NavLink to="/" className="flex items-center gap-2.5">
            <img src="/favicon.svg" alt="" className="h-7 w-7" />
            <div className="leading-tight">
              <div className="text-[15px] font-semibold text-ink">WindSight</div>
              <div className="text-[11.5px] text-muted">GB wind · day-ahead decision support</div>
            </div>
          </NavLink>
          <nav className="-mx-1 flex gap-1 overflow-x-auto [scrollbar-width:none]" aria-label="Main">
            {NAV.map((n) => (
              <NavLink
                key={n.to}
                to={n.to}
                end
                className={({ isActive }) =>
                  `rounded-md px-3 py-1.5 text-[13.5px] whitespace-nowrap transition-colors ${
                    isActive ? 'bg-surface-2 font-semibold text-ink' : 'text-ink-2 hover:text-ink'
                  }`
                }
              >
                {n.label}
              </NavLink>
            ))}
          </nav>
        </div>
      </header>
      <main className="mx-auto max-w-7xl px-4 py-6 sm:px-6">
        <Outlet />
      </main>
      <footer className="mx-auto max-w-7xl px-4 pb-8 text-[12px] text-muted sm:px-6">
        Data: Elexon BMRS — FUELHH (metered wind generation) and WINDFOR (wind generation forecast).
        {meta.data.fetched_at && <> Snapshot taken {fmtDateTime(meta.data.fetched_at)}.</>} All times UK local.
      </footer>
    </div>
  )
}
