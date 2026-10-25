import { useSettings } from '../state/settings'
import { Segmented } from './ui'

/** Market assumptions — one row above the charts; they scope every number on the page. */
export function SettingsBar() {
  const { meta, settings, setSettings } = useSettings()
  const presets = Object.entries(meta.gate_closures)
  const isPreset = presets.some(([, t]) => t === settings.gateClosure)

  return (
    <div className="flex flex-wrap items-end gap-x-5 gap-y-3">
      <div className="flex items-end gap-2">
        <Segmented
          label="Decision deadline (UK time)"
          value={isPreset ? settings.gateClosure : 'custom'}
          options={[
            ...presets.map(([name, t]) => ({ value: t, label: `${name} ${t}` })),
            { value: 'custom', label: 'Custom' },
          ]}
          onChange={(v) => setSettings({ gateClosure: v === 'custom' ? '11:00' : v })}
        />
        {!isPreset && (
          <input
            type="time"
            aria-label="Custom decision deadline"
            value={settings.gateClosure}
            step={600}
            onChange={(e) => e.target.value && setSettings({ gateClosure: e.target.value })}
            className="h-[34px] rounded-lg border border-line bg-surface px-2 text-[13px] text-ink"
          />
        )}
      </div>
      <Segmented
        label="Confidence"
        value={settings.confidence}
        options={[0.8, 0.9, 0.95].map((c) => ({ value: c, label: `${Math.round(c * 100)}%` }))}
        onChange={(confidence) => setSettings({ confidence })}
      />
      <Segmented
        label="Error calibration window"
        value={settings.lookbackDays}
        options={[14, 30, 45].map((d) => ({ value: d, label: `${d} days` }))}
        onChange={(lookbackDays) => setSettings({ lookbackDays })}
      />
    </div>
  )
}
