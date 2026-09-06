<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted, watch, nextTick, toRef } from 'vue'
import { useItemDetail } from '../composables/useItemDetail'
import { useAudioPlayer } from '../composables/useAudioPlayer'
import { useSpans } from '../composables/useSpans'
import { useItems } from '../composables/useItems'
import { SPAN_TYPES, normalizeUnit } from '../constants/spanTypes'


const props = defineProps<{ itemId: string }>()
const itemId = toRef(props, 'itemId')
const emit = defineEmits<{ back: []; goToItem: [itemId: string] }>()

const API_BASE = import.meta.env.VITE_API_BASE_URL || 'http://localhost:3000'

const {
  item,
  conditions,
  fetchItem,
  fetchConditions,
  updateTranscript,
  updateStatus,
  updateConditionsOverride,
} = useItemDetail(itemId)

const {
  spans,
  fetchSpans,
  createSpan,
  deleteSpan,
} = useSpans(itemId)
const { items: allItems, fetchItems } = useItems()

const audioEl = ref<HTMLAudioElement | null>(null)
const player = useAudioPlayer(audioEl)

const activeTab = ref<'annotate' | 'edit'>('annotate')
const editableText = ref('')

async function loadItem() {
  // Reset UI state from previous item
  player.reset()
  player.playing.value = false
  player.currentTime.value = 0
  player.duration.value = 0

  clearSelection()
  editableText.value = ''
  pendingEdit = null

  await fetchItem()
  await fetchConditions()
  await fetchSpans()

  editableText.value = item.value?.correctedTranscript || ''

  await nextTick()

  // player.bindEvents()

  audioEl.value?.load()
}

onMounted(async () => {
  player.bindEvents()
  await loadItem()
})

watch(itemId, async () => {
  await loadItem()
})

const audioUrl = computed(() => `${API_BASE}/api/items/${props.itemId}/audio`)

// ---------- Word tokenization for the Annotate tab ----------
interface WordToken { text: string; start: number; end: number; index: number }

const words = computed<WordToken[]>(() => {
  const text = item.value?.correctedTranscript || ''
  const tokens: WordToken[] = []
  const regex = /\S+/g
  let match
  let i = 0
  while ((match = regex.exec(text)) !== null) {
    tokens.push({ text: match[0], start: match.index, end: match.index + match[0].length, index: i })
    i++
  }
  return tokens
})

// Naive even-distribution estimate for word timing, since the data has no
// per-word timestamps. Documented as an approximation in DESIGN.md.
function wordStartTime(word: WordToken): number {
  const total = words.value.length
  const dur = player.duration.value || item.value?.durationSeconds || 0
  if (total === 0) return 0
  return (word.index / total) * dur
}

function spanForWord(word: WordToken) {
  return spans.value.find((s) => s.startOffset <= word.start && word.end <= s.endOffset)
}

function spanColorStyle(spanType: string) {
  const config = SPAN_TYPES.find((t) => t.type === spanType)
  return config ? `background-color: var(${config.colorVar}); color: #1a1a1a;` : ''
}

// ---------- Word selection (click to seek, drag to select-for-tagging) ----------
const isDragging = ref(false)
const anchorIndex = ref<number | null>(null)
const hoverIndex = ref<number | null>(null)

function onWordMouseDown(index: number) {
  isDragging.value = true
  anchorIndex.value = index
  hoverIndex.value = index
}

function onWordMouseEnter(index: number) {
  if (isDragging.value) hoverIndex.value = index
}

function onWordMouseUp() {
  if (!isDragging.value) return
  isDragging.value = false
  if (anchorIndex.value === hoverIndex.value && anchorIndex.value !== null) {
    // plain click, no drag — seek audio to this word
    const word = words.value[anchorIndex.value]
    if (word) player.seek(wordStartTime(word))
    clearSelection()
  }
  // if it was a drag, selection stays active for tagging (see selectionRange below)
}

function clearSelection() {
  anchorIndex.value = null
  hoverIndex.value = null
  pendingType.value = null
}

const selectionRange = computed(() => {
  if (anchorIndex.value === null || hoverIndex.value === null) return null
  if (anchorIndex.value === hoverIndex.value) return null // single click, not a drag-selection
  const lo = Math.min(anchorIndex.value, hoverIndex.value)
  const hi = Math.max(anchorIndex.value, hoverIndex.value)
  return { startWord: lo, endWord: hi }
})

function isWordSelected(index: number) {
  if (!selectionRange.value) return false
  return index >= selectionRange.value.startWord && index <= selectionRange.value.endWord
}

const selectedText = computed(() => {
  if (!selectionRange.value) return ''
  return words.value.slice(selectionRange.value.startWord, selectionRange.value.endWord + 1).map((w) => w.text).join(' ')
})

// ---------- Tagging form ----------
const pendingType = ref<string | null>(null)
const formValues = ref<Record<string, any>>({})

const activeTypeConfig = computed(() => SPAN_TYPES.find((t) => t.type === pendingType.value))

function selectType(type: string) {
  if (!selectionRange.value) return
  pendingType.value = type
  formValues.value = {}
}

function onKeydown(e: KeyboardEvent) {
  if (e.shiftKey && e.key === 'Enter') {
    e.preventDefault()
    goToNextPending()
    return
  }
  if (activeTab.value !== 'annotate') return
  const target = e.target as HTMLElement
  if (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.tagName === 'SELECT') return

  if (e.key === 'Escape') {
    clearSelection()
    return
  }
  const config = SPAN_TYPES.find((t) => t.key === e.key.toLowerCase())
  if (config && selectionRange.value) {
    selectType(config.type)
  }
}

async function submitSpan() {
  if (!selectionRange.value || !activeTypeConfig.value) return
  const startWord = words.value[selectionRange.value.startWord]
  const endWord = words.value[selectionRange.value.endWord]

  let attributes = { ...formValues.value }
  if (pendingType.value === 'MEASUREMENT' && attributes.value && attributes.unit) {
    const { normalizedValue, normalizedUnit } = normalizeUnit(Number(attributes.value), attributes.unit)
    attributes = { ...attributes, value: Number(attributes.value), normalizedValue, normalizedUnit }
  }
  if (pendingType.value === 'NUMBER' && attributes.normalizedValue) {
    attributes.normalizedValue = Number(attributes.normalizedValue)
  }

  const result = await createSpan(pendingType.value!, startWord.start, endWord.end, attributes)
  if (result.error) {
    alert(result.error)
    return
  }
  clearSelection()
}

async function removeSpan(spanId: string) {
  await deleteSpan(spanId)
}

// ---------- Edit Text tab, with beforeinput delta tracking ----------
const textareaEl = ref<HTMLTextAreaElement | null>(null)
let pendingEdit: { position: number; deletedLength: number; insertedLength: number } | null = null

function onBeforeInput(e: InputEvent) {
  const el = textareaEl.value
  if (!el) return
  const start = el.selectionStart ?? 0
  const end = el.selectionEnd ?? 0
  pendingEdit = {
    position: start,
    deletedLength: end - start,
    insertedLength: e.data?.length ?? 0,
  }
}

async function saveTranscriptEdit() {
  const result = await updateTranscript(editableText.value, pendingEdit || undefined)
  pendingEdit = null
  if (result.invalidatedSpanIds?.length > 0 || result.updatedSpans?.length > 0) {
    await fetchSpans()
  }
  await fetchItem()
}

watch(activeTab, (tab) => {
  if (tab === 'edit') editableText.value = item.value?.correctedTranscript || ''
})

// ---------- Status + navigation ----------
async function setStatus(status: string) {
  await updateStatus(status)
}

async function goToNextPending() {
  await fetchItems({ status: 'PENDING' })

  const pendingItems = allItems.value

  if (pendingItems.length === 0) {
    alert('No pending items.')
    return
  }

  const currentIndex = pendingItems.findIndex(
    (item) => item.id === props.itemId
  )

  const nextIndex =
    currentIndex === -1
      ? 0
      : (currentIndex + 1) % pendingItems.length

  emit('goToItem', pendingItems[nextIndex].id)
}

// ---------- Recording conditions overrides ----------
const speechRateOverrideInput = ref<number | null>(null)
const distanceOverrideInput = ref<string>('')

watch(conditions, (c) => {
  if (c) {
    speechRateOverrideInput.value = c.speechRateWpm.override
    distanceOverrideInput.value = c.distanceEstimate.override || ''
  }
})

async function saveConditionsOverride() {
  await updateConditionsOverride(
    speechRateOverrideInput.value,
    distanceOverrideInput.value || null,
  )
}

document.addEventListener('mouseup', onWordMouseUp)
document.addEventListener('keydown', onKeydown)
onUnmounted(() => {
  document.removeEventListener('mouseup', onWordMouseUp)
  document.removeEventListener('keydown', onKeydown)
})
</script>

<template>
  <div style="max-width: 1300px; margin: 0 auto; padding: 1.5rem;">
    <!-- Breadcrumb + status -->
    <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 1rem;">
      <button class="btn-secondary btn" @click="emit('back')">← Back to queue</button>
      <div style="display: flex; align-items: center; gap: 0.5rem;">
      <label style="margin: 0;">Status:</label>
      <select v-if="item" :value="item.status" @change="setStatus(($event.target as HTMLSelectElement).value)">
        <option value="PENDING">Pending</option>
        <option value="IN_PROGRESS">In progress</option>
        <option value="DONE">Done</option>
        <option value="REJECTED">Rejected</option>
      </select>
    </div>
    </div>


    <h1 v-if="item" style="font-size: 1.2rem;">{{ item.originalFileName }}</h1>

    <!-- Audio player -->
<div class="panel" style="margin-bottom: 1.5rem;">
  <audio ref="audioEl" :src="audioUrl" preload="metadata"></audio>

  <div style="display: flex; align-items: center; justify-content: center; gap: 0.75rem; position: relative;">
    <button class="btn-icon" @click="player.reset" title="Back to start">
      <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor"><path d="M6 6h2v12H6zm3.5 6l8.5 6V6z"/></svg>
    </button>
    <button class="btn-icon" @click="player.skip(-5)" title="Back 5s">
      <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor"><path d="M11 6V0L4 7l7 7V8c3.31 0 6 2.69 6 6s-2.69 6-6 6-6-2.69-6-6H3c0 4.42 3.58 8 8 8s8-3.58 8-8-3.58-8-8-8z"/></svg>
    </button>

    <button class="btn-icon btn-icon-large" @click="player.togglePlay" title="Play/Pause (Space)">
      <svg v-if="!player.playing.value" width="22" height="22" viewBox="0 0 24 24" fill="currentColor"><path d="M8 5v14l11-7z"/></svg>
      <svg v-else width="22" height="22" viewBox="0 0 24 24" fill="currentColor"><rect x="6" y="5" width="4" height="14"/><rect x="14" y="5" width="4" height="14"/></svg>
    </button>

    <button class="btn-icon" @click="player.skip(5)" title="Forward 5s">
      <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor"><path d="M13 6V0l7 7-7 7V8c-3.31 0-6 2.69-6 6s2.69 6 6 6 6-2.69 6-6h2c0 4.42-3.58 8-8 8s-8-3.58-8-8 3.58-8 8-8z"/></svg>
    </button>

    <select v-model.number="player.playbackRate.value" @change="player.setSpeed(player.playbackRate.value)" style="margin-left: 1rem;">
      <option v-for="rate in [0.5, 0.75, 1, 1.25, 1.5, 2.0]" :key="rate" :value="rate">{{ rate }}x</option>
    </select>

    <span style="position: absolute; right: 0; color: var(--text-secondary); font-variant-numeric: tabular-nums;">
      {{ player.currentTime.value.toFixed(1) }}s / {{ player.duration.value.toFixed(1) }}s
    </span>
  </div>
</div>

    <div style="display: grid; grid-template-columns: 1fr 320px; gap: 1.5rem;">
      <!-- Transcript editor -->
      <div class="panel">
        <div style="display: flex; gap: 0.5rem; margin-bottom: 1rem;">
          <button class="btn-secondary btn" :style="activeTab === 'annotate' ? 'border-color: var(--accent);' : ''" @click="activeTab = 'annotate'">Annotate</button>
          <button class="btn-secondary btn" :style="activeTab === 'edit' ? 'border-color: var(--accent);' : ''" @click="activeTab = 'edit'">Edit Text</button>
        </div>

        <div v-if="activeTab === 'annotate'">
          <p style="line-height: 2.2; font-size: 1.05rem; user-select: none;">
            <span
              v-for="word in words"
              :key="word.index"
              @mousedown="onWordMouseDown(word.index)"
              @mouseenter="onWordMouseEnter(word.index)"
              :style="[
                spanForWord(word) ? spanColorStyle(spanForWord(word)!.type) : '',
                isWordSelected(word.index) ? 'outline: 2px solid var(--accent);' : '',
                'cursor: pointer; padding: 1px 2px; border-radius: 3px; margin-right: 2px;',
              ]"
              :title="spanForWord(word) ? spanForWord(word)!.type : ''"
            >{{ word.text }}</span>
          </p>

          <p style="color: var(--text-secondary); font-size: 0.85rem; margin-top: 1rem;">
            Click a word to jump the audio there. Click and drag across words to select a range, then press
            <strong>W</strong>=Number, <strong>E</strong>=Formatting, <strong>R</strong>=Spelled Out,
            <strong>A</strong>=Named Entity, <strong>S</strong>=Medical Term, <strong>D</strong>=Measurement,
            or click a button below. Esc clears selection.
          </p>

          <!-- Tagging form -->
          <div v-if="selectionRange" class="panel-raised" style="margin-top: 1rem;">
            <p><strong>Selected:</strong> "{{ selectedText }}"</p>
            <div style="display: flex; gap: 0.5rem; margin-bottom: 0.75rem; flex-wrap: wrap;">
              <button
                v-for="t in SPAN_TYPES"
                :key="t.type"
                class="btn-secondary btn"
                :style="pendingType === t.type ? `border-color: var(${t.colorVar});` : ''"
                @click="selectType(t.type)"
              >
                {{ t.label }} ({{ t.key.toUpperCase() }})
              </button>
            </div>

            <div v-if="activeTypeConfig" style="display: flex; flex-direction: column; gap: 0.5rem;">
              <div v-for="field in activeTypeConfig.fields" :key="field.name">
                <label>{{ field.label }}</label>
                <select v-if="field.kind === 'select'" v-model="formValues[field.name]">
                  <option v-for="opt in field.options" :key="opt" :value="opt">{{ opt }}</option>
                </select>
                <input v-else-if="field.kind === 'number'" type="number" v-model="formValues[field.name]" />
                <input v-else-if="field.kind === 'checkbox'" type="checkbox" v-model="formValues[field.name]" style="width: auto;" />
                <input v-else type="text" v-model="formValues[field.name]" />
              </div>
              <button class="btn" style="margin-top: 0.5rem;" @click="submitSpan">Save span</button>
            </div>
          </div>

          <!-- Existing spans list -->
          <div style="margin-top: 1.5rem;">
            <h3 style="font-size: 0.9rem;">Tagged spans</h3>
            <div v-for="span in spans" :key="span.id" style="display: flex; justify-content: space-between; align-items: center; padding: 0.4rem 0; border-bottom: 1px solid var(--border-subtle);">
              <span>
                <span class="badge" :style="spanColorStyle(span.type)">{{ span.type }}</span>
                {{ item?.correctedTranscript?.slice(span.startOffset, span.endOffset) }}
              </span>
              <button class="btn-secondary btn" @click="removeSpan(span.id)">Delete</button>
            </div>
            <p v-if="spans.length === 0" style="color: var(--text-secondary);">No spans yet.</p>
          </div>
        </div>

        <div v-else>
          <textarea
            ref="textareaEl"
            v-model="editableText"
            @beforeinput="onBeforeInput"
            rows="6"
            style="width: 100%; font-size: 1rem;"
          ></textarea>
          <button class="btn" style="margin-top: 0.75rem;" @click="saveTranscriptEdit">Save changes</button>
          <p style="color: var(--text-secondary); font-size: 0.85rem;">
            Editing here may shift or invalidate existing tagged spans if the edit overlaps them.
          </p>
        </div>
      </div>

      <!-- Side panel: recording conditions -->
      <div class="panel" v-if="conditions">
        <h3>Recording Conditions</h3>
        <p><strong>Duration:</strong> {{ conditions.duration?.toFixed(1) }}s</p>
        <p><strong>Sample rate:</strong> {{ conditions.sampleRate }} Hz</p>
        <p><strong>Channels:</strong> {{ conditions.channels }}</p>
        <p><strong>Bit depth:</strong> {{ conditions.bitDepth ?? '—' }}</p>

        <hr style="border-color: var(--border-subtle); margin: 1rem 0;" />

        <label>Speech rate (WPM) — derived: {{ conditions.speechRateWpm.derived?.toFixed(1) ?? '—' }}</label>
        <input type="number" v-model.number="speechRateOverrideInput" placeholder="Override" />

        <label style="margin-top: 0.75rem;">Distance estimate — derived: {{ conditions.distanceEstimate.derived ?? '—' }}</label>
        <select v-model="distanceOverrideInput">
          <option value="">No override</option>
          <option value="close">Close</option>
          <option value="medium">Medium</option>
          <option value="far">Far</option>
        </select>

        <button class="btn" style="margin-top: 1rem;" @click="saveConditionsOverride">Save overrides</button>
      </div>
    </div>

    <!-- pending button -->
    <button
      class="btn"
      style="position: fixed; bottom: 2rem; right: 2rem; box-shadow: 0 4px 12px rgba(0,0,0,0.4);"
      @click="goToNextPending"
      title="Shift+Enter"
    >
      Next pending → <span style="opacity: 0.6; font-size: 0.8em;">(Shift+Enter)</span>
    </button>
  </div>
</template>
