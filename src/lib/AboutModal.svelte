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
        <div class="hero">
          <span class="logo">W</span>
          <div>
            <h3>Wocus</h3>
            <p class="tagline">Minimal, private, local-first note-taking<br/>with AI-powered organization.</p>
          </div>
        </div>

        <div class="section">
          <div class="section-icon"><i class="fa-solid fa-shield-halved"></i></div>
          <div>
            <h4>Privacy & Security</h4>
            <p>Wocus is fully local-first. Your notes, settings, and API key never leave your device unless you choose to organize with AI — and even then, data goes only to the API endpoint you configure. Wocus has no servers, no databases, no analytics, no tracking.</p>
          </div>
        </div>

        <div class="section">
          <div class="section-icon"><i class="fa-solid fa-scale-balanced"></i></div>
          <div>
            <h4>Terms of Use</h4>
            <p>Wocus is provided as-is, free to use, with no warranty. You are responsible for your own API key usage and costs. The app does not collect or transmit any personal data. By using the AI organize feature, your text is sent to the third-party API provider you configured; review their terms separately.</p>
          </div>
        </div>

        <div class="links">
          <a href="https://github.com/brusnyak/wocus" target="_blank" rel="noopener"><i class="fa-brands fa-github"></i> GitHub</a>
          <span class="sep">&middot;</span>
          <a href="mailto:email.trader4u@gmail.com"><i class="fa-solid fa-envelope"></i> Contact</a>
        </div>
        <p class="credits">Svelte &middot; TipTap &middot; IndexedDB</p>
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
    width: 520px;
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
  .modal-body { padding: 24px; display: flex; flex-direction: column; gap: 20px; }

  .hero {
    display: flex; align-items: center; gap: 16px;
  }
  .logo {
    display: flex; align-items: center; justify-content: center;
    width: 48px; height: 48px; border-radius: 12px;
    background: var(--accent); color: #fff;
    font-size: 1.6em; font-weight: 700; font-family: 'Roboto Mono', monospace;
    flex-shrink: 0;
  }
  .hero h3 { margin: 0; font-size: 1.1em; font-weight: 600; }
  .tagline { font-size: 0.85em; color: var(--muted); line-height: 1.5; margin: 2px 0 0; }

  .section {
    display: flex; gap: 12px; align-items: flex-start;
  }
  .section-icon {
    width: 28px; flex-shrink: 0; text-align: center; color: var(--accent); font-size: 1em;
    margin-top: 2px;
  }
  .section h4 { margin: 0 0 4px; font-size: 0.9em; font-weight: 600; }
  .section p { font-size: 0.85em; line-height: 1.6; margin: 0; color: var(--fg); opacity: 0.85; }

  .links {
    text-align: center; margin-top: 4px;
  }
  .links a {
    color: var(--accent); text-decoration: none; font-size: 0.85em;
  }
  .links a:hover { text-decoration: underline; }
  .sep { color: var(--muted); margin: 0 8px; font-size: 0.85em; }
  .credits {
    text-align: center; font-size: 0.75em !important; color: var(--muted); margin: 0;
  }
</style>
