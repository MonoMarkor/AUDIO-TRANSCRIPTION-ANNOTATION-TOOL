export const REJECT_THRESHOLD_SECONDS = 15

export type ItemStatus = 'PENDING' | 'IN_PROGRESS' | 'DONE' | 'REJECTED'

/**
 * Recordings at or under the threshold are not worth a human annotator's time and are auto-rejected. Anything longer is routed to the work queue as PENDING.
 */
export function determineInitialStatus(durationSeconds: number): ItemStatus {
  return durationSeconds <= REJECT_THRESHOLD_SECONDS ? 'REJECTED' : 'PENDING'
}
