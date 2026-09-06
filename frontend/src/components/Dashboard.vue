<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { useItems, type Item } from '../composables/useItems'

const emit = defineEmits<{ selectItem: [itemId: string] }>()

const exportUrl = `${import.meta.env.VITE_API_BASE_URL || 'http://localhost:3000'}/api/export`

const { items, loading, error, fetchItems, uploadAudio, uploadTranscripts, pairManual, unpair } = useItems()

const statusFilter = ref<string>('')
const showUnmatchedOnly = ref(false)
const showMatchedOnly = ref(false)
const sortField = ref('createdAt')
const sortOrder = ref('desc')

const displayedItems = computed(() => {
  if (showMatchedOnly.value) {
    return items.value.filter((i) => i.audioPath && i.originalTranscript)
  }
  return items.value
})

const transcriptPasteText = ref('')
const transcriptPastePath = ref('')

async function refresh() {
  await fetchItems({
    status: statusFilter.value || undefined,
    unmatched: showUnmatchedOnly.value,
    sort: sortField.value,
    order: sortOrder.value,
  })
}

onMounted(refresh)

function onAudioFilesSelected(event: Event) {
  const input = event.target as HTMLInputElement
  if (!input.files || input.files.length === 0) return
  uploadAudio(Array.from(input.files)).then(() => {
    input.value = ''
    refresh()
  })
}

function onTranscriptJsonSelected(event: Event) {
  const input = event.target as HTMLInputElement
  if (!input.files || input.files.length === 0) return
  const file = input.files[0]
  const reader = new FileReader()
  reader.onload = () => {
    try {
      const rows = JSON.parse(reader.result as string)
      uploadTranscripts(rows).then(() => {
        input.value = ''
        refresh()
      })
    } catch {
      alert('Invalid JSON file')
    }
  }
  reader.readAsText(file)
}

async function submitPastedTranscript() {
  if (!transcriptPastePath.value || !transcriptPasteText.value) return
  await uploadTranscripts([{ path: transcriptPastePath.value, label: transcriptPasteText.value }])
  transcriptPastePath.value = ''
  transcriptPasteText.value = ''
  refresh()
}

const unmatchedAudioItems = computed(() =>
  items.value.filter((i) => i.audioPath && !i.originalTranscript),
)
const unmatchedTranscriptItems = computed(() =>
  items.value.filter((i) => !i.audioPath && i.originalTranscript),
)

const selectedAudioIdForPairing = ref('')
const selectedTranscriptIdForPairing = ref('')

async function doManualPair() {
  if (!selectedAudioIdForPairing.value || !selectedTranscriptIdForPairing.value) return
  const result = await pairManual(selectedAudioIdForPairing.value, selectedTranscriptIdForPairing.value)
  if (result.error) {
    alert(result.error)
    return
  }
  selectedAudioIdForPairing.value = ''
  selectedTranscriptIdForPairing.value = ''
  refresh()
}

async function doUnpair(itemId: string) {
  const result = await unpair(itemId)
  if (result.error) {
    alert(result.error)
    return
  }
  refresh()
}

function statusBadgeClass(status: Item['status']) {
  return {
    PENDING: 'badge-pending',
    IN_PROGRESS: 'badge-in-progress',
    DONE: 'badge-done',
    REJECTED: 'badge-rejected',
  }[status]
}

function formatDuration(seconds: number | null) {
  if (seconds === null) return '—'
  return `${seconds.toFixed(1)}s`
}

function pairedBadgeClass(item: Item) {
  return item.audioPath && item.originalTranscript ? 'badge-done' : 'badge-rejected'
}

function toggleUnmatchedOnly() {
  if (showUnmatchedOnly.value) {
    showMatchedOnly.value = false
  }
  refresh()
}

function toggleMatchedOnly() {
  if (showMatchedOnly.value) {
    showUnmatchedOnly.value = false
    refresh() // unmatched flag changed (turned off), so re-fetch from server
  }
}
</script>

<template>
  <div style="max-width: 1100px; margin: 0 auto; padding: 2rem;">
    <h1>Annotation Tool</h1>

    <!-- Upload section -->
    <div class="panel" style="margin-bottom: 1.5rem;">
      <h2>Upload</h2>
      <div style="display: flex; gap: 2rem; flex-wrap: wrap;">
        <div>
          <label>Audio files (.wav, .mp3, .m4a)</label>
          <input type="file" multiple accept=".wav,.mp3,.m4a" @change="onAudioFilesSelected" />
        </div>
        <div>
          <label>Transcript JSON file</label>
          <input type="file" accept=".json" @change="onTranscriptJsonSelected" />
        </div>
      </div>

      <div style="margin-top: 1rem;">
        <label>Paste a single transcript</label>
        <div style="display: flex; gap: 0.5rem; align-items: flex-start;">
          <input v-model="transcriptPastePath" placeholder="filename.wav" style="flex: 0 0 200px;" />
          <textarea v-model="transcriptPasteText" placeholder="Transcript text..." rows="2" style="flex: 1;"></textarea>
          <button class="btn" @click="submitPastedTranscript">Add</button>
        </div>
      </div>
    </div>

    <!-- Work queue -->
    <div class="panel">
      <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 1rem;">
        <h2 style="margin: 0;">Work Queue</h2>
        <a :href="exportUrl" class="btn">
          Export JSONL
        </a>
      </div>

      <div style="display: flex; gap: 1rem; margin-bottom: 1rem; align-items: center;">
        <select v-model="statusFilter" @change="refresh">
          <option value="">All statuses</option>
          <option value="PENDING">Pending</option>
          <option value="IN_PROGRESS">In progress</option>
          <option value="DONE">Done</option>
          <option value="REJECTED">Rejected</option>
        </select>

        <select v-model="sortField" @change="refresh">
          <option value="createdAt">Sort: Created</option>
          <option value="durationSeconds">Sort: Duration</option>
          <option value="originalFileName">Sort: Filename</option>
          <option value="status">Sort: Status</option>
        </select>

        <select v-model="sortOrder" @change="refresh">
          <option value="desc">Descending</option>
          <option value="asc">Ascending</option>
        </select>

        <label style="display: flex; align-items: center; gap: 0.4rem; margin: 0;">
          <input type="checkbox" v-model="showUnmatchedOnly" @change="toggleUnmatchedOnly" style="width: auto;" />
          Unmatched only
        </label>

        <label style="display: flex; align-items: center; gap: 0.4rem; margin: 0;">
          <input type="checkbox" v-model="showMatchedOnly" @change="toggleMatchedOnly" style="width: auto;" />
          Matched only
        </label>
      </div>

      <p v-if="loading" style="color: var(--text-secondary);">Loading...</p>
      <p v-if="error" style="color: var(--status-rejected);">{{ error }}</p>

      <table v-if="items.length > 0">
        <thead>
          <tr>
            <th>Filename</th>
            <th>Duration</th>
            <th>Status</th>
            <th>Paired?</th>
          </tr>
        </thead>
        <tbody>
          <!-- <tr v-for="item in items" :key="item.id" @click="emit('selectItem', item.id)"> -->
          <tr v-for="item in displayedItems" :key="item.id" @click="emit('selectItem', item.id)">
            <td>{{ item.originalFileName }}</td>
            <td>{{ formatDuration(item.durationSeconds) }}</td>
            <td><span class="badge" :class="statusBadgeClass(item.status)">{{ item.status }}</span></td>
            <!-- <td>{{ item.audioPath && item.originalTranscript ? 'Yes' : 'No' }}</td> -->
             <td>
              <span class="badge" :class="pairedBadgeClass(item)">
                {{ item.audioPath && item.originalTranscript ? 'Yes' : 'No' }}
              </span>
            </td>
          </tr>
        </tbody>
      </table>
      <p v-if="items.length === 0 && !loading" style="color: var(--text-secondary);">No items yet.</p>
    </div>

    <!-- Manual pairing -->
    <div class="panel" style="margin-top: 1.5rem;" v-if="unmatchedAudioItems.length > 0 || unmatchedTranscriptItems.length > 0">
      <h2>Manual Pairing</h2>

      <div style="display: flex; gap: 1rem; align-items: center; margin-bottom: 1rem;">
        <select v-model="selectedAudioIdForPairing">
          <option value="">Select audio-only item</option>
          <option v-for="item in unmatchedAudioItems" :key="item.id" :value="item.id">
            {{ item.originalFileName }}
          </option>
        </select>

        <select v-model="selectedTranscriptIdForPairing">
          <option value="">Select transcript-only item</option>
          <option v-for="item in unmatchedTranscriptItems" :key="item.id" :value="item.id">
            {{ item.originalFileName }}
          </option>
        </select>

        <button class="btn" @click="doManualPair">Pair</button>
      </div>

      <div v-if="items.some((i) => i.pairedTranscriptFileName)">
        <label>Manually-paired items (can be unpaired)</label>
        <div v-for="item in items.filter((i) => i.pairedTranscriptFileName)" :key="item.id" style="display: flex; gap: 0.5rem; align-items: center; margin-bottom: 0.4rem;">
          <span>{{ item.originalFileName }} ↔ {{ item.pairedTranscriptFileName }}</span>
          <button class="btn-secondary btn" @click="doUnpair(item.id)">Unpair</button>
        </div>
      </div>
    </div>
  </div>
</template>
