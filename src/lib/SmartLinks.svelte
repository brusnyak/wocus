<script>
  let {
    noteText = '',
    headingElements = []
  } = $props()

  let expanded = $state(false)

  let relations = $derived(findRelations(headingElements))

  function countSharedWords(a, b) {
    const wordsA = new Set(a.split(/\s+/).filter(w => w.length > 3))
    const wordsB = b.split(/\s+/).filter(w => w.length > 3)
    return wordsB.filter(w => wordsA.has(w)).length
  }

  function findRelations(headings) {
    const pairs = []
    for (let i = 0; i < headings.length; i++) {
      for (let j = i + 1; j < headings.length; j++) {
        const a = headings[i].content.toLowerCase()
        const b = headings[j].content.toLowerCase()
        const score = countSharedWords(a, b)
        if (score > 0) {
          pairs.push({ from: headings[i].content, to: headings[j].content, score })
        }
      }
    }
    return pairs.sort((a, b) => b.score - a.score).slice(0, 5)
  }

  function toggle() {
    expanded = !expanded
  }
</script>

<div class="smartlinks" class:expanded>
  <button class="toggle" onclick={toggle} aria-label={expanded ? 'Collapse related sections' : 'Show related sections'}>
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
      <path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"/>
      <path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"/>
    </svg>
    <span class="label">Related{relations.length > 0 ? ` (${relations.length})` : ''}</span>
  </button>

  {#if expanded}
    <div class="card">
      <div class="header">
        <span class="title">Related sections</span>
      </div>
      <div class="body">
        {#if relations.length > 0}
          <ul class="list">
            {#each relations as rel}
              <li class="pair">
                <span class="from">{rel.from}</span>
                <span class="arrow">↔</span>
                <span class="to">{rel.to}</span>
              </li>
            {/each}
          </ul>
        {:else}
          <div class="empty">
            Add more headings to see related sections
          </div>
        {/if}
      </div>
    </div>
  {/if}
</div>

<style>
  .smartlinks {
    position: fixed;
    bottom: 80px;
    left: 50%;
    transform: translateX(-50%);
    z-index: 999;
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 8px;
    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
  }

  .toggle {
    display: flex;
    align-items: center;
    gap: 6px;
    padding: 6px 14px;
    border: 1px solid var(--border);
    border-radius: 20px;
    background: var(--surface);
    color: var(--fg);
    cursor: pointer;
    font-size: 0.78em;
    font-family: inherit;
    box-shadow: 0 2px 8px rgba(0,0,0,0.08);
    transition: background 0.15s, box-shadow 0.15s;
  }
  .toggle:hover {
    background: var(--bg);
    box-shadow: 0 2px 12px rgba(0,0,0,0.12);
  }

  .label {
    font-weight: 500;
  }

  .card {
    width: 300px;
    max-height: 280px;
    background: var(--surface);
    border: 1px solid var(--border);
    border-radius: 10px;
    box-shadow: 0 4px 20px rgba(0,0,0,0.1);
    overflow: hidden;
    animation: slideUp 0.15s ease-out;
  }

  @keyframes slideUp {
    from { opacity: 0; transform: translateY(6px); }
    to { opacity: 1; transform: translateY(0); }
  }

  .header {
    padding: 8px 12px;
    border-bottom: 1px solid var(--border);
    background: var(--bg);
  }

  .title {
    font-size: 0.78em;
    font-weight: 600;
    color: var(--muted);
    text-transform: uppercase;
    letter-spacing: 0.04em;
  }

  .body {
    padding: 8px 12px;
    max-height: 220px;
    overflow-y: auto;
  }

  .list {
    display: flex;
    flex-direction: column;
    gap: 6px;
    list-style: none;
    margin: 0;
    padding: 0;
  }

  .pair {
    display: flex;
    align-items: center;
    gap: 6px;
    font-size: 0.82em;
    padding: 6px 8px;
    border-radius: 6px;
    background: var(--bg);
    transition: background 0.12s;
  }
  .pair:hover {
    background: var(--hover, color-mix(in srgb, var(--border) 30%, transparent));
  }

  .from,
  .to {
    font-weight: 500;
    color: var(--fg);
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
    max-width: 110px;
  }

  .arrow {
    flex-shrink: 0;
    color: var(--muted);
    font-size: 0.9em;
  }

  .empty {
    text-align: center;
    color: var(--muted);
    font-size: 0.82em;
    padding: 20px 8px;
    line-height: 1.5;
  }
</style>