<script>
  let { open = false, onclose, onInsertDate } = $props()

  const DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']
  const now = new Date()
  const today = { d: now.getDate(), m: now.getMonth(), y: now.getFullYear() }

  let viewYear = $state(now.getFullYear())
  let viewMonth = $state(now.getMonth())

  let monthLabel = $derived(
    new Date(viewYear, viewMonth).toLocaleDateString('en-US', { month: 'long', year: 'numeric' })
  )

  let days = $derived(() => {
    const first = new Date(viewYear, viewMonth, 1).getDay()
    const last = new Date(viewYear, viewMonth + 1, 0).getDate()
    const cells = []
    for (let i = 0; i < first; i++) cells.push(null)
    for (let d = 1; d <= last; d++) cells.push(d)
    return cells
  })

  function prevMonth() {
    if (viewMonth === 0) { viewMonth = 11; viewYear-- }
    else viewMonth--
  }

  function nextMonth() {
    if (viewMonth === 11) { viewMonth = 0; viewYear++ }
    else viewMonth++
  }

  function pick(d) {
    if (d == null) return
    const date = new Date(viewYear, viewMonth, d)
    const label = date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
    onInsertDate?.(label)
    onclose?.()
  }

  function handleOverlayClick(e) {
    if (e.target === e.currentTarget) onclose?.()
  }

  function handleKeydown(e) {
    if (e.key === 'Escape') onclose?.()
  }
</script>

{#if open}
  <div
    class="overlay"
    role="dialog"
    tabindex="-1"
    onclick={handleOverlayClick}
    onkeydown={handleKeydown}
  >
    <div class="calendar">
      <div class="header">
        <button class="nav" onclick={prevMonth} aria-label="Previous month">‹</button>
        <span class="label">{monthLabel}</span>
        <button class="nav" onclick={nextMonth} aria-label="Next month">›</button>
      </div>
      <div class="day-names">
        {#each DAYS as d}
          <span class="day-name">{d}</span>
        {/each}
      </div>
      <div class="grid">
        {#each days() as d}
          {#if d == null}
            <span class="empty"></span>
          {:else}
            <button
              class="day"
              class:today={d === today.d && viewMonth === today.m && viewYear === today.y}
              onclick={() => pick(d)}
            >
              {d}
            </button>
          {/if}
        {/each}
      </div>
      <div class="footer">
        <button class="close-btn" onclick={() => onclose?.()}>✕</button>
      </div>
    </div>
  </div>
{/if}

<style>
  .overlay {
    position: fixed;
    inset: 0;
    background: rgba(0,0,0,0.4);
    display: flex;
    align-items: center;
    justify-content: center;
    z-index: 300;
  }
  .calendar {
    background: var(--surface);
    border-radius: 12px;
    width: 320px;
    box-shadow: 0 8px 40px rgba(0,0,0,0.15);
    padding: 16px;
    display: flex;
    flex-direction: column;
    gap: 10px;
  }
  .header {
    display: flex;
    align-items: center;
    justify-content: space-between;
  }
  .label {
    font-weight: 600;
    font-size: 0.95em;
    color: var(--fg);
  }
  .nav {
    background: none;
    border: none;
    font-size: 1.3em;
    cursor: pointer;
    color: var(--muted);
    padding: 4px 8px;
    border-radius: 4px;
    line-height: 1;
  }
  .nav:hover {
    background: var(--hover);
    color: var(--fg);
  }
  .day-names {
    display: grid;
    grid-template-columns: repeat(7, 1fr);
    text-align: center;
    font-size: 0.75em;
    font-weight: 500;
    color: var(--muted);
  }
  .day-name {
    padding: 4px 0;
  }
  .grid {
    display: grid;
    grid-template-columns: repeat(7, 1fr);
    gap: 2px;
  }
  .empty {
    padding: 6px 0;
  }
  .day {
    background: none;
    border: none;
    border-radius: 6px;
    padding: 6px 0;
    font-size: 0.85em;
    cursor: pointer;
    color: var(--fg);
    text-align: center;
    transition: background 0.1s;
  }
  .day:hover {
    background: var(--hover);
  }
  .day.today {
    background: var(--accent);
    color: #fff;
    font-weight: 600;
  }
  .day.today:hover {
    filter: brightness(1.1);
  }
  .footer {
    display: flex;
    justify-content: flex-end;
  }
  .close-btn {
    background: none;
    border: none;
    font-size: 1em;
    cursor: pointer;
    color: var(--muted);
    padding: 4px 6px;
    border-radius: 4px;
  }
  .close-btn:hover {
    color: var(--fg);
    background: var(--hover);
  }
</style>