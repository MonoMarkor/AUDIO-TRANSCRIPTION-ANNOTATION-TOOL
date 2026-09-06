import { ref, type Ref } from 'vue'

export function useAudioPlayer(audioEl: Ref<HTMLAudioElement | null>) {
  const currentTime = ref(0)
  const duration = ref(0)
  const playing = ref(false)
  const playbackRate = ref(1)

  function bindEvents() {
    const el = audioEl.value
    if (!el) return
    el.addEventListener('timeupdate', () => { currentTime.value = el.currentTime })
    el.addEventListener('loadedmetadata', () => { duration.value = el.duration })
    el.addEventListener('play', () => { playing.value = true })
    el.addEventListener('pause', () => { playing.value = false })
  }

  function togglePlay() {
    const el = audioEl.value
    if (!el) return
    if (el.paused) el.play()
    else el.pause()
  }

  function seek(time: number) {
    const el = audioEl.value
    if (!el) return
    el.currentTime = Math.max(0, Math.min(time, el.duration || 0))
  }

  function skip(seconds: number) {
    seek(currentTime.value + seconds)
  }

  function setSpeed(rate: number) {
    const el = audioEl.value
    if (!el) return
    el.playbackRate = rate
    playbackRate.value = rate
  }

  function reset() {
    seek(0)
  }

  return { currentTime, duration, playing, playbackRate, bindEvents, togglePlay, seek, skip, setSpeed, reset }
}
