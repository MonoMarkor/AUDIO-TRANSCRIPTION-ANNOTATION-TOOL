import { describe, it, expect } from 'vitest'
import { extractFilename, findDuplicateFilenames, validateManualPairing } from './pairing'

describe('extractFilename', () => {
  it('strips a single directory prefix', () => {
    expect(extractFilename('audio/880_NTX.wav')).toBe('880_NTX.wav')
  })

  it('strips nested directory prefixes', () => {
    expect(extractFilename('data/recordings/2024/880_NTX.wav')).toBe('880_NTX.wav')
  })

  it('returns the filename unchanged when there is no directory', () => {
    expect(extractFilename('880_NTX.wav')).toBe('880_NTX.wav')
  })
})

describe('findDuplicateFilenames', () => {
  it('returns an empty set when all filenames are unique', () => {
    const result = findDuplicateFilenames(['audio/a.wav', 'audio/b.wav'])
    expect(result.size).toBe(0)
  })

  it('detects a duplicate filename across different directory prefixes', () => {
    const result = findDuplicateFilenames(['audio/a.wav', 'other/a.wav'])
    expect(result.has('a.wav')).toBe(true)
  })

  it('detects multiple distinct duplicates', () => {
    const result = findDuplicateFilenames(['a.wav', 'a.wav', 'b.wav', 'b.wav', 'c.wav'])
    expect(result.has('a.wav')).toBe(true)
    expect(result.has('b.wav')).toBe(true)
    expect(result.has('c.wav')).toBe(false)
  })
})

describe('validateManualPairing', () => {
  const audioOnly = { audioPath: 'audio/x.wav', originalTranscript: null }
  const transcriptOnly = { audioPath: null, originalTranscript: 'some text' }
  const fullyPaired = { audioPath: 'audio/x.wav', originalTranscript: 'some text' }
  const empty = { audioPath: null, originalTranscript: null }

  it('accepts a valid audio-only + transcript-only pair', () => {
    expect(validateManualPairing(audioOnly, transcriptOnly)).toEqual({ valid: true })
  })

  it('rejects when the "audio" item has no audio', () => {
    const result = validateManualPairing(transcriptOnly, transcriptOnly)
    expect(result.valid).toBe(false)
  })

  it('rejects when the "audio" item already has a transcript', () => {
    const result = validateManualPairing(fullyPaired, transcriptOnly)
    expect(result.valid).toBe(false)
  })

  it('rejects when the "transcript" item already has audio', () => {
    const result = validateManualPairing(audioOnly, fullyPaired)
    expect(result.valid).toBe(false)
  })

  it('rejects when the "transcript" item has no transcript', () => {
    const result = validateManualPairing(audioOnly, empty)
    expect(result.valid).toBe(false)
  })
})
