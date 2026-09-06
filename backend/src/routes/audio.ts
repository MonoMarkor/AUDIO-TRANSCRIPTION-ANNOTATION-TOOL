import { Router } from 'express'
import { prisma } from '../lib/prisma'
import { minioClient, BUCKET_NAME } from '../lib/minio'

const router = Router()

router.get('/:id/audio', async (req, res) => {
  const item = await prisma.item.findUnique({ where: { id: req.params.id } })

  if (!item || !item.audioPath) {
    return res.status(404).json({ error: 'Audio not found for this item' })
  }

  try {
    const stat = await minioClient.statObject(BUCKET_NAME, item.audioPath)
    res.setHeader('Content-Type', stat.metaData['content-type'] || 'application/octet-stream')
    res.setHeader('Content-Length', stat.size)
    res.setHeader('Accept-Ranges', 'bytes')

    const stream = await minioClient.getObject(BUCKET_NAME, item.audioPath)
    stream.pipe(res)
  } catch (err) {
    res.status(500).json({ error: 'Failed to stream audio' })
  }
})

export default router
