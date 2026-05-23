<script>
  let { headings = [], onNavigate } = $props()
</script>

<aside class="sidebar">
  <nav>
    {#each headings as heading, i}
      <button
        class="item"
        style="padding-left: {heading.level === 2 ? '1.2em' : '0.5em'}"
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
    left: 0;
    top: 50%;
    transform: translateY(-50%);
    width: 200px;
    padding: 12px 0;
    opacity: 0.2;
    transition: opacity 0.3s;
    z-index: 50;
  }
  .sidebar:hover { opacity: 0.8; }
  .item {
    display: block;
    width: 100%;
    text-align: left;
    padding: 3px 16px;
    border: none;
    background: none;
    font-size: 0.75em;
    color: var(--fg);
    cursor: pointer;
    line-height: 1.5;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
    opacity: 0.5;
    font-family: 'Roboto Mono', monospace;
  }
  .item:hover { opacity: 1; }
</style>
