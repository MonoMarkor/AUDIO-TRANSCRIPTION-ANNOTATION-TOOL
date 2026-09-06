import { ref, type Ref } from 'vue'
import type { Item } from './useItems'

const API_BASE = import.meta.env.VITE_API_BASE_URL || 'http://localhost:3000'

export function useItemDetail(itemId: Ref<string>) {
  const item = ref<Item | null>(null)
  const conditions = ref<any>(null)

  async function fetchItem() {
  const res = await fetch(`${API_BASE}/api/items/${itemId.value}`)
  const data = await res.json()
  item.value = data.item
  }

  async function fetchConditions() {
    const res = await fetch(`${API_BASE}/api/items/${itemId.value}/conditions`)
    conditions.value = await res.json()
  }

  async function updateTranscript(
    correctedTranscript: string,
    edit?: { position: number; deletedLength: number; insertedLength: number }
  ) {
    const res = await fetch(`${API_BASE}/api/items/${itemId.value}/transcript`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ correctedTranscript, edit }),
    })

    return res.json()
  }

  async function updateStatus(status: string) {
    const res = await fetch(`${API_BASE}/api/items/${itemId.value}/status`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status }),
    })

    const data = await res.json()

    if (data.item) {
      item.value = data.item
    }
  }

  async function updateConditionsOverride(
    speechRateWpmOverride: number | null,
    distanceEstimateOverride: string | null
  ) {
    await fetch(`${API_BASE}/api/items/${itemId.value}/conditions`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        speechRateWpmOverride,
        distanceEstimateOverride,
      }),
    })

    await fetchConditions()
  }

  return { item, conditions, fetchItem, fetchConditions, updateTranscript, updateStatus, updateConditionsOverride }
}
