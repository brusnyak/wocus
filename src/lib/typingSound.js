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
    const start = cuePoints[idx]
    const dur = type === 'enter' ? 0.14 : type === 'space' ? 0.09 : 0.06
    const rate = 0.92 + Math.random() * 0.16
    const vol = type === 'enter' ? 0.85 : type === 'space' ? 0.65 : 0.55

    const source = ac.createBufferSource()
    source.buffer = buffer
    source.playbackRate.value = rate

    const gain = ac.createGain()
    gain.gain.setValueAtTime(vol, ac.currentTime)
    gain.gain.exponentialRampToValueAtTime(0.001, ac.currentTime + dur / rate)

    source.connect(gain)
    gain.connect(ac.destination)
    source.start(0, start, dur / rate)
  } catch {}
}
