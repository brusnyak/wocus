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
 * Uses four layers with inter-layer timing offsets:
 *   1. Switch click (high-pass filtered noise) — t=0ms
 *   2. Switch resonance (bandpass noise burst) — t=2ms
 *   3. Keycap bottom-out (low-mid thump) — t=4ms
 *   4. Case resonance (very brief low sine) — t=3ms
 *
 * Each layer has randomized parameters (±15%) for natural variety.
 * Global volume controlled by soundVolume setting.
 */
export function playKeySound(type = 'letter') {
  const settings = getSettings()
  if (!settings.typingSound) return
  const volume = settings.soundVolume ?? 0.7
  if (volume <= 0) return

  const ac = getContext()
  const now = ac.currentTime
  const seed = Math.random()

  // --- Parameter tuning by key type ---
  const params = type === 'enter'
    ? { clickFreq: 0.7, clickVol: 0.35, thumpFreq: 95, thumpVol: 0.30, clickLen: 0.035, thumpLen: 0.065, resonanceVol: 0.18 }
    : type === 'space'
    ? { clickFreq: 0.85, clickVol: 0.22, thumpFreq: 110, thumpVol: 0.20, clickLen: 0.025, thumpLen: 0.045, resonanceVol: 0.12 }
    : type === 'backspace'
    ? { clickFreq: 1.3, clickVol: 0.20, thumpFreq: 140, thumpVol: 0.10, clickLen: 0.015, thumpLen: 0.03, resonanceVol: 0.08 }
    : { clickFreq: 1.0, clickVol: 0.25, thumpFreq: 125, thumpVol: 0.18, clickLen: 0.02, thumpLen: 0.04, resonanceVol: 0.14 }

  // Randomize for natural feel (±15%)
  const r = 0.85 + seed * 0.3
  const vol = type === 'letter' ? (0.85 + (seed * 0.3)) : 1.0
  const masterVol = volume * vol

  // Inter-layer timing offsets (seconds) — mimics physical keystroke sequence
  const clickStart = now
  const resonanceStart = now + 0.002   // 2ms after click
  const thumpStart = now + 0.004       // 4ms after click
  const caseStart = now + 0.003        // 3ms after click

  try {
    // --- Layer 1: Switch click (high-pass filtered noise) ---
    const noiseSrc = ac.createBufferSource()
    noiseSrc.buffer = makeNoise(ac, params.clickLen)
    const hpFilter = ac.createBiquadFilter()
    hpFilter.type = 'highpass'
    hpFilter.frequency.value = 1800 * params.clickFreq * r
    hpFilter.Q.value = 0.7
    const clickGain = ac.createGain()
    clickGain.gain.setValueAtTime(0, clickStart)
    clickGain.gain.linearRampToValueAtTime(params.clickVol * masterVol, clickStart + 0.0008)
    clickGain.gain.exponentialRampToValueAtTime(0.001, clickStart + params.clickLen * 1.2)
    noiseSrc.connect(hpFilter)
    hpFilter.connect(clickGain)
    clickGain.connect(ac.destination)
    noiseSrc.start(clickStart)
    noiseSrc.stop(clickStart + params.clickLen * 1.5)

    // --- Layer 2: Switch resonance (bandpass noise burst) ---
    // Replaces the old triangle oscillator with shaped noise for realism
    const ringNoise = ac.createBufferSource()
    ringNoise.buffer = makeNoise(ac, 0.012)
    const bpFilter = ac.createBiquadFilter()
    bpFilter.type = 'bandpass'
    bpFilter.frequency.value = 3200 * params.clickFreq * r
    bpFilter.Q.value = 1.5
    const ringGain = ac.createGain()
    ringGain.gain.setValueAtTime(0, resonanceStart)
    ringGain.gain.linearRampToValueAtTime(params.clickVol * 0.4 * masterVol, resonanceStart + 0.0005)
    ringGain.gain.exponentialRampToValueAtTime(0.001, resonanceStart + 0.012)
    ringNoise.connect(bpFilter)
    bpFilter.connect(ringGain)
    ringGain.connect(ac.destination)
    ringNoise.start(resonanceStart)
    ringNoise.stop(resonanceStart + 0.015)

    // --- Layer 3: Keycap bottom-out (low mid bump) ---
    const thud = ac.createOscillator()
    thud.type = 'sine'
    thud.frequency.value = params.thumpFreq * (0.9 + seed * 0.2)
    const thudGain = ac.createGain()
    thudGain.gain.setValueAtTime(0, thumpStart)
    thudGain.gain.linearRampToValueAtTime(params.thumpVol * masterVol, thumpStart + 0.002)
    thudGain.gain.exponentialRampToValueAtTime(0.001, thumpStart + params.thumpLen)
    thud.connect(thudGain)
    thudGain.connect(ac.destination)
    thud.start(thumpStart)
    thud.stop(thumpStart + params.thumpLen + 0.01)

    // --- Layer 4: Case resonance (low frequency, quickly damped) ---
    const res = ac.createOscillator()
    res.type = 'sine'
    res.frequency.value = 200 * (0.85 + seed * 0.3)
    const resGain = ac.createGain()
    resGain.gain.setValueAtTime(0, caseStart)
    resGain.gain.linearRampToValueAtTime(params.resonanceVol * masterVol, caseStart + 0.001)
    resGain.gain.exponentialRampToValueAtTime(0.001, caseStart + 0.02)
    res.connect(resGain)
    resGain.connect(ac.destination)
    res.start(caseStart)
    res.stop(caseStart + 0.025)
  } catch {}
}
