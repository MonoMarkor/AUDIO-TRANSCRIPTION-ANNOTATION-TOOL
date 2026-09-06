import { Router } from 'express'
import { prisma } from '../lib/prisma'

const router = Router()

router.get('/:id/conditions', async (req, res) => {
  const item = await prisma.item.findUnique({ where: { id: req.params.id } })
  if (!item) return res.status(404).json({ error: 'Item not found' })

  res.json({
    duration: item.durationSeconds,
    sampleRate: item.sampleRate,
    channels: item.channels,
    bitDepth: item.bitDepth,
    speechRateWpm: {
      derived: item.speechRateWpm,
      override: item.speechRateWpmOverride,
      effective: item.speechRateWpmOverride ?? item.speechRateWpm,
    },
    distanceEstimate: {
      derived: item.distanceEstimate,
      override: item.distanceEstimateOverride,
      effective: item.distanceEstimateOverride ?? item.distanceEstimate,
    },
  })
})

router.put('/:id/conditions', async (req, res) => {
  const { speechRateWpmOverride, distanceEstimateOverride } = req.body

  const item = await prisma.item.update({
    where: { id: req.params.id },
    data: { speechRateWpmOverride, distanceEstimateOverride },
  })

  res.json({ item })
})

export default router
