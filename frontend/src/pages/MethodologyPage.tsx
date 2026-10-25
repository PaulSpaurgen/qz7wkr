import type { ReactNode } from 'react'
import { Panel } from '../components/ui'
import { useSettings } from '../state/settings'

export function MethodologyPage() {
  const { meta } = useSettings()
  return (
    <div className="max-w-3xl space-y-5">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight text-ink">Methodology</h1>
        <p className="mt-1 text-[14px] text-ink-2">How every number in WindSight is produced, and the assumptions behind it.</p>
      </div>

      <Panel title="Data">
        <Prose>
          <li>
            <b>Actual generation</b>: Elexon <code>FUELHH</code>, fuel type <code>WIND</code>. Half-hourly average MW by
            settlement period, for transmission-metered wind.
          </li>
          <li>
            <b>Forecasts</b>: Elexon <code>WINDFOR</code>. Hourly MW forecasts, each tagged with its <code>publishTime</code>.
            A new run is published about eight times a day ({meta.data.publish_times_utc.join(', ')} UTC), looking up to ~3 days ahead.
          </li>
          <li>
            Scope: purchase decisions made <b>1–31 January 2026</b>, so delivery days 2 Jan – 1 Feb. December 2025 data is
            included only to calibrate error ranges for early-January decisions.
          </li>
        </Prose>
      </Panel>

      <Panel title="Which forecast was available?">
        <Prose>
          <li>
            The decision for delivery day <i>D</i> is made on <i>D−1</i> at the day-ahead auction deadline: by default the{' '}
            <b>EPEX GB auction at {meta.gate_closures.EPEX}</b> UK time. Nord Pool N2EX closes at {meta.gate_closures.N2EX}. You can
            also set a custom deadline.
          </li>
          <li>
            The forecast used is the <b>latest run with publishTime ≤ deadline</b>. No later information is ever used. For
            example, with a 09:20 deadline the 07:30 run is used, because the 09:30 run arrives too late.
          </li>
          <li>Hourly forecast values are linearly interpolated to the half-hourly settlement periods before comparing them with actuals.</li>
        </Prose>
      </Panel>

      <Panel title="Error metrics">
        <Prose>
          <li>
            Error = <b>actual − forecast</b>. A negative error means less wind arrived than forecast, so the utility must buy
            more.
          </li>
          <li>
            <b>MAE</b>: mean absolute error. <b>RMSE</b>: root mean squared error, which penalises large misses. <b>Bias</b>: mean
            error. <b>nMAE</b>: MAE as a % of average actual output. <b>P90 abs error</b>: 90% of half-hours missed by less than this.
          </li>
          <li>
            <b>Risk range and firm wind</b>: for each decision, take the signed errors of the past <i>N</i> days (default{' '}
            {meta.default_lookback_days}), using only half-hours that had already happened before the deadline. The P(1−c) and Pc
            quantiles of those errors are added to the forecast. The lower edge is <b>firm wind</b>: the amount of wind you
            can count on with confidence <i>c</i>.
          </li>
          <li>
            <b>Expected (bias-adjusted)</b>: the forecast plus the median of the same past errors. It corrects persistent
            over- or under-forecasting.
          </li>
          <li>
            <b>Reliability check</b>: across January, the share of half-hours in which actual wind fell below firm wind. A
            well-calibrated 90% level should be breached about 10% of the time.
          </li>
          <li>
            <b>Power to buy</b> (optional): if you enter expected demand, it is Σ max(demand − firm wind, 0) × 0.5 h. This
            assumes a flat demand level, because the challenge scope excludes non-wind data.
          </li>
        </Prose>
      </Panel>

      <Panel title="Known limitations">
        <Prose>
          <li>
            WINDFOR forecasts the wind farms could generate, while FUELHH reports metered output after curtailment.
            Curtailment, from grid constraints or balancing actions, is a likely driver of the persistent over-forecast bias.
          </li>
          <li>Embedded (distribution-connected) wind is not included in either dataset.</li>
          <li>
            Error ranges are pooled across hours and wind levels. Conditioning them on forecast level or lead time is the
            natural next step.
          </li>
        </Prose>
      </Panel>
    </div>
  )
}

function Prose({ children }: { children: ReactNode }) {
  return (
    <ul className="list-disc space-y-2 pl-5 text-[14px] leading-relaxed text-ink-2 [&_b]:text-ink [&_code]:rounded [&_code]:bg-surface-2 [&_code]:px-1 [&_code]:text-[12.5px]">
      {children}
    </ul>
  )
}
