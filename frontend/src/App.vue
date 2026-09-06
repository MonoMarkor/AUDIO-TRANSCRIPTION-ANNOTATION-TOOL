<script setup lang="ts">
import { ref } from 'vue'
import Dashboard from './components/Dashboard.vue'

const selectedItemId = ref<string | null>(null)

function handleSelectItem(itemId: string) {
  selectedItemId.value = itemId
}

function backToDashboard() {
  selectedItemId.value = null
}
</script>

<template>
  <Dashboard v-if="!selectedItemId" @select-item="handleSelectItem" />
  <div v-else class="panel" style="margin: 2rem;">
    <button class="btn-secondary btn" @click="backToDashboard">← Back to queue</button>
    <p style="margin-top: 1rem;">Workspace for item: {{ selectedItemId }} (coming next)</p>
  </div>
</template>
