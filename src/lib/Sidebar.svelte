<script>
  let { headings = [], onNavigate } = $props()
</script>

<aside class="sidebar">
  <nav>
    {#each headings as heading, i}
      <button
        class="item"
        class:h2={heading.level === 2}
        onclick={() => onNavigate?.(i)}
      >
        <span class="dot"></span>
        <span class="label">{heading.content}</span>
      </button>
    {/each}
  </nav>
</aside>

<style>
  .sidebar {
    position: fixed;
    left: 0;
    top: 50%;
    transform: translateY(-50%);
    width: 200px;
    padding: 12px 0;
    opacity: 0;
    transition: opacity 0.25s;
    z-index: 50;
  }
  .sidebar:hover { opacity: 1; }
  .item {
    display: flex;
    align-items: center;
    gap: 8px;
    width: 100%;
    text-align: left;
    padding: 4px 16px;
    border: none;
    background: none;
    cursor: pointer;
    font-size: 0.75em;
    color: var(--muted);
    line-height: 1.5;
    font-family: 'Roboto Mono', monospace;
    transition: color 0.15s;
  }
  .item.h2 { padding-left: 28px; }
  .item:hover { color: var(--fg); }
  .dot {
    width: 4px; height: 4px; border-radius: 50%;
    background: var(--muted); flex-shrink: 0;
  }
  .item:hover .dot { background: var(--accent); }
  .label {
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
</style>
