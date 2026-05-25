// Typewriter sound by juskiddink (freesound.org/people/juskiddink/sounds/75105)
// Licensed under Creative Commons Attribution 4.0

import { getSettings } from './settings.svelte.js'
import cuePoints from './typewriter_cues.json'

let ctx = null
let buffer = null
let loading = null

function getContext() {
  if (!ctx) {
    ctx = new (window.AudioContext || window.webkitAudioContext)()
  }
  if (ctx.state === 'suspended') {
    ctx.resume()
  }
  return ctx
}

async function loadBuffer() {
  if (buffer) return buffer
  if (loading) return loading
  loading = (async () => {
    const ac = getContext()
    const res = await fetch('/sounds/typewriter.mp3')
    const arrayBuffer = await res.arrayBuffer()
    buffer = await ac.decodeAudioData(arrayBuffer)
    return buffer
  })()
  return loading
}

export function playKeySound(type = 'letter') {
  if (!getSettings().typingSound) return
  if (!cuePoints.length) return
  const ac = getContext()
  if (!buffer) {
    loadBuffer()
    return
  }

  try {
    const idx = Math.floor(Math.random() * cuePoints.length)
    const start = cuePoints[idx] - 0.004
    const dur = type === 'enter' ? 0.16 : type === 'space' ? 0.12 : 0.08
    const vol = type === 'enter' ? 0.8 : type === 'space' ? 0.6 : 0.5

    const source = ac.createBufferSource()
    source.buffer = buffer
    source.playbackRate.value = 1.0

    const gain = ac.createGain()
    gain.gain.setValueAtTime(vol, ac.currentTime)
    gain.gain.exponentialRampToValueAtTime(0.001, ac.currentTime + dur)

    source.connect(gain)
    gain.connect(ac.destination)
    source.start(0, Math.max(0, start), dur)
  } catch {}
}
