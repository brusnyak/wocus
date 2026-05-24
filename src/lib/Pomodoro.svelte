<script>
  let { hidden = false } = $props()

  let open = $state(false)
  let mode = $state('focus')
  let timeLeft = $state(25 * 60)
  let running = $state(false)
  let session = $state(1)

  const FOCUS_TIME = 25 * 60
  const BREAK_TIME = 5 * 60

  let minutes = $derived(Math.floor(timeLeft / 60))
  let seconds = $derived(timeLeft % 60)
  let display = $derived(`${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`)
  let modeLabel = $derived(mode === 'focus' ? 'Focus' : 'Break')

  let intervalId = $state(null)

  function beep() {
    try {
      const ctx = new AudioContext()
      const osc = ctx.createOscillator()
      const gain = ctx.createGain()
      osc.type = 'sine'
      osc.frequency.value = 800
      gain.gain.setValueAtTime(0.3, ctx.currentTime)
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.5)
      osc.connect(gain)
      gain.connect(ctx.destination)
      osc.start()
      osc.stop(ctx.currentTime + 0.5)
    } catch (e) {
      console.warn('Pomodoro beep failed', e)
    }
  }

  function switchMode() {
    if (mode === 'focus') {
      mode = 'break'
      timeLeft = BREAK_TIME
    } else {
      mode = 'focus'
      timeLeft = FOCUS_TIME
      session += 1
    }
  }

  function tick() {
    if (timeLeft <= 1) {
      timeLeft = 0
      running = false
      beep()
      switchMode()
      return
    }
    timeLeft -= 1
  }

  function toggleTimer() {
    if (running) {
      running = false
    } else {
      running = true
    }
  }

  function reset() {
    running = false
    mode = 'focus'
    timeLeft = FOCUS_TIME
    session = 1
  }

  $effect(() => {
    if (running) {
      intervalId = setInterval(tick, 1000)
    }
    return () => {
      if (intervalId !== null) {
        clearInterval(intervalId)
        intervalId = null
      }
    }
  })

  function toggle() {
    open = !open
  }
</script>

<div class="pomodoro" class:hidden>
  <button class="toggle" onclick={toggle} aria-label={open ? 'Close timer' : 'Open timer'}>
    {#if open}
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
        <line x1="18" y1="6" x2="6" y2="18"></line>
        <line x1="6" y1="6" x2="18" y2="18"></line>
      </svg>
    {:else}
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
        <circle cx="12" cy="12" r="10"></circle>
        <polyline points="12 6 12 12 16 14"></polyline>
      </svg>
    {/if}
  </button>

  {#if open}
    <div class="card">
      <div class="mode">{modeLabel}</div>
      <div class="timer">{display}</div>
      <div class="session">Session {session}</div>
      <div class="actions">
        <button class="btn primary" onclick={toggleTimer}>
          {running ? 'Pause' : 'Start'}
        </button>
        <button class="btn" onclick={reset}>Reset</button>
      </div>
    </div>
  {/if}
</div>

<style>
  .pomodoro {
    position: fixed;
    top: 24px;
    left: 24px;
    z-index: 1000;
    display: flex;
    flex-direction: column;
    align-items: flex-start;
    gap: 8px;
    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
  }

  .pomodoro.hidden .toggle {
    opacity: 0;
    pointer-events: none;
  }

  .toggle {
    width: 44px;
    height: 44px;
    border-radius: 50%;
    border: 1px solid var(--border);
    background: var(--accent);
    color: #fff;
    cursor: pointer;
    display: flex;
    align-items: center;
    justify-content: center;
    box-shadow: 0 2px 12px rgba(0,0,0,0.15);
    transition: background 0.15s, transform 0.15s, opacity 0.3s;
    z-index: 1;
    flex-shrink: 0;
  }
  .toggle:hover {
    filter: brightness(1.1);
    transform: scale(1.05);
  }

  .card {
    width: 200px;
    background: var(--surface);
    border: 1px solid var(--border);
    border-radius: 12px;
    padding: 16px;
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 6px;
    box-shadow: 0 4px 24px rgba(0,0,0,0.12);
    animation: slideIn 0.18s ease-out;
  }

  @keyframes slideIn {
    from { opacity: 0; transform: translateY(-8px) scale(0.97); }
    to { opacity: 1; transform: translateY(0) scale(1); }
  }

  .mode {
    font-size: 0.78em;
    font-weight: 600;
    text-transform: uppercase;
    letter-spacing: 0.08em;
    color: var(--muted);
  }

  .timer {
    font-size: 2.4em;
    font-weight: 700;
    font-variant-numeric: tabular-nums;
    color: var(--fg);
    line-height: 1;
  }

  .session {
    font-size: 0.78em;
    color: var(--muted);
  }

  .actions {
    display: flex;
    gap: 6px;
    margin-top: 4px;
  }

  .btn {
    padding: 6px 14px;
    border-radius: 6px;
    border: 1px solid var(--border);
    background: var(--surface);
    color: var(--fg);
    cursor: pointer;
    font-size: 0.82em;
    font-family: inherit;
    transition: background 0.12s, color 0.12s;
  }
  .btn:hover {
    background: var(--hover);
  }
  .btn.primary {
    background: var(--accent);
    border-color: var(--accent);
    color: #fff;
  }
  .btn.primary:hover {
    filter: brightness(1.1);
  }
</style>