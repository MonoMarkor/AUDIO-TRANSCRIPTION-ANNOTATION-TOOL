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

const displayTime = ref(0)
let rafId: number | null = null

function tick() {
  if (audioEl.value) {
    displayTime.value = audioEl.value.currentTime
  }
  rafId = requestAnimationFrame(tick)
}

const singleWordSelected = ref(false)
let holdTimer: ReturnType<typeof setTimeout> | null = null
const HOLD_THRESHOLD_MS = 250

async function loadItem() {
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
  audioEl.value?.load()
  autoGrowTextarea()
}

onMounted(async () => {
  player.bindEvents()
  await loadItem()
  rafId = requestAnimationFrame(tick)
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

// ---------- Word selection ----------
const isDragging = ref(false)
const anchorIndex = ref<number | null>(null)
const hoverIndex = ref<number | null>(null)

function onWordMouseDown(index: number) {
  isDragging.value = true
  anchorIndex.value = index
  hoverIndex.value = index
  singleWordSelected.value = false

  if (holdTimer) clearTimeout(holdTimer)
  holdTimer = setTimeout(() => {
    // Only confirm as a single-word hold if the mouse never moved to another word
    if (isDragging.value && hoverIndex.value === anchorIndex.value) {
      singleWordSelected.value = true
    }
  }, HOLD_THRESHOLD_MS)
}

function onWordMouseEnter(index: number) {
  if (isDragging.value) hoverIndex.value = index
}

function onWordMouseUp() {
  if (!isDragging.value) return
  isDragging.value = false
  if (holdTimer) {
    clearTimeout(holdTimer)
    holdTimer = null
  }

  if (anchorIndex.value === hoverIndex.value && anchorIndex.value !== null) {
    if (!singleWordSelected.value) {
      // quick tap, not held — seek as before
      const word = words.value[anchorIndex.value]
      if (word) player.seek(wordStartTime(word))
      clearSelection()
    }
    // else: held long enough on one word — leave the selection in place
    // so the Annotation Menu picks it up as a valid single-word selection
  }
}

function clearSelection() {
  anchorIndex.value = null
  hoverIndex.value = null
  pendingType.value = null
  singleWordSelected.value = false
  if (holdTimer) {
    clearTimeout(holdTimer)
    holdTimer = null
  }
}

const selectionRange = computed(() => {
  if (anchorIndex.value === null || hoverIndex.value === null) return null
  if (anchorIndex.value === hoverIndex.value && !singleWordSelected.value) return null
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
  if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 's') {
    e.preventDefault()
    if (activeTab.value === 'edit') saveTranscriptEdit()
    return
  }

  if (e.shiftKey && e.key === 'Enter') {
    e.preventDefault()
    goToNextPending()
    return
  }

  if (e.key === 'Tab') {
    e.preventDefault()
    activeTab.value = activeTab.value === 'annotate' ? 'edit' : 'annotate'
    return
  }

  const target = e.target as HTMLElement
  const isTyping = target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.tagName === 'SELECT'

  if (e.key === ' ' && !isTyping) {
    e.preventDefault()
    player.togglePlay()
    return
  }

  if (activeTab.value !== 'annotate') return
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

// ---------- Edit Text tab ----------
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

function autoGrowTextarea() {
  const el = textareaEl.value
  if (!el) return
  el.style.height = 'auto'
  el.style.height = el.scrollHeight + 'px'
}

function onTextareaInput() {
  autoGrowTextarea()
}

async function saveTranscriptEdit() {
  const result = await updateTranscript(editableText.value, pendingEdit || undefined)
  pendingEdit = null
  if (result.invalidatedSpanIds?.length > 0 || result.updatedSpans?.length > 0) {
    await fetchSpans()
  }
  await fetchItem()
}

watch(activeTab, async (newTab, oldTab) => {
  if (oldTab === 'edit') {
    await saveTranscriptEdit()
  }
  if (newTab === 'edit') {
    await nextTick()
    autoGrowTextarea()
  }
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
  if (rafId) cancelAnimationFrame(rafId)
})

const backdropEl = ref<HTMLDivElement | null>(null)

function escapeHtml(str: string) {
  return str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
}

const highlightedHtml = computed(() => {
  const text = editableText.value
  const sorted = [...spans.value].sort((a, b) => a.startOffset - b.startOffset)
  let html = ''
  let cursor = 0

  for (const span of sorted) {
    if (span.startOffset < cursor || span.startOffset > text.length) continue
    const end = Math.min(span.endOffset, text.length)
    const config = SPAN_TYPES.find((t) => t.type === span.type)
    html += escapeHtml(text.slice(cursor, span.startOffset))
    html += `<span style="background-color: var(${config?.colorVar}); color: #1a1a1a; border-radius: 3px;">${escapeHtml(text.slice(span.startOffset, end))}</span>`
    cursor = end
  }
  html += escapeHtml(text.slice(cursor)) + '\n'
  return html
})

function syncBackdropScroll() {
  if (backdropEl.value && textareaEl.value) {
    backdropEl.value.scrollTop = textareaEl.value.scrollTop
    backdropEl.value.scrollLeft = textareaEl.value.scrollLeft
  }
}
</script>

<template>
  <div style="max-width: 1400px; margin: 0 auto; padding-bottom: 4rem;">

    <!-- Sticky top bar: breadcrumb, audio player, recording conditions -->
    <div class="sticky-top">

      <div style="display: flex; justify-content: space-between; align-items: center; padding: 0.75rem 1.5rem 0;">
        <div style="display: flex; align-items: center; gap: 0.75rem;">
          <button class="btn-secondary btn" @click="emit('back')">← Back to queue</button>
          <button class="btn" @click="goToNextPending" title="Shift+Enter">
            Next pending → <span style="opacity: 0.6; font-size: 0.8em;">(Shift+Enter)</span>
          </button>
        </div>
        <h1 v-if="item" style="font-size: 1rem; margin: 0; color: var(--text-secondary);">{{ item.originalFileName }}</h1>
      </div>

      <!-- Audio player -->
      <div style="padding: 0.75rem 1.5rem;">
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

        </div>

        <div style="margin-top: 0.75rem; display: flex; align-items: center; gap: 0.75rem;">
          <span style="color: var(--text-secondary); font-size: 0.8rem; font-variant-numeric: tabular-nums; min-width: 3.5rem;">
            {{ displayTime.toFixed(1) }}s
          </span>
          <input
            type="range"
            class="seek-bar"
            min="0"
            :max="player.duration.value || item?.durationSeconds || 0"
            step="0.01"
            :value="displayTime"
            @input="player.seek(Number(($event.target as HTMLInputElement).value))"
          />
          <span style="color: var(--text-secondary); font-size: 0.8rem; font-variant-numeric: tabular-nums; min-width: 3.5rem; text-align: right;">
            {{ (player.duration.value || item?.durationSeconds || 0).toFixed(1) }}s
          </span>
        </div>

      </div>

      <!-- Compact recording conditions row -->
      <div v-if="conditions" class="conditions-bar">
        <span><strong>Duration:</strong> {{ conditions.duration?.toFixed(1) }}s</span>
        <span><strong>Sample rate:</strong> {{ conditions.sampleRate }} Hz</span>
        <span><strong>Channels:</strong> {{ conditions.channels }}</span>
        <span><strong>Bit depth:</strong> {{ conditions.bitDepth ?? '—' }}</span>
        <span style="border-left: 1px solid var(--border-subtle); padding-left: 1rem;">
          <strong>Speech rate:</strong> derived {{ conditions.speechRateWpm.derived?.toFixed(1) ?? '—' }} wpm
        </span>
        <input type="number" v-model.number="speechRateOverrideInput" placeholder="Override wpm" style="width: 110px;" />
        <span><strong>Distance:</strong> derived {{ conditions.distanceEstimate.derived ?? '—' }}</span>
        <select v-model="distanceOverrideInput" style="width: 130px;">
          <option value="">No override</option>
          <option value="close">Close</option>
          <option value="medium">Medium</option>
          <option value="far">Far</option>
        </select>
        <button class="btn" @click="saveConditionsOverride">Save overrides</button>
      </div>
    </div>

    <!-- Main content -->
    <div style="display: grid; grid-template-columns: 1fr 340px; gap: 1.5rem; padding: 1.5rem;">

      <!-- Transcript column -->
      <div class="panel">
        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 1rem;">
          <div style="display: flex; gap: 0.5rem;">
            <button class="btn-secondary btn" :style="activeTab === 'annotate' ? 'border-color: var(--accent);' : ''" @click="activeTab = 'annotate'">Annotate</button>
            <button class="btn-secondary btn" :style="activeTab === 'edit' ? 'border-color: var(--accent);' : ''" @click="activeTab = 'edit'">Edit Text</button>
          </div>
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

        <div v-if="activeTab === 'annotate'">
          <p class="transcript-text">
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
            Click a word to jump the audio there. Click and drag across words to select a range, then use the
            annotation menu on the right. <strong>Esc</strong> clears selection. <strong>Tab</strong> switches between Annotate and Edit Text.
          </p>
        </div>

        <div v-else>
          <div class="editor-wrap">
            <div class="editor-backdrop" ref="backdropEl" v-html="highlightedHtml"></div>
            <textarea
              ref="textareaEl"
              v-model="editableText"
              @beforeinput="onBeforeInput"
              @input="onTextareaInput"
              @scroll="syncBackdropScroll"
              class="editor-textarea"
            ></textarea>
          </div>
          <button class="btn" style="margin-top: 0.75rem;" @click="saveTranscriptEdit">Save changes (Ctrl+S)</button>
          <p style="color: var(--text-secondary); font-size: 0.85rem;">
            Editing here may shift or invalidate existing tagged spans if the edit overlaps them.
            Switching tabs auto-saves your changes.
          </p>
        </div>
      </div>

      <!-- Sidebar: Annotation menu -->
      <div class="panel" style="align-self: start; position: sticky; top: 1.5rem;">
        <h3>Annotation Menu</h3>

        <p style="color: var(--text-secondary); font-size: 0.85rem;">
          <template v-for="(t, idx) in SPAN_TYPES" :key="t.type">
            <strong :style="`color: var(${t.colorVar});`">{{ t.key.toUpperCase() }}</strong>={{ t.label
            }}<span v-if="idx < SPAN_TYPES.length - 1">, </span>
          </template>
        </p>

        <p v-if="selectionRange"><strong>Selected:</strong> "{{ selectedText }}"</p>
        <p v-else style="color: var(--text-secondary); font-size: 0.85rem;">Select a range of words in the transcript to tag it.</p>

        <div style="display: flex; flex-direction: column; gap: 0.5rem; margin-bottom: 1rem;">
          <button
            v-for="t in SPAN_TYPES"
            :key="t.type"
            class="btn-secondary btn"
            :disabled="!selectionRange"
            :style="[
              `border-color: var(${t.colorVar}); color: var(${t.colorVar});`,
              pendingType === t.type ? `background-color: var(${t.colorVar}); color: #1a1a1a;` : '',
            ]"
            @click="selectType(t.type)"
          >
            {{ t.label }} ({{ t.key.toUpperCase() }})
          </button>
        </div>

        <div v-if="activeTypeConfig" class="panel-raised" style="display: flex; flex-direction: column; gap: 0.5rem; margin-bottom: 1rem;">
          <div v-for="field in activeTypeConfig.fields" :key="field.name">
            <label>{{ field.label }}</label>
            <select v-if="field.kind === 'select'" v-model="formValues[field.name]">
              <option v-for="opt in field.options" :key="opt" :value="opt">{{ opt }}</option>
            </select>
            <input v-else-if="field.kind === 'number'" type="number" v-model="formValues[field.name]" />
            <input v-else-if="field.kind === 'checkbox'" type="checkbox" v-model="formValues[field.name]" style="width: auto;" />
            <input v-else type="text" v-model="formValues[field.name]" />
          </div>
          <button class="btn" @click="submitSpan">Save span</button>
        </div>

        <hr style="border-color: var(--border-subtle); margin: 1rem 0;" />

        <h3 style="font-size: 0.9rem;">Tagged spans</h3>
        <div v-for="span in spans" :key="span.id" style="display: flex; justify-content: space-between; align-items: center; padding: 0.4rem 0; border-bottom: 1px solid var(--border-subtle); gap: 0.5rem;">
          <span style="font-size: 0.85rem;">
            <span class="badge" :style="spanColorStyle(span.type)">{{ span.type }}</span>
            {{ item?.correctedTranscript?.slice(span.startOffset, span.endOffset) }}
          </span>
          <button class="btn-secondary btn" style="padding: 0.3rem 0.6rem; font-size: 0.75rem;" @click="removeSpan(span.id)">Delete</button>
        </div>
        <p v-if="spans.length === 0" style="color: var(--text-secondary); font-size: 0.85rem;">No spans yet.</p>
      </div>
    </div>

  </div>
</template>

<style scoped>
.sticky-top {
  position: sticky;
  top: 0;
  z-index: 20;
  background-color: var(--bg-base);
  border-bottom: 1px solid var(--border-subtle);
}

.conditions-bar {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 1rem;
  padding: 0.6rem 1.5rem;
  font-size: 0.85rem;
  color: var(--text-secondary);
  background-color: var(--bg-panel);
}

.transcript-text {
  line-height: 2.2;
  font-size: 1.05rem;
  user-select: none;
  overflow-wrap: anywhere;
  word-break: break-word;
}

.editor-wrap {
  position: relative;
}
.editor-backdrop {
  position: absolute;
  inset: 0;
  margin: 0;
  padding: 0.75rem;
  border: 1px solid transparent;
  font-family: var(--font-main);
  font-size: 1rem;
  line-height: 1.6;
  white-space: pre-wrap;
  word-wrap: break-word;
  overflow-wrap: anywhere;
  overflow: hidden;
  color: var(--text-input);
  pointer-events: none;
  box-sizing: border-box;
}
.editor-textarea {
  position: relative;
  width: 100%;
  min-height: 8rem;
  padding: 0.75rem;
  border: 1px solid var(--border-subtle);
  border-radius: 4px;
  font-family: var(--font-main);
  font-size: 1rem;
  line-height: 1.6;
  background: transparent;
  color: transparent;
  caret-color: var(--text-input);
  resize: none;
  overflow: hidden;
  overflow-wrap: anywhere;
  box-sizing: border-box;
}

.seek-bar {
  flex: 1;
  -webkit-appearance: none;
  appearance: none;
  height: 6px;
  border-radius: 3px;
  background: var(--border-subtle);
  outline: none;
  cursor: pointer;
}

.seek-bar::-webkit-slider-thumb {
  -webkit-appearance: none;
  appearance: none;
  width: 14px;
  height: 14px;
  border-radius: 50%;
  background: var(--accent);
  cursor: pointer;
  transition: transform 0.1s ease;
}

.seek-bar::-webkit-slider-thumb:hover {
  transform: scale(1.2);
}

.seek-bar::-moz-range-thumb {
  width: 14px;
  height: 14px;
  border-radius: 50%;
  background: var(--accent);
  border: none;
  cursor: pointer;
}

.seek-bar::-moz-range-progress {
  background: var(--accent);
  height: 6px;
  border-radius: 3px;
}
</style>
