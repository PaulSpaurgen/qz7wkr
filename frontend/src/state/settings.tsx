import { createContext, useContext, useMemo, useState, type ReactNode } from 'react'
import type { Settings } from '../api/client'
import type { Meta } from '../api/types'

interface SettingsCtx {
  meta: Meta
  settings: Settings
  setSettings: (patch: Partial<Settings>) => void
}

const Ctx = createContext<SettingsCtx | null>(null)

/** Market assumptions shared by every page: gate closure, confidence level and calibration window. */
export function SettingsProvider({ meta, children }: { meta: Meta; children: ReactNode }) {
  const [settings, set] = useState<Settings>({
    gateClosure: meta.default_gate_closure,
    confidence: meta.default_confidence,
    lookbackDays: meta.default_lookback_days,
  })
  const value = useMemo(
    () => ({ meta, settings, setSettings: (p: Partial<Settings>) => set((s) => ({ ...s, ...p })) }),
    [meta, settings],
  )
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>
}

// oxlint-disable-next-line react/only-export-components
export function useSettings(): SettingsCtx {
  const v = useContext(Ctx)
  if (!v) throw new Error('useSettings must be used inside SettingsProvider')
  return v
}
