<script setup lang='ts'>
import { ref, onMounted } from 'vue'

// reactive state
const count = ref(0)

const data = ref<MessageData | null>(null)

interface MessageData
{
    message: string
}

// functions that mutate state and trigger updates
function increment() {
  count.value++
}

async function fetchMessage(): Promise<MessageData> {
  const res = await fetch(`http://localhost:3000/api/hello?name=Piush`)
  const json = await res.json()
  return json
}

// lifecycle hooks
// onMounted(async () => {
//   console.log(`The initial count is ${count.value}.`);
//   const messageResponse = await fetchMessage();
//   data.value = messageResponse;
// })

onMounted(async () => {
  console.log(`The initial count is ${count.value}.`)
  data.value = await fetchMessage()
})
</script>

<template>
  <button @click="increment">Count is: {{ count }}</button>
  <p>{{data?.message}}</p>
</template>
