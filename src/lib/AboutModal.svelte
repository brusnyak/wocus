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
        <h2>About Wocus</h2>
        <button class="close" onclick={() => onclose?.()}>✕</button>
      </div>
      <div class="modal-body">
        <p>Wocus is a minimal, private, local-first note-taking app with AI-powered organization.</p>
        <p>All data stays in your browser (IndexedDB). Nothing is sent to any server unless you explicitly trigger the AI organize feature with your own API key.</p>

        <h3>Privacy & Security</h3>
        <p>Wocus is fully local-first. Your notes, settings, and API key never leave your device unless you choose to organize with AI — and even then, data goes only to the API endpoint you configure. Wocus has no servers, no databases, no analytics, no tracking.</p>

        <h3>Terms of Use</h3>
        <p>Wocus is provided as-is, free to use, with no warranty. You are responsible for your own API key usage and costs. The app does not collect or transmit any personal data. By using the AI organize feature, your text is sent to the third-party API provider you configured; review their terms separately.</p>

        <div class="links">
          <a href="https://github.com/brusnyak/wocus" target="_blank" rel="noopener">GitHub</a>
          &middot;
          <a href="mailto:email.trader4u@gmail.com">Contact</a>
        </div>
        <p class="credits">Built with Svelte · TipTap · IndexedDB</p>
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
  .modal-body { padding: 20px; display: flex; flex-direction: column; gap: 10px; }
  .modal-body p { font-size: 0.9em; line-height: 1.6; margin: 0; }
  .modal-body h3 { font-size: 0.9em; margin: 0.5em 0 0.2em; font-weight: 600; color: var(--muted); }
  .modal-body h3:first-of-type { margin-top: 0; }
  .links { text-align: center; margin-top: 0.5em; }
  .links a { color: var(--accent); text-decoration: none; }
  .links a:hover { text-decoration: underline; }
  .credits { text-align: center; font-size: 0.8em !important; color: var(--muted); }
</style>
