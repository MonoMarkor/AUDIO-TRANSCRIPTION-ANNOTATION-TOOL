export interface ExportItem {
  id: string
  audioPath: string | null
  originalFileName: string
  status: string
  originalTranscript: string | null
  correctedTranscript: string | null
  durationSeconds: number | null
  sampleRate: number | null
  channels: number | null
  bitDepth: number | null
  speechRateWpm: number | null
  speechRateWpmOverride: number | null
  distanceEstimate: string | null
  distanceEstimateOverride: string | null
  spans: {
    type: string
    startOffset: number
    endOffset: number
    attributes: unknown
  }[]
}

export function toExportLine(item: ExportItem) {
  return {
    id: item.id,
    audioPath: item.audioPath,
    originalFileName: item.originalFileName,
    status: item.status,
    originalTranscript: item.originalTranscript,
    correctedTranscript: item.correctedTranscript,
    recordingConditions: {
      durationSeconds: item.durationSeconds,
      sampleRate: item.sampleRate,
      channels: item.channels,
      bitDepth: item.bitDepth,
      speechRateWpm: item.speechRateWpmOverride ?? item.speechRateWpm,
      distanceEstimate: item.distanceEstimateOverride ?? item.distanceEstimate,
    },
    spans: item.spans.map((s) => ({
      type: s.type,
      startOffset: s.startOffset,
      endOffset: s.endOffset,
      attributes: s.attributes,
    })),
  }
}

export function isExportable(item: { audioPath: string | null; originalTranscript: string | null }): boolean {
  return item.audioPath !== null && item.originalTranscript !== null
}
