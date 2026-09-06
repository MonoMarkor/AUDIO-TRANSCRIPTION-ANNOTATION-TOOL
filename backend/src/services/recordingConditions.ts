export function calculateSpeechRateWpm(
  transcriptText: string,
  durationSeconds: number,
): number | null {
  if (!durationSeconds || durationSeconds <= 0) return null

  const wordCount = transcriptText.trim().split(/\s+/).filter(Boolean).length
  if (wordCount === 0) return null

  return wordCount / (durationSeconds / 60)
}

export function computeRms(samples: Float32Array | number[]): number {
  if (samples.length === 0) return 0

  let sumSquares = 0
  for (let i = 0; i < samples.length; i++) {
    sumSquares += samples[i] * samples[i]
  }
  return Math.sqrt(sumSquares / samples.length)
}

export type DistanceEstimate = 'close' | 'medium' | 'far'

/**
 * Maps RMS loudness to a rough distance category. This is a heuristic,
 * not a calibrated measurement — thresholds chosen from informal testing,
 * documented in DESIGN.md. Only meaningful for uncompressed WAV audio,
 * where RMS reflects the raw signal level.
 */
export function estimateDistanceFromRms(rms: number): DistanceEstimate {
  if (rms > 0.1) return 'close'
  if (rms > 0.03) return 'medium'
  return 'far'
}
