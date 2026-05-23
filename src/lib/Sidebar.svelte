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
        {heading.content}
      </button>
    {/each}
  </nav>
</aside>

<style>
  .sidebar {
    position: fixed;
    right: 0;
    top: 50%;
    transform: translateY(-50%);
    width: 200px;
    padding: 12px 0;
    opacity: 0.15;
    transition: opacity 0.3s;
    z-index: 50;
  }
  .sidebar:hover { opacity: 0.8; }
  .item {
    display: block;
    width: 100%;
    text-align: right;
    padding: 3px 16px;
    border: none;
    background: none;
    cursor: pointer;
    font-size: 0.75em;
    color: var(--fg);
    line-height: 1.5;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
    opacity: 0.5;
    font-family: 'Roboto Mono', monospace;
    border-right: 2px solid transparent;
  }
  .item.h2 { padding-right: 24px; font-size: 0.7em; }
  .item:hover { opacity: 1; border-right-color: var(--accent); }
</style>
