import { describe, it, expect } from 'vitest'
import { determineInitialStatus, REJECT_THRESHOLD_SECONDS } from './itemStatus'

describe('determineInitialStatus', () => {
  it('rejects recordings under the threshold', () => {
    expect(determineInitialStatus(5)).toBe('REJECTED')
  })

  it('rejects recordings exactly at the threshold', () => {
    expect(determineInitialStatus(REJECT_THRESHOLD_SECONDS)).toBe('REJECTED')
  })

  it('accepts recordings just over the threshold', () => {
    expect(determineInitialStatus(REJECT_THRESHOLD_SECONDS + 0.01)).toBe('PENDING')
  })

  it('accepts long recordings', () => {
    expect(determineInitialStatus(120)).toBe('PENDING')
  })
})
