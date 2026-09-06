import { ref } from 'vue'

const API_BASE = import.meta.env.VITE_API_BASE_URL || 'http://localhost:3000'

export interface Item {
  id: string
  audioPath: string | null
  originalFileName: string
  pairedTranscriptFileName: string | null
  status: 'PENDING' | 'IN_PROGRESS' | 'DONE' | 'REJECTED'
  durationSeconds: number | null
  sampleRate: number | null
  channels: number | null
  bitDepth: number | null
  distanceEstimate: string | null
  distanceEstimateOverride: string | null
  speechRateWpm: number | null
  speechRateWpmOverride: number | null
  originalTranscript: string | null
  correctedTranscript: string | null
  createdAt: string
  updatedAt: string
}

export function useItems() {
  const items = ref<Item[]>([])
  const loading = ref(false)
  const error = ref<string | null>(null)

  async function fetchItems(params: { status?: string; unmatched?: boolean; sort?: string; order?: string } = {}) {
    loading.value = true
    error.value = null
    try {
      const query = new URLSearchParams()
      if (params.status) query.set('status', params.status)
      if (params.unmatched) query.set('unmatched', 'true')
      if (params.sort) query.set('sort', params.sort)
      if (params.order) query.set('order', params.order)

      const res = await fetch(`${API_BASE}/api/items?${query.toString()}`)
      if (!res.ok) throw new Error('Failed to fetch items')
      const data = await res.json()
      items.value = data.items
    } catch (err) {
      error.value = err instanceof Error ? err.message : 'Unknown error'
    } finally {
      loading.value = false
    }
  }

  async function uploadAudio(files: File[]) {
    const formData = new FormData()
    for (const file of files) formData.append('files', file)

    const res = await fetch(`${API_BASE}/api/upload/audio`, {
      method: 'POST',
      body: formData,
    })
    return res.json()
  }

  async function uploadTranscripts(rows: { path: string; label: string }[]) {
    const res = await fetch(`${API_BASE}/api/upload/transcripts`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(rows),
    })
    return res.json()
  }

  async function pairManual(audioItemId: string, transcriptItemId: string) {
    const res = await fetch(`${API_BASE}/api/pairing/manual`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ audioItemId, transcriptItemId }),
    })
    return res.json()
  }

  async function unpair(itemId: string) {
    const res = await fetch(`${API_BASE}/api/pairing/unpair`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ itemId }),
    })
    return res.json()
  }

  return { items, loading, error, fetchItems, uploadAudio, uploadTranscripts, pairManual, unpair }
}
