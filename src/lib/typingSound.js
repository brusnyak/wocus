import { getSettings } from './settings.svelte.js'

let ctx = null

function getContext() {
  if (!ctx) {
    ctx = new (window.AudioContext || window.webkitAudioContext)()
  }
  if (ctx.state === 'suspended') {
    ctx.resume()
  }
  return ctx
}

export function playKeySound(type = 'letter') {
  if (!getSettings().typingSound) return
  try {
    const ac = getContext()
    const now = ac.currentTime

    const duration = type === 'enter' ? 0.07 : 0.035
    const baseFreq = type === 'enter' ? 180 : type === 'space' ? 280 : 350
    const pitchVar = 1 + (Math.random() - 0.5) * 0.3
    const freq = baseFreq * pitchVar
    const volVar = 0.75 + Math.random() * 0.5
    const volume = (type === 'enter' ? 0.07 : 0.04) * volVar

    const osc = ac.createOscillator()
    osc.type = 'sine'
    osc.frequency.value = freq

    const oscGain = ac.createGain()
    oscGain.gain.setValueAtTime(volume, now)
    oscGain.gain.exponentialRampToValueAtTime(0.001, now + duration)

    osc.connect(oscGain)
    oscGain.connect(ac.destination)
    osc.start(now)
    osc.stop(now + duration)

    const noiseLen = Math.floor(ac.sampleRate * 0.015)
    if (noiseLen > 0) {
      const buffer = ac.createBuffer(1, noiseLen, ac.sampleRate)
      const data = buffer.getChannelData(0)
      for (let i = 0; i < noiseLen; i++) {
        data[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / noiseLen, 2)
      }
      const noise = ac.createBufferSource()
      noise.buffer = buffer

      const noiseGain = ac.createGain()
      noiseGain.gain.setValueAtTime(volume * 0.5, now)
      noiseGain.gain.exponentialRampToValueAtTime(0.001, now + 0.015)

      noise.connect(noiseGain)
      noiseGain.connect(ac.destination)
      noise.start(now)
    }
  } catch {}
}
