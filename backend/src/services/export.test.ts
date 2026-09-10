import { describe, it, expect } from 'vitest'
import { toExportLine, isExportable } from './export'

describe('isExportable', () => {
  it('is exportable when both audio and transcript are present', () => {
    expect(isExportable({ audioPath: 'a.wav', originalTranscript: 'text' })).toBe(true)
  })

  it('is not exportable when audio is missing', () => {
    expect(isExportable({ audioPath: null, originalTranscript: 'text' })).toBe(false)
  })

  it('is not exportable when transcript is missing', () => {
    expect(isExportable({ audioPath: 'a.wav', originalTranscript: null })).toBe(false)
  })

  it('excludes REJECTED items even when fully paired', () => {
    expect(
      isExportable({ audioPath: 'a.wav', originalTranscript: 'text', status: 'REJECTED' })
    ).toBe(false)
  })

  it('includes PENDING items when fully paired', () => {
    expect(
      isExportable({ audioPath: 'a.wav', originalTranscript: 'text', status: 'PENDING' })
    ).toBe(true)
  })
})

describe('toExportLine', () => {
  const baseItem = {
    id: '1', audioPath: 'a.wav', originalFileName: 'a.wav', status: 'DONE',
    originalTranscript: 'orig', correctedTranscript: 'fixed',
    durationSeconds: 10, sampleRate: 44100, channels: 1, bitDepth: 16,
    speechRateWpm: 80, speechRateWpmOverride: null,
    distanceEstimate: 'medium', distanceEstimateOverride: null,
    spans: [],
  }

  it('uses derived values when no override is present', () => {
    const result = toExportLine(baseItem)
    expect(result.recordingConditions.speechRateWpm).toBe(80)
    expect(result.recordingConditions.distanceEstimate).toBe('medium')
  })

  it('prefers the override over the derived value', () => {
    const result = toExportLine({
      ...baseItem, speechRateWpmOverride: 150, distanceEstimateOverride: 'close',
    })
    expect(result.recordingConditions.speechRateWpm).toBe(150)
    expect(result.recordingConditions.distanceEstimate).toBe('close')
  })

  it('includes spans with their type, offsets, and attributes', () => {
    const result = toExportLine({
      ...baseItem,
      spans: [{ type: 'MEDICAL_TERM', startOffset: 0, endOffset: 5, attributes: { category: 'drug' } }],
    })
    expect(result.spans).toHaveLength(1)
    expect(result.spans[0].type).toBe('MEDICAL_TERM')
  })
})


