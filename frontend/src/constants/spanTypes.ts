export interface SpanTypeConfig {
  type: string
  label: string
  key: string
  colorVar: string
  fields: { name: string; label: string; kind: 'select' | 'text' | 'number' | 'checkbox'; options?: string[] }[]
}

export const SPAN_TYPES: SpanTypeConfig[] = [
  {
    type: 'NUMBER', label: 'Number', key: 'w', colorVar: '--span-number',
    fields: [
      { name: 'rendering', label: 'Rendering', kind: 'select', options: ['digits', 'words'] },
      { name: 'normalizedValue', label: 'Normalized value', kind: 'number' },
    ],
  },
  {
    type: 'FORMATTING_COMMAND', label: 'Formatting', key: 'e', colorVar: '--span-formatting',
    fields: [
      { name: 'command', label: 'Command', kind: 'select', options: ['newline', 'paragraph', 'period', 'comma', 'colon', 'dash', 'bracket_open', 'bracket_close'] },
      { name: 'isLiteral', label: 'Is literal word (not a command)', kind: 'checkbox' },
    ],
  },
  {
    type: 'SPELLED_OUT', label: 'Spelled Out', key: 'r', colorVar: '--span-spelled-out',
    fields: [{ name: 'resolvedWord', label: 'Resolved word', kind: 'text' }],
  },
  {
    type: 'NAMED_ENTITY', label: 'Named Entity', key: 'a', colorVar: '--span-named-entity',
    fields: [{ name: 'entityType', label: 'Entity type', kind: 'select', options: ['person', 'organisation', 'place', 'date'] }],
  },
  {
    type: 'MEDICAL_TERM', label: 'Medical Term', key: 's', colorVar: '--span-medical-term',
    fields: [
      { name: 'category', label: 'Category', kind: 'select', options: ['anatomy', 'procedure', 'diagnosis', 'drug', 'device'] },
      { name: 'note', label: 'Note (optional)', kind: 'text' },
    ],
  },
  {
    type: 'MEASUREMENT', label: 'Measurement', key: 'd', colorVar: '--span-measurement',
    fields: [
      { name: 'value', label: 'Value', kind: 'number' },
      { name: 'unit', label: 'Unit', kind: 'select', options: ['g', 'mg', 'ug', 'kg', 'ml', 'l', 'mmHg', 'IE', 'mm', 'cm', 'Ch'] },
    ],
  },
]

const UNIT_TO_BASE: Record<string, { base: string; factor: number }> = {
  g: { base: 'g', factor: 1 }, mg: { base: 'g', factor: 0.001 }, ug: { base: 'g', factor: 0.000001 },
  kg: { base: 'g', factor: 1000 }, ml: { base: 'ml', factor: 1 }, l: { base: 'ml', factor: 1000 },
  mmHg: { base: 'mmHg', factor: 1 }, IE: { base: 'IE', factor: 1 },
  mm: { base: 'mm', factor: 1 }, cm: { base: 'mm', factor: 10 }, Ch: { base: 'Ch', factor: 1 },
}

export function normalizeUnit(value: number, unit: string) {
  const c = UNIT_TO_BASE[unit]
  if (!c) return { normalizedValue: value, normalizedUnit: unit }
  return { normalizedValue: value * c.factor, normalizedUnit: c.base }
}
