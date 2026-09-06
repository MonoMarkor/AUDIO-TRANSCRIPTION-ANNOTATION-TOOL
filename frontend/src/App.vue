<script setup lang="ts">
import { ref } from 'vue'
import Dashboard from './components/Dashboard.vue'
import AnnotatorWorkspace from './components/AnnotatorWorkspace.vue'

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
  <AnnotatorWorkspace v-else :item-id="selectedItemId" @back="backToDashboard" @go-to-item="handleSelectItem" />
</template>
