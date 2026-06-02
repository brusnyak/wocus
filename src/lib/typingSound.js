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

/** Generate white noise buffer */
function makeNoise(ac, dur) {
  const len = Math.ceil(ac.sampleRate * dur)
  const buf = ac.createBuffer(1, len, ac.sampleRate)
  const d = buf.getChannelData(0)
  for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1
  return buf
}

/**
 * Play a realistic mechanical keystroke sound.
 *
 * Uses four layers:
 *   1. Pre-click (noise burst at actuation point)
 *   2. Switch click (high-passed noise, short sharp transient)
 *   3. Keycap bottom-out (low-mid thump)
 *   4. Case resonance (very brief low sine)
 *
 * Each layer has randomized parameters (±20%) for natural variety.
 */
export function playKeySound(type = 'letter') {
  if (!getSettings().typingSound) return
  const ac = getContext()
  const now = ac.currentTime
  const seed = Math.random()

  // --- Parameter tuning by key type ---
  const params = type === 'enter'
    ? { clickFreq: 0.7, clickVol: 0.35, thumpFreq: 95, thumpVol: 0.30, clickLen: 0.035, thumpLen: 0.065, resonanceVol: 0.18 }
    : type === 'space'
    ? { clickFreq: 0.85, clickVol: 0.22, thumpFreq: 110, thumpVol: 0.20, clickLen: 0.025, thumpLen: 0.045, resonanceVol: 0.12 }
    : { clickFreq: 1.0, clickVol: 0.25, thumpFreq: 125, thumpVol: 0.18, clickLen: 0.02, thumpLen: 0.04, resonanceVol: 0.14 }

  // Randomize for natural feel (±15%)
  const r = 0.85 + seed * 0.3
  const vol = type === 'letter' ? (0.85 + (seed * 0.3)) : 1.0

  try {
    // --- Layer 1: Switch click (high-pass filtered noise) ---
    const noiseSrc = ac.createBufferSource()
    noiseSrc.buffer = makeNoise(ac, params.clickLen)
    const hpFilter = ac.createBiquadFilter()
    hpFilter.type = 'highpass'
    hpFilter.frequency.value = 1800 * params.clickFreq * r
    hpFilter.Q.value = 0.7
    const clickGain = ac.createGain()
    clickGain.gain.setValueAtTime(0, now)
    clickGain.gain.linearRampToValueAtTime(params.clickVol * vol, now + 0.0008)
    clickGain.gain.exponentialRampToValueAtTime(0.001, now + params.clickLen * 1.2)
    noiseSrc.connect(hpFilter)
    hpFilter.connect(clickGain)
    clickGain.connect(ac.destination)
    noiseSrc.start(now)
    noiseSrc.stop(now + params.clickLen * 1.5)

    // --- Layer 2: Switch resonance (short triangle wave burst) ---
    const ring = ac.createOscillator()
    ring.type = 'triangle'
    ring.frequency.value = 2400 * params.clickFreq * r
    const ringGain = ac.createGain()
    ringGain.gain.setValueAtTime(0, now)
    ringGain.gain.linearRampToValueAtTime(params.clickVol * 0.5 * vol, now + 0.0005)
    ringGain.gain.exponentialRampToValueAtTime(0.001, now + 0.015)
    ring.connect(ringGain)
    ringGain.connect(ac.destination)
    ring.start(now)
    ring.stop(now + 0.02)

    // --- Layer 3: Keycap bottom-out (low mid bump) ---
    const thud = ac.createOscillator()
    thud.type = 'sine'
    thud.frequency.value = params.thumpFreq * (0.9 + seed * 0.2)
    const thudGain = ac.createGain()
    thudGain.gain.setValueAtTime(0, now)
    thudGain.gain.linearRampToValueAtTime(params.thumpVol * vol, now + 0.002)
    thudGain.gain.exponentialRampToValueAtTime(0.001, now + params.thumpLen)
    thud.connect(thudGain)
    thudGain.connect(ac.destination)
    thud.start(now)
    thud.stop(now + params.thumpLen + 0.01)

    // --- Layer 4: Case resonance (low frequency, quickly damped) ---
    const res = ac.createOscillator()
    res.type = 'sine'
    res.frequency.value = 200 * (0.85 + seed * 0.3)
    const resGain = ac.createGain()
    resGain.gain.setValueAtTime(0, now)
    resGain.gain.linearRampToValueAtTime(params.resonanceVol * vol, now + 0.001)
    resGain.gain.exponentialRampToValueAtTime(0.001, now + 0.02)
    res.connect(resGain)
    resGain.connect(ac.destination)
    res.start(now)
    res.stop(now + 0.025)
  } catch {}
}
