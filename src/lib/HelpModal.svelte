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
        <h3>Features</h3>
        <table><tbody>
          <tr><td>Organize with AI</td><td><code>Ctrl/Cmd + Shift + O</code></td></tr>
          <tr><td>Toggle Raw / Organized</td><td><code>Ctrl/Cmd + Shift + V</code></td></tr>
          <tr><td>Change theme</td><td><code>Ctrl/Cmd + Shift + E</code></td></tr>
          <tr><td>Change font</td><td><code>Ctrl/Cmd + Shift + A</code></td></tr>
          <tr><td>Download</td><td><code>Ctrl/Cmd + S</code></td></tr>
          <tr><td>Print</td><td><code>Ctrl/Cmd + P</code></td></tr>
          <tr><td>Fullscreen</td><td><code>Ctrl/Cmd + Shift + F</code></td></tr>
        </tbody></table>
        <h3>Markdown</h3>
        <table><tbody>
          <tr><td>Bold</td><td><code>Ctrl/Cmd + B</code></td></tr>
          <tr><td>Italic</td><td><code>Ctrl/Cmd + I</code></td></tr>
          <tr><td>Insert link</td><td><code>Ctrl/Cmd + K</code></td></tr>
          <tr><td>Code block</td><td><code>Ctrl/Cmd + Shift + C</code></td></tr>
        </tbody></table>
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
    width: 460px;
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
  .modal-body { padding: 20px; }
  .modal-body h3 { font-size: 0.9em; margin: 1em 0 0.5em; font-weight: 600; color: var(--muted); }
  .modal-body h3:first-child { margin-top: 0; }
  table { width: 100%; border-collapse: collapse; }
  td { padding: 4px 0; font-size: 0.85em; }
  td:last-child { text-align: right; }
  code {
    font-family: 'Roboto Mono', monospace;
    font-size: 0.85em;
    padding: 2px 6px;
    background: var(--code-bg);
    border-radius: 3px;
  }
</style>
