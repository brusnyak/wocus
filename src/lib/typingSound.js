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

function makeNoise(ac, dur) {
  const len = Math.ceil(ac.sampleRate * dur)
  const buf = ac.createBuffer(1, len, ac.sampleRate)
  const d = buf.getChannelData(0)
  for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1
  return buf
}

export function playKeySound(type = 'letter') {
  if (!getSettings().typingSound) return
  const ac = getContext()
  const now = ac.currentTime
  const t = type === 'enter' ? 'enter' : type === 'space' ? 'space' : 'letter'

  try {
    // --- Layer 1: Metallic ring (short sine burst, high pitch) ---
    const ring = ac.createOscillator()
    ring.type = 'sine'
    ring.frequency.value = t === 'enter' ? 2800 : t === 'space' ? 3200 : 3600
    const ringGain = ac.createGain()
    const ringVol = t === 'enter' ? 0.25 : t === 'space' ? 0.18 : 0.2
    ringGain.gain.setValueAtTime(0, now)
    ringGain.gain.linearRampToValueAtTime(ringVol, now + 0.001)
    ringGain.gain.exponentialRampToValueAtTime(0.001, now + 0.035)

    // Add a very slight pitch glide for realism
    ring.frequency.setValueAtTime(t === 'enter' ? 2800 : 3600, now)
    ring.frequency.exponentialRampToValueAtTime(t === 'enter' ? 2400 : 3000, now + 0.03)

    ring.connect(ringGain)
    ringGain.connect(ac.destination)
    ring.start(now)
    ring.stop(now + 0.04)

    // --- Layer 2: Mechanical clatter (noise burst) ---
    const noise = ac.createBufferSource()
    noise.buffer = makeNoise(ac, 0.03)
    const bandpass = ac.createBiquadFilter()
    bandpass.type = 'bandpass'
    bandpass.frequency.value = t === 'enter' ? 1500 : 2000
    bandpass.Q.value = 0.6
    const noiseGain = ac.createGain()
    const noiseVol = t === 'enter' ? 0.35 : t === 'space' ? 0.2 : 0.25
    noiseGain.gain.setValueAtTime(0, now)
    noiseGain.gain.linearRampToValueAtTime(noiseVol, now + 0.001)
    noiseGain.gain.exponentialRampToValueAtTime(0.001, now + 0.025)
    noise.connect(bandpass)
    bandpass.connect(noiseGain)
    noiseGain.connect(ac.destination)
    noise.start(now)
    noise.stop(now + 0.03)

    // --- Layer 3: Impact thud (low sine) ---
    const thud = ac.createOscillator()
    thud.type = 'sine'
    thud.frequency.value = t === 'enter' ? 90 : 120
    const thudGain = ac.createGain()
    const thudVol = t === 'enter' ? 0.4 : t === 'space' ? 0.2 : 0.25
    thudGain.gain.setValueAtTime(0, now)
    thudGain.gain.linearRampToValueAtTime(thudVol, now + 0.003)
    thudGain.gain.exponentialRampToValueAtTime(0.001, now + (t === 'enter' ? 0.08 : 0.055))
    thud.connect(thudGain)
    thudGain.connect(ac.destination)
    thud.start(now)
    thud.stop(now + (t === 'enter' ? 0.09 : 0.06))
  } catch {}
}
