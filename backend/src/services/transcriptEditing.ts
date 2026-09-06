export interface SpanLike {
  id: string
  startOffset: number
  endOffset: number
}

export interface EditDelta {
  position: number
  deletedLength: number
  insertedLength: number
}

export interface ShiftResult {
  updated: { id: string; startOffset: number; endOffset: number }[]
  invalidated: string[]
}

/**
 * Given a single text edit (at `position`, removing `deletedLength` chars,
 * inserting `insertedLength` chars), computes how existing spans should
 * change:
 * - Spans entirely before the edit: unchanged.
 * - Spans entirely after the edit: shifted by (insertedLength - deletedLength).
 * - Spans overlapping the edited region: invalidated (deleted), since we
 *   can no longer trust what text they point to. This is a deliberate
 *   scope decision — see DESIGN.md.
 */
export function shiftSpansForEdit(spans: SpanLike[], edit: EditDelta): ShiftResult {
  const { position, deletedLength, insertedLength } = edit
  const editEnd = position + deletedLength
  const delta = insertedLength - deletedLength

  const updated: ShiftResult['updated'] = []
  const invalidated: string[] = []

  for (const span of spans) {
    if (span.endOffset <= position) {
      continue // entirely before the edit
    }
    if (span.startOffset >= editEnd) {
      updated.push({
        id: span.id,
        startOffset: span.startOffset + delta,
        endOffset: span.endOffset + delta,
      })
      continue
    }
    invalidated.push(span.id) // overlaps the edited region
  }

  return { updated, invalidated }
}
