// Typewriter sound by juskiddink (freesound.org/people/juskiddink/sounds/75105)
// Licensed under Creative Commons Attribution 4.0

import { getSettings } from './settings.svelte.js'

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
  const ac = getContext()
  if (!buffer) {
    loadBuffer()
    return
  }

  try {
    const len = buffer.duration
    const dur = type === 'enter' ? 0.14 : type === 'space' ? 0.1 : 0.07
    const maxStart = Math.max(0, len - dur)

    const start = Math.random() * maxStart
    const rate = 0.9 + Math.random() * 0.2
    const vol = type === 'enter' ? 0.9 : type === 'space' ? 0.7 : 0.6

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
