import { Router } from 'express'
import { prisma } from '../lib/prisma'
import path from 'path'
import { extractFilename, findDuplicateFilenames } from '../services/pairing'


const router = Router()

interface TranscriptRow {
  path: string
  label: string
}

router.post('/', async (req, res) => {
  const body = req.body

  if (!Array.isArray(body)) {
    return res.status(400).json({ error: 'Expected a JSON array of transcript rows' })
  }

  const results: { path: string; success: boolean; error?: string; itemId?: string }[] = []
  // const seenPaths = new Set<string>()

  const duplicates = findDuplicateFilenames(body.map((row: any) => row?.path ?? ''))

  for (const row of body) {
    // Validate shape
    if (
      typeof row !== 'object' ||
      row === null ||
      typeof row.path !== 'string' ||
      typeof row.label !== 'string'
    ) {
      results.push({
        path: row?.path ?? 'unknown',
        success: false,
        error: 'Malformed row: missing or invalid "path"/"label" fields',
      })
      continue
    }

    // const filename = path.basename(row.path)
    const filename = extractFilename(row.path)
    if (duplicates.has(filename)) {
      results.push({ path: row.path, success: false, error: 'Duplicate path in this upload' })
      continue
    }

    // // Detect duplicate paths within this same upload batch
    // if (seenPaths.has(filename)) {
    //   results.push({ path: row.path, success: false, error: 'Duplicate path in this upload' })
    //   continue
    // }
    // seenPaths.add(filename)

    try {
      const item = await prisma.item.upsert({
        where: { originalFileName: filename },
        create: {
          originalFileName: filename,
          originalTranscript: row.label,
          correctedTranscript: row.label, // starting point, per 4.4
        },
        update: {
          originalTranscript: row.label,
          correctedTranscript: row.label,
        },
      })
      results.push({ path: row.path, success: true, itemId: item.id })
    } catch (err) {
      results.push({
        path: row.path,
        success: false,
        error: err instanceof Error ? err.message : 'Unknown error',
      })
    }
  }

  res.status(207).json({ results })
})

export default router
