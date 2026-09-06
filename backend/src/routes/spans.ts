import { Router } from 'express'
import { prisma } from '../lib/prisma'
import { validateAttributesForType, findOverlappingSpan } from '../services/spanValidation'

const router = Router()

router.get('/items/:itemId/spans', async (req, res) => {
  const spans = await prisma.annotationSpan.findMany({
    where: { itemId: req.params.itemId },
    orderBy: { startOffset: 'asc' },
  })
  res.json({ spans })
})

router.post('/items/:itemId/spans', async (req, res) => {
  const { type, startOffset, endOffset, attributes } = req.body

  if (typeof startOffset !== 'number' || typeof endOffset !== 'number' || startOffset >= endOffset) {
    return res.status(400).json({ error: 'startOffset and endOffset must be numbers with startOffset < endOffset' })
  }

  const validation = validateAttributesForType(type, attributes)
  if (!validation.success) {
    return res.status(400).json({ error: validation.error })
  }

  const existingSpans = await prisma.annotationSpan.findMany({
    where: { itemId: req.params.itemId },
    select: { id: true, startOffset: true, endOffset: true },
  })

  const overlap = findOverlappingSpan({ startOffset, endOffset }, existingSpans)
  if (overlap) {
    return res.status(409).json({ error: `Overlaps with existing span ${overlap.id}` })
  }

  const span = await prisma.annotationSpan.create({
    data: { itemId: req.params.itemId, type, startOffset, endOffset, attributes: validation.data },
  })

  res.status(201).json({ span })
})

router.put('/spans/:spanId', async (req, res) => {
  const { type, startOffset, endOffset, attributes } = req.body
  const existing = await prisma.annotationSpan.findUnique({ where: { id: req.params.spanId } })

  if (!existing) return res.status(404).json({ error: 'Span not found' })

  const validation = validateAttributesForType(type, attributes)
  if (!validation.success) {
    return res.status(400).json({ error: validation.error })
  }

  const siblingSpans = await prisma.annotationSpan.findMany({
    where: { itemId: existing.itemId },
    select: { id: true, startOffset: true, endOffset: true },
  })

  const overlap = findOverlappingSpan({ startOffset, endOffset }, siblingSpans, existing.id)
  if (overlap) {
    return res.status(409).json({ error: `Overlaps with existing span ${overlap.id}` })
  }

  const span = await prisma.annotationSpan.update({
    where: { id: req.params.spanId },
    data: { type, startOffset, endOffset, attributes: validation.data },
  })

  res.json({ span })
})

router.delete('/spans/:spanId', async (req, res) => {
  await prisma.annotationSpan.delete({ where: { id: req.params.spanId } })
  res.status(204).send()
})

export default router
