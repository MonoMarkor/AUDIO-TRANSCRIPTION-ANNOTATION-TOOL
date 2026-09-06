import { Router } from 'express'
import multer from 'multer'
import { parseFile } from 'music-metadata'
import { randomUUID } from 'crypto'
import fs from 'fs'
import { prisma } from '../lib/prisma'
import { minioClient, BUCKET_NAME } from '../lib/minio'
import { determineInitialStatus } from '../services/itemStatus'

const router = Router()

const ALLOWED_TYPES = ['audio/wav', 'audio/x-wav', 'audio/mpeg', 'audio/mp4', 'audio/x-m4a']
const MAX_SIZE_BYTES = 100 * 1024 * 1024 // 100MB, adjust as needed
// const REJECT_THRESHOLD_SECONDS = 15

const UPLOAD_DIR = '/tmp/uploads'
if (!fs.existsSync(UPLOAD_DIR)) {
  fs.mkdirSync(UPLOAD_DIR, { recursive: true })
}

const upload = multer({
  dest: '/tmp/uploads',
  limits: { fileSize: MAX_SIZE_BYTES },
  fileFilter: (req, file, cb) => {
    if (!ALLOWED_TYPES.includes(file.mimetype)) {
      return cb(new Error(`Unsupported file type: ${file.mimetype}`))
    }
    cb(null, true)
  },
})

router.post('/audio', upload.array('files'), async (req, res) => {
  const files = req.files as Express.Multer.File[]

  if (!files || files.length === 0) {
    return res.status(400).json({ error: 'No files uploaded' })
  }

  const results = []

  for (const file of files) {
    try {
      // 1. Parse metadata from the local temp file
      const metadata = await parseFile(file.path)
      const durationSeconds = metadata.format.duration ?? 0
      const sampleRate = metadata.format.sampleRate ?? null
      const channels = metadata.format.numberOfChannels ?? null
      const bitDepth = metadata.format.bitsPerSample ?? null

      // 2. Determine status based on duration
      // const status = durationSeconds <= REJECT_THRESHOLD_SECONDS ? 'REJECTED' : 'PENDING'
      const status = determineInitialStatus(durationSeconds)

      // 3. Upload to MinIO
      const objectKey = `audio/${randomUUID()}-${file.originalname}`
      await minioClient.fPutObject(BUCKET_NAME, objectKey, file.path, {
        'Content-Type': file.mimetype,
      })

      // 4. Only after MinIO succeeds, insert into Postgres
      const item = await prisma.item.upsert({
        where: { originalFileName: file.originalname },
        create: {
          audioPath: objectKey,
          originalFileName: file.originalname,
          status,
          durationSeconds,
          sampleRate,
          channels,
          bitDepth,
        },
        update: {
          audioPath: objectKey,
          status,
          durationSeconds,
          sampleRate,
          channels,
          bitDepth,
        },
      })

      results.push({ success: true, filename: file.originalname, item })
    } catch (err) {
      results.push({
        success: false,
        filename: file.originalname,
        error: err instanceof Error ? err.message : 'Unknown error',
      })
    } finally {
      // 5. Clean up local temp file regardless of success/failure
      fs.unlink(file.path, () => {})
    }
  }

  res.status(207).json({ results }) // 207 = Multi-Status, since some may succeed and some fail
})

export default router
