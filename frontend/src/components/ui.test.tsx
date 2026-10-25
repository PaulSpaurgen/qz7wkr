import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { Kpi, Segmented, TooltipCard } from './ui'

describe('ui components', () => {
  it('renders a KPI with label, value and sub-text', () => {
    render(<Kpi label="Typical error" value="2,023 MW" sub="17.9% of output" />)
    expect(screen.getByText('Typical error')).toBeInTheDocument()
    expect(screen.getByText('2,023 MW')).toBeInTheDocument()
    expect(screen.getByText('17.9% of output')).toBeInTheDocument()
  })

  it('segmented control marks the active option and reports changes', () => {
    const onChange = vi.fn()
    render(
      <Segmented
        label="Confidence"
        value={0.9}
        options={[
          { value: 0.8, label: '80%' },
          { value: 0.9, label: '90%' },
        ]}
        onChange={onChange}
      />,
    )
    expect(screen.getByRole('radio', { name: '90%' })).toHaveAttribute('aria-checked', 'true')
    fireEvent.click(screen.getByRole('radio', { name: '80%' }))
    expect(onChange).toHaveBeenCalledWith(0.8)
  })

  it('tooltip lists every row value', () => {
    render(<TooltipCard title="09:00" rows={[{ label: 'Forecast', value: '8,000 MW' }, { label: 'Actual', value: '7,500 MW' }]} />)
    expect(screen.getByText('8,000 MW')).toBeInTheDocument()
    expect(screen.getByText('7,500 MW')).toBeInTheDocument()
  })
})
