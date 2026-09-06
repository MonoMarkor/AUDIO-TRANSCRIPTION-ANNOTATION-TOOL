import { z } from 'zod'

export const numberAttributesSchema = z.object({
  rendering: z.enum(['digits', 'words']),
  normalizedValue: z.number(),
})

export const formattingCommandAttributesSchema = z.object({
  command: z.enum([
    'newline', 'paragraph', 'period', 'comma', 'colon', 'dash', 'bracket_open', 'bracket_close',
  ]),
  isLiteral: z.boolean(),
})

export const spelledOutAttributesSchema = z.object({
  resolvedWord: z.string().min(1),
})

export const namedEntityAttributesSchema = z.object({
  entityType: z.enum(['person', 'organisation', 'place', 'date']),
})

export const medicalTermAttributesSchema = z.object({
  category: z.enum(['anatomy', 'procedure', 'diagnosis', 'drug', 'device']),
  note: z.string().optional(),
})

const UNIT_TO_BASE: Record<string, { base: string; factor: number }> = {
  g: { base: 'g', factor: 1 },
  mg: { base: 'g', factor: 0.001 },
  ug: { base: 'g', factor: 0.000001 },
  kg: { base: 'g', factor: 1000 },
  ml: { base: 'ml', factor: 1 },
  l: { base: 'ml', factor: 1000 },
  mmHg: { base: 'mmHg', factor: 1 },
  IE: { base: 'IE', factor: 1 },
  mm: { base: 'mm', factor: 1 },
  cm: { base: 'mm', factor: 10 },
  Ch: { base: 'Ch', factor: 1 },
}

export const measurementAttributesSchema = z.object({
  value: z.number(),
  unit: z.enum(['g', 'mg', 'ug', 'kg', 'ml', 'l', 'mmHg', 'IE', 'mm', 'cm', 'Ch']),
  normalizedValue: z.number(),
  normalizedUnit: z.string(),
})

/**
 * Converts a value+unit into its base-unit equivalent (e.g. 1500 mg -> 1.5 g).
 * Units without a defined conversion (mmHg, IE, Ch) are their own base unit.
 */
export function normalizeUnit(value: number, unit: string): { normalizedValue: number; normalizedUnit: string } {
  const conversion = UNIT_TO_BASE[unit]
  if (!conversion) {
    throw new Error(`Unknown unit: ${unit}`)
  }
  return {
    normalizedValue: value * conversion.factor,
    normalizedUnit: conversion.base,
  }
}

const schemasByType = {
  NUMBER: numberAttributesSchema,
  FORMATTING_COMMAND: formattingCommandAttributesSchema,
  SPELLED_OUT: spelledOutAttributesSchema,
  NAMED_ENTITY: namedEntityAttributesSchema,
  MEDICAL_TERM: medicalTermAttributesSchema,
  MEASUREMENT: measurementAttributesSchema,
} as const

export type SpanType = keyof typeof schemasByType

export function validateAttributesForType(type: string, attributes: unknown) {
  const schema = schemasByType[type as SpanType]
  if (!schema) {
    return { success: false as const, error: `Unknown span type: ${type}` }
  }
  const result = schema.safeParse(attributes)
  if (!result.success) {
    return { success: false as const, error: result.error.message }
  }
  return { success: true as const, data: result.data }
}

export interface ExistingSpan {
  id: string
  startOffset: number
  endOffset: number
}

/**
 * Two spans overlap if one starts before the other ends, in both directions.
 * Adjacent spans (one ends exactly where another begins) do NOT count as
 * overlapping — e.g. [0,5) and [5,10) are fine.
 */
export function findOverlappingSpan(
  newSpan: { startOffset: number; endOffset: number },
  existingSpans: ExistingSpan[],
  excludeId?: string,
): ExistingSpan | null {
  for (const span of existingSpans) {
    if (span.id === excludeId) continue
    const overlaps = newSpan.startOffset < span.endOffset && span.startOffset < newSpan.endOffset
    if (overlaps) return span
  }
  return null
}
