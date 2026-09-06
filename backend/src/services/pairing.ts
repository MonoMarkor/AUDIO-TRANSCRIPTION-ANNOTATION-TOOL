import path from 'path'

/**
 * Extracts just the filename from a path, regardless of directory prefix.
 * The brief's transcript format always uses forward slashes
 * (e.g. "audio/880_NTX.wav"), so we use posix.basename explicitly
 * rather than the OS-dependent `path.basename`.
 */
export function extractFilename(rawPath: string): string {
  return path.posix.basename(rawPath)
}

/**
 * Given a list of raw paths from a transcript upload batch, returns
 * the set of filenames that appear more than once. Used to reject
 * duplicate rows within a single upload per section 4.1.
 */
export function findDuplicateFilenames(rawPaths: string[]): Set<string> {
  const seen = new Set<string>()
  const duplicates = new Set<string>()

  for (const rawPath of rawPaths) {
    const filename = extractFilename(rawPath)
    if (seen.has(filename)) {
      duplicates.add(filename)
    }
    seen.add(filename)
  }

  return duplicates
}

export interface PairableItem {
  audioPath: string | null
  originalTranscript: string | null
}

export type PairingValidationResult = { valid: true } | { valid: false; error: string }

/**
 * Confirms two items are eligible to be manually paired: one must be
 * audio-only (has audio, no transcript), the other transcript-only
 * (has transcript, no audio). Prevents accidentally merging two
 * already-complete items or two of the same kind.
 */
export function validateManualPairing(
  audioItem: PairableItem,
  transcriptItem: PairableItem,
): PairingValidationResult {
  if (!audioItem.audioPath) {
    return { valid: false, error: 'audioItemId must reference an item that has audio' }
  }
  if (audioItem.originalTranscript) {
    return { valid: false, error: 'audioItemId must reference an item with no transcript yet' }
  }
  if (transcriptItem.audioPath) {
    return { valid: false, error: 'transcriptItemId must reference an item with no audio yet' }
  }
  if (!transcriptItem.originalTranscript) {
    return { valid: false, error: 'transcriptItemId must reference an item that has a transcript' }
  }
  return { valid: true }
}
