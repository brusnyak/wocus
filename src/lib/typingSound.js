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

function noiseBuffer(ac, dur) {
  const len = Math.ceil(ac.sampleRate * dur)
  const buf = ac.createBuffer(1, len, ac.sampleRate)
  const data = buf.getChannelData(0)
  for (let i = 0; i < data.length; i++) {
    data[i] = Math.random() * 2 - 1
  }
  return buf
}

export function playKeySound(type = 'letter') {
  if (!getSettings().typingSound) return
  const ac = getContext()

  try {
    const vol = type === 'enter' ? 0.55 : type === 'space' ? 0.35 : 0.3
    const clickFreq = type === 'enter' ? 1800 : type === 'space' ? 2200 : 2500
    const clickDecay = type === 'enter' ? 0.06 : type === 'space' ? 0.05 : 0.04
    const thudFreq = type === 'enter' ? 100 : type === 'space' ? 130 : 160
    const thudDecay = type === 'enter' ? 0.08 : type === 'space' ? 0.07 : 0.06
    const now = ac.currentTime

    // Click: noise through bandpass
    const clickBuf = noiseBuffer(ac, clickDecay + 0.01)
    const click = ac.createBufferSource()
    click.buffer = clickBuf

    const bandpass = ac.createBiquadFilter()
    bandpass.type = 'bandpass'
    bandpass.frequency.value = clickFreq
    bandpass.Q.value = 0.8

    const clickGain = ac.createGain()
    clickGain.gain.setValueAtTime(0, now)
    clickGain.gain.linearRampToValueAtTime(vol, now + 0.001)
    clickGain.gain.exponentialRampToValueAtTime(0.001, now + clickDecay)

    click.connect(bandpass)
    bandpass.connect(clickGain)
    clickGain.connect(ac.destination)
    click.start(now)
    click.stop(now + clickDecay + 0.01)

    // Thud: low sine
    const thud = ac.createOscillator()
    thud.type = 'sine'
    thud.frequency.value = thudFreq

    const thudGain = ac.createGain()
    thudGain.gain.setValueAtTime(0, now)
    thudGain.gain.linearRampToValueAtTime(vol * 0.6, now + 0.002)
    thudGain.gain.exponentialRampToValueAtTime(0.001, now + thudDecay)

    thud.connect(thudGain)
    thudGain.connect(ac.destination)
    thud.start(now)
    thud.stop(now + thudDecay + 0.01)
  } catch {}
}
