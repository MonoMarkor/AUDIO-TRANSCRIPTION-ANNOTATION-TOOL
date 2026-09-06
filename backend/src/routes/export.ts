import { Router } from 'express'
import { prisma } from '../lib/prisma'
import { toExportLine, isExportable } from '../services/export'

const router = Router()

router.get('/', async (req, res) => {
  const { status } = req.query

  const items = await prisma.item.findMany({
    where: status && typeof status === 'string' ? { status: status as any } : undefined,
    include: { spans: true },
  })

  const exportable = items.filter(isExportable)

  res.setHeader('Content-Type', 'application/x-ndjson')
  res.setHeader('Content-Disposition', 'attachment; filename="export.jsonl"')

  for (const item of exportable) {
    res.write(JSON.stringify(toExportLine(item)) + '\n')
  }
  res.end()
})

export default router
