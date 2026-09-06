import { Router } from 'express'
import { prisma } from '../lib/prisma'
import { shiftSpansForEdit } from '../services/transcriptEditing'

const router = Router()

router.get('/:id/transcript', async (req, res) => {
  const item = await prisma.item.findUnique({ where: { id: req.params.id } })
  if (!item) return res.status(404).json({ error: 'Item not found' })

  res.json({
    originalTranscript: item.originalTranscript,
    correctedTranscript: item.correctedTranscript,
  })
})

router.put('/:id/transcript', async (req, res) => {
  const { correctedTranscript, edit } = req.body

  if (typeof correctedTranscript !== 'string') {
    return res.status(400).json({ error: 'correctedTranscript must be a string' })
  }

  const item = await prisma.item.findUnique({ where: { id: req.params.id } })
  if (!item) return res.status(404).json({ error: 'Item not found' })

  const hasValidEdit =
    edit &&
    typeof edit.position === 'number' &&
    typeof edit.deletedLength === 'number' &&
    typeof edit.insertedLength === 'number'

  let invalidatedSpanIds: string[] = []
  let updatedSpans: { id: string; startOffset: number; endOffset: number }[] = []

  if (hasValidEdit) {
    const existingSpans = await prisma.annotationSpan.findMany({
      where: { itemId: req.params.id },
      select: { id: true, startOffset: true, endOffset: true },
    })

    const result = shiftSpansForEdit(existingSpans, edit)
    invalidatedSpanIds = result.invalidated
    updatedSpans = result.updated

    await prisma.$transaction([
      prisma.item.update({ where: { id: req.params.id }, data: { correctedTranscript } }),
      ...updatedSpans.map((s) =>
        prisma.annotationSpan.update({
          where: { id: s.id },
          data: { startOffset: s.startOffset, endOffset: s.endOffset },
        }),
      ),
      ...(invalidatedSpanIds.length > 0
        ? [prisma.annotationSpan.deleteMany({ where: { id: { in: invalidatedSpanIds } } })]
        : []),
    ])
  } else {
    // No edit delta provided (e.g. a full transcript overwrite) — update
    // text but leave spans untouched, since we can't compute a safe shift.
    await prisma.item.update({ where: { id: req.params.id }, data: { correctedTranscript } })
  }

  res.json({ correctedTranscript, invalidatedSpanIds, updatedSpans })
})

export default router
