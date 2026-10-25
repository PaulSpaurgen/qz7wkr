import { useEffect, useState } from 'react'

export interface ApiState<T> {
  data: T | null
  error: string | null
  loading: boolean
}

/**
 * Runs `fetcher` whenever `deps` change, aborting the previous request.
 * Keeps the last successful data while reloading so charts don't flash.
 */
export function useApi<T>(fetcher: (signal: AbortSignal) => Promise<T>, deps: unknown[]): ApiState<T> {
  const [state, setState] = useState<ApiState<T>>({ data: null, error: null, loading: true })

  // Callers pass their own dependency list, like useEffect itself.
  // oxlint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => {
    const ctrl = new AbortController()
    setState((s) => ({ ...s, loading: true, error: null }))
    fetcher(ctrl.signal)
      .then((data) => setState({ data, error: null, loading: false }))
      .catch((e: unknown) => {
        if (ctrl.signal.aborted) return
        setState((s) => ({ ...s, error: e instanceof Error ? e.message : String(e), loading: false }))
      })
    return () => ctrl.abort()
    // oxlint-disable-next-line react-hooks/exhaustive-deps
  }, deps)

  return state
}
