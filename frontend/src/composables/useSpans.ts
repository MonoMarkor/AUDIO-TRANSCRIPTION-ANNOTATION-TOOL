import { ref, type Ref } from 'vue'

const API_BASE = import.meta.env.VITE_API_BASE_URL || 'http://localhost:3000'

export interface Span {
  id: string
  itemId: string
  type: string
  startOffset: number
  endOffset: number
  attributes: Record<string, any>
}

export function useSpans(itemId: Ref<string>) {
  const spans = ref<Span[]>([])

  async function fetchSpans() {
    const res = await fetch(`${API_BASE}/api/items/${itemId.value}/spans`)
    const data = await res.json()
    spans.value = data.spans
  }

  async function createSpan(
    type: string,
    startOffset: number,
    endOffset: number,
    attributes: Record<string, any>
  ) {
    const res = await fetch(`${API_BASE}/api/items/${itemId.value}/spans`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        type,
        startOffset,
        endOffset,
        attributes,
      }),
    })

    const data = await res.json()

    if (res.ok) {
      await fetchSpans()
    }

    return data
  }

  async function deleteSpan(spanId: string) {
    await fetch(`${API_BASE}/api/spans/${spanId}`, {
        method: 'DELETE',
    })

    await fetchSpans()
  }

  return { spans, fetchSpans, createSpan, deleteSpan }
}
