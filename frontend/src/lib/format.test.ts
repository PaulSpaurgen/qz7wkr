import { describe, expect, it } from 'vitest'
import { buildUrl } from '../api/client'
import { addDays, fmtDuration, fmtGwh, fmtMw, fmtSigned, fmtTime } from './format'

describe('format', () => {
  it('formats MW and GWh', () => {
    expect(fmtMw(12345.6)).toBe('12,346 MW')
    expect(fmtMw(null)).toBe('–')
    expect(fmtGwh(190908.5)).toBe('190.9 GWh')
  })

  it('formats signed values with a true minus sign', () => {
    expect(fmtSigned(-1744.3, 'MW')).toBe('−1,744 MW')
    expect(fmtSigned(12, 'MW')).toBe('+12 MW')
    expect(fmtSigned(0, '')).toBe('0')
  })

  it('shows times in UK local time across BST', () => {
    expect(fmtTime('2026-01-15T09:30:00Z')).toBe('09:30')
    expect(fmtTime('2026-07-15T09:30:00Z')).toBe('10:30')
  })

  it('adds days across month ends', () => {
    expect(addDays('2026-01-31', 1)).toBe('2026-02-01')
    expect(addDays('2026-01-01', -1)).toBe('2025-12-31')
  })

  it('formats durations', () => {
    expect(fmtDuration(110)).toBe('1 h 50 min')
    expect(fmtDuration(20)).toBe('20 min')
  })
})

describe('buildUrl', () => {
  it('drops empty params', () => {
    expect(buildUrl('/api/day-ahead', { decision_date: '2026-01-15', demand_mw: null, x: '' })).toBe(
      '/api/day-ahead?decision_date=2026-01-15',
    )
  })
})
