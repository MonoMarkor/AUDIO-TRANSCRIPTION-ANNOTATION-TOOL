import { Router } from 'express'
import { prisma } from '../lib/prisma'
import type { ItemStatus, Prisma } from '../../generated/prisma/client'

const router = Router()

router.get('/', async (req, res) => {
  const { status, unmatched, sort, order } = req.query

  const where: Prisma.ItemWhereInput = {}

  if (status && typeof status === 'string') {
    where.status = status as ItemStatus
  }

  if (unmatched === 'true') {
    where.OR = [{ audioPath: null }, { originalTranscript: null }]
  }

  const sortableFields = ['durationSeconds', 'createdAt', 'originalFileName', 'status'] as const
  const sortField = sortableFields.includes(sort as any) ? (sort as string) : 'createdAt'
  const sortOrder = order === 'asc' ? 'asc' : 'desc'

  const items = await prisma.item.findMany({
    where,
    orderBy: { [sortField]: sortOrder },
  })

  res.json({ items })
})

export default router
