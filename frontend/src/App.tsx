import { BrowserRouter, Route, Routes } from 'react-router-dom'
import { api } from './api/client'
import { Layout } from './components/Layout'
import { ErrorBox, Loading } from './components/ui'
import { useApi } from './hooks/useApi'
import { AccuracyPage } from './pages/AccuracyPage'
import { DayAheadPage } from './pages/DayAheadPage'
import { MethodologyPage } from './pages/MethodologyPage'
import { SettingsProvider } from './state/settings'

export default function App() {
  const meta = useApi((s) => api.meta(s), [])

  if (meta.error) {
    return (
      <div className="mx-auto max-w-xl p-8">
        <ErrorBox message={meta.error} />
      </div>
    )
  }
  if (!meta.data) return <Loading label="Connecting to WindSight…" />

  return (
    <SettingsProvider meta={meta.data}>
      <BrowserRouter>
        <Routes>
          <Route element={<Layout />}>
            <Route index element={<DayAheadPage />} />
            <Route path="accuracy" element={<AccuracyPage />} />
            <Route path="methodology" element={<MethodologyPage />} />
            <Route path="*" element={<DayAheadPage />} />
          </Route>
        </Routes>
      </BrowserRouter>
    </SettingsProvider>
  )
}
