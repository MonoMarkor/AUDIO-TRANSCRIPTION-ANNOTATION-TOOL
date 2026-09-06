import { Router } from 'express'
import { prisma } from '../lib/prisma'

const router = Router()

router.post('/manual', async (req, res) => {
  const { audioItemId, transcriptItemId } = req.body

  if (typeof audioItemId !== 'string' || typeof transcriptItemId !== 'string') {
    return res.status(400).json({ error: 'audioItemId and transcriptItemId are required' })
  }

  const audioItem = await prisma.item.findUnique({ where: { id: audioItemId } })
  const transcriptItem = await prisma.item.findUnique({ where: { id: transcriptItemId } })

  if (!audioItem || !transcriptItem) {
    return res.status(404).json({ error: 'One or both items not found' })
  }

  if (!audioItem.audioPath || audioItem.originalTranscript) {
    return res.status(400).json({ error: 'audioItemId must reference an audio-only, unmatched item' })
  }

  if (transcriptItem.audioPath || !transcriptItem.originalTranscript) {
    return res.status(400).json({ error: 'transcriptItemId must reference a transcript-only, unmatched item' })
  }

  const merged = await prisma.$transaction(async (tx) => {
    const updated = await tx.item.update({
      where: { id: audioItemId },
      data: {
        originalTranscript: transcriptItem.originalTranscript,
        correctedTranscript: transcriptItem.correctedTranscript,
        pairedTranscriptFileName: transcriptItem.originalFileName,
      },
    })
    await tx.item.delete({ where: { id: transcriptItemId } })
    return updated
  })

  res.json({ item: merged })
})

router.post('/unpair', async (req, res) => {
  const { itemId } = req.body

  if (typeof itemId !== 'string') {
    return res.status(400).json({ error: 'itemId is required' })
  }

  const item = await prisma.item.findUnique({ where: { id: itemId } })

  if (!item) {
    return res.status(404).json({ error: 'Item not found' })
  }

  if (!item.pairedTranscriptFileName) {
    return res.status(400).json({
      error: 'This item was not manually paired, so it cannot be split back apart',
    })
  }

  const result = await prisma.$transaction(async (tx) => {
    const newTranscriptOnlyItem = await tx.item.create({
      data: {
        originalFileName: item.pairedTranscriptFileName!,
        originalTranscript: item.originalTranscript,
        correctedTranscript: item.correctedTranscript,
      },
    })

    const updatedAudioItem = await tx.item.update({
      where: { id: itemId },
      data: {
        originalTranscript: null,
        correctedTranscript: null,
        pairedTranscriptFileName: null,
      },
    })

    return { audioItem: updatedAudioItem, transcriptItem: newTranscriptOnlyItem }
  })

  res.json(result)
})

export default router
