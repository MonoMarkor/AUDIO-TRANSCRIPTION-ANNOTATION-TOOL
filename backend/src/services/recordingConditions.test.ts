import { describe, it, expect } from 'vitest'
import { calculateSpeechRateWpm, computeRms, estimateDistanceFromRms } from './recordingConditions'

describe('calculateSpeechRateWpm', () => {
  it('calculates words per minute correctly', () => {
    // 10 words in 30 seconds = 20 wpm
    const text = 'one two three four five six seven eight nine ten'
    expect(calculateSpeechRateWpm(text, 30)).toBe(20)
  })

  it('returns null for zero duration', () => {
    expect(calculateSpeechRateWpm('some words here', 0)).toBeNull()
  })

  it('returns null for empty transcript', () => {
    expect(calculateSpeechRateWpm('   ', 30)).toBeNull()
  })

  it('handles multiple whitespace between words', () => {
    expect(calculateSpeechRateWpm('one   two    three', 60)).toBe(3)
  })
})

describe('computeRms', () => {
  it('returns 0 for silence', () => {
    expect(computeRms([0, 0, 0, 0])).toBe(0)
  })

  it('computes correct RMS for known values', () => {
    // RMS of [3, 4] = sqrt((9+16)/2) = sqrt(12.5) ≈ 3.5355
    expect(computeRms([3, 4])).toBeCloseTo(3.5355, 3)
  })

  it('returns 0 for empty input', () => {
    expect(computeRms([])).toBe(0)
  })
})

describe('estimateDistanceFromRms', () => {
  it('classifies loud signal as close', () => {
    expect(estimateDistanceFromRms(0.15)).toBe('close')
  })

  it('classifies moderate signal as medium', () => {
    expect(estimateDistanceFromRms(0.05)).toBe('medium')
  })

  it('classifies quiet signal as far', () => {
    expect(estimateDistanceFromRms(0.01)).toBe('far')
  })

  it('handles boundary values correctly', () => {
    expect(estimateDistanceFromRms(0.1)).toBe('medium') // exactly at threshold, not "close"
    expect(estimateDistanceFromRms(0.03)).toBe('far')   // exactly at threshold, not "medium"
  })
})
