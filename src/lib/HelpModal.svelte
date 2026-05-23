<script>
  let { open = false, onclose } = $props()

  function handleOverlayClick(e) {
    if (e.target === e.currentTarget) onclose?.()
  }
</script>

{#if open}
  <div class="overlay" onclick={handleOverlayClick} onkeydown={(e) => e.key === 'Escape' && onclose?.()} role="dialog" tabindex="-1">
    <div class="modal">
      <div class="modal-header">
        <h2>Help</h2>
        <button class="close" onclick={() => onclose?.()}>✕</button>
      </div>
      <div class="modal-body">
        <section>
          <h3>Writing</h3>
          <div class="grid">
            <span>Type <code>/</code> for blocks</span><span>Headings, toggles, lists, code</span>
            <span>Bold</span><span><code>Ctrl/Cmd + B</code></span>
            <span>Italic</span><span><code>Ctrl/Cmd + I</code></span>
            <span>Link</span><span><code>Ctrl/Cmd + K</code></span>
            <span>Code block</span><span><code>Ctrl/Cmd + Shift + C</code></span>
          </div>
        </section>
        <section>
          <h3>AI & Views</h3>
          <div class="grid">
            <span>Organize with AI</span><span><code>Ctrl/Cmd + ⌥ + O</code></span>
            <span>Voice input</span><span>Click <i class="fa-solid fa-microphone"></i></span>
            <span>Voice input</span><span>Click <i class="fa-solid fa-microphone"></i> or system dictation</span>
          </div>
        </section>
        <section>
          <h3>Appearance</h3>
          <div class="grid">
            <span>Cycle theme</span><span><code>Ctrl/Cmd + ⌥ + E</code></span>
            <span>Cycle font</span><span><code>Ctrl/Cmd + ⌥ + A</code></span>
            <span>Fullscreen</span><span><code>Ctrl/Cmd + ⌥ + F</code></span>
          </div>
        </section>
        <section>
          <h3>Document</h3>
          <div class="grid">
            <span>Download</span><span><code>Ctrl/Cmd + S</code></span>
            <span>Print</span><span><code>Ctrl/Cmd + P</code></span>
            <span>Search</span><span><code>Ctrl/Cmd + F</code></span>
          </div>
        </section>
      </div>
    </div>
  </div>
{/if}

<style>
  .overlay {
    position: fixed; inset: 0;
    background: rgba(0,0,0,0.4);
    display: flex; align-items: center; justify-content: center;
    z-index: 200;
  }
  .modal {
    background: var(--surface);
    border-radius: 12px;
    width: 500px;
    max-width: 90vw;
    box-shadow: 0 8px 40px rgba(0,0,0,0.15);
  }
  .modal-header {
    display: flex; align-items: center; justify-content: space-between;
    padding: 16px 20px;
    border-bottom: 1px solid var(--border);
  }
  .modal-header h2 { margin: 0; font-size: 1.1em; font-weight: 600; }
  .close {
    background: none; border: none; font-size: 1.1em; cursor: pointer;
    color: var(--muted); padding: 4px;
  }
  .close:hover { color: var(--fg); }
  .modal-body { padding: 20px; display: flex; flex-direction: column; gap: 16px; }
  section { }
  section h3 {
    font-size: 0.8em; text-transform: uppercase; letter-spacing: 0.05em;
    margin: 0 0 8px; font-weight: 600; color: var(--muted);
  }
  .grid {
    display: grid;
    grid-template-columns: 1fr auto;
    gap: 4px 12px;
    font-size: 0.85em;
  }
  .grid span:nth-child(even) { text-align: right; }
  code {
    font-family: 'Roboto Mono', monospace;
    font-size: 0.85em;
    padding: 2px 6px;
    background: var(--code-bg);
    border-radius: 3px;
  }
  i { color: var(--accent); }
</style>
