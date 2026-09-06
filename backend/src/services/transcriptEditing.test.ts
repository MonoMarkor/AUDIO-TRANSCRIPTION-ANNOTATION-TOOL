import { describe, it, expect } from 'vitest'
import { shiftSpansForEdit } from './transcriptEditing'

describe('shiftSpansForEdit', () => {
  const span = { id: 's1', startOffset: 10, endOffset: 20 }

  it('leaves a span unchanged when the edit is entirely after it', () => {
    const result = shiftSpansForEdit([span], { position: 25, deletedLength: 0, insertedLength: 5 })
    expect(result.updated).toHaveLength(0)
    expect(result.invalidated).toHaveLength(0)
  })

  it('leaves a span unchanged when the edit ends exactly at the span start (adjacent, not overlapping)', () => {
    const result = shiftSpansForEdit([span], { position: 5, deletedLength: 5, insertedLength: 0 })
    // edit spans [5,10), span is [10,20) — touching, not overlapping, so it should SHIFT not invalidate
    expect(result.invalidated).toHaveLength(0)
    expect(result.updated[0].startOffset).toBe(5) // shifted left by deleted 5 chars
    expect(result.updated[0].endOffset).toBe(15)
  })

  it('shifts a span right when text is inserted before it', () => {
    const result = shiftSpansForEdit([span], { position: 0, deletedLength: 0, insertedLength: 3 })
    expect(result.updated).toEqual([{ id: 's1', startOffset: 13, endOffset: 23 }])
  })

  it('shifts a span left when text is deleted before it', () => {
    const result = shiftSpansForEdit([span], { position: 0, deletedLength: 4, insertedLength: 0 })
    expect(result.updated).toEqual([{ id: 's1', startOffset: 6, endOffset: 16 }])
  })

  it('invalidates a span when the edit starts inside it', () => {
    const result = shiftSpansForEdit([span], { position: 15, deletedLength: 2, insertedLength: 0 })
    expect(result.invalidated).toEqual(['s1'])
  })

  it('invalidates a span when the edit fully contains it', () => {
    const result = shiftSpansForEdit([span], { position: 5, deletedLength: 20, insertedLength: 0 })
    expect(result.invalidated).toEqual(['s1'])
  })

  it('invalidates a span when the edit is fully contained inside it', () => {
    const result = shiftSpansForEdit([span], { position: 12, deletedLength: 3, insertedLength: 0 })
    expect(result.invalidated).toEqual(['s1'])
  })

  it('handles multiple spans independently', () => {
    const before = { id: 'before', startOffset: 0, endOffset: 5 }
    const overlapping = { id: 'overlap', startOffset: 8, endOffset: 15 }
    const after = { id: 'after', startOffset: 20, endOffset: 30 }
    const result = shiftSpansForEdit([before, overlapping, after], {
      position: 10, deletedLength: 2, insertedLength: 5,
    })
    expect(result.invalidated).toEqual(['overlap'])
    expect(result.updated).toEqual([{ id: 'after', startOffset: 23, endOffset: 33 }])
  })
})
