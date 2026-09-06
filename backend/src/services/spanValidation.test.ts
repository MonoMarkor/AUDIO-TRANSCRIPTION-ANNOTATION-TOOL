import { describe, it, expect } from 'vitest'
import { normalizeUnit, findOverlappingSpan, validateAttributesForType } from './spanValidation'

describe('normalizeUnit', () => {
  it('converts mg to g correctly', () => {
    const result = normalizeUnit(1500, 'mg')
    expect(result.normalizedValue).toBeCloseTo(1.5)
    expect(result.normalizedUnit).toBe('g')
  })

  it('converts kg to g correctly', () => {
    const result = normalizeUnit(2, 'kg')
    expect(result.normalizedValue).toBe(2000)
    expect(result.normalizedUnit).toBe('g')
  })

  it('converts cm to mm correctly', () => {
    const result = normalizeUnit(5, 'cm')
    expect(result.normalizedValue).toBe(50)
    expect(result.normalizedUnit).toBe('mm')
  })

  it('leaves units with no conversion table unchanged', () => {
    const result = normalizeUnit(120, 'mmHg')
    expect(result.normalizedValue).toBe(120)
    expect(result.normalizedUnit).toBe('mmHg')
  })

  it('throws on an unknown unit', () => {
    expect(() => normalizeUnit(5, 'banana')).toThrow()
  })
})

describe('findOverlappingSpan', () => {
  const existing = [{ id: 'a', startOffset: 10, endOffset: 20 }]

  it('detects a fully contained overlap', () => {
    expect(findOverlappingSpan({ startOffset: 12, endOffset: 15 }, existing)).not.toBeNull()
  })

  it('detects a partial overlap', () => {
    expect(findOverlappingSpan({ startOffset: 15, endOffset: 25 }, existing)).not.toBeNull()
  })

  it('allows adjacent spans that touch but do not overlap', () => {
    expect(findOverlappingSpan({ startOffset: 20, endOffset: 30 }, existing)).toBeNull()
    expect(findOverlappingSpan({ startOffset: 0, endOffset: 10 }, existing)).toBeNull()
  })

  it('excludes a span by id, e.g. when updating itself', () => {
    expect(findOverlappingSpan({ startOffset: 10, endOffset: 20 }, existing, 'a')).toBeNull()
  })
})

describe('validateAttributesForType', () => {
  it('accepts valid MEASUREMENT attributes', () => {
    const result = validateAttributesForType('MEASUREMENT', {
      value: 1500, unit: 'mg', normalizedValue: 1.5, normalizedUnit: 'g',
    })
    expect(result.success).toBe(true)
  })

  it('rejects MEASUREMENT with an invalid unit', () => {
    const result = validateAttributesForType('MEASUREMENT', {
      value: 5, unit: 'banana', normalizedValue: 5, normalizedUnit: 'banana',
    })
    expect(result.success).toBe(false)
  })

  it('rejects an unknown span type', () => {
    const result = validateAttributesForType('NOT_A_TYPE', {})
    expect(result.success).toBe(false)
  })

  it('accepts valid MEDICAL_TERM attributes without the optional note', () => {
    const result = validateAttributesForType('MEDICAL_TERM', { category: 'drug' })
    expect(result.success).toBe(true)
  })
})
