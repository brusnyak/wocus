<script>
  import { getSettings, PROVIDERS } from './settings.svelte.js'

  let { open = false, onclose } = $props()
  let s = $derived(getSettings())

  let activeProvider = $state('openrouter')
  let endpoint = $state('')
  let key = $state('')
  let model = $state('')
  let customEndpoint = $state('')
  let testing = $state(false)
  let testResult = $state('')

  let currentModels = $derived(PROVIDERS[activeProvider]?.models || [])
  let isCustom = $derived(activeProvider === 'custom')

  $effect(() => {
    if (open) {
      activeProvider = s.provider
      endpoint = s.apiEndpoint
      key = s.apiKey
      model = s.modelName
      customEndpoint = ''
      if (activeProvider === 'custom') customEndpoint = s.apiEndpoint
      testResult = ''
    }
  })

  function onProviderChange() {
    if (activeProvider === 'custom') {
      customEndpoint = endpoint
      return
    }
    const p = PROVIDERS[activeProvider]
    if (p) {
      endpoint = p.endpoint
      model = p.models[0] || model
    }
  }

  async function handleSave() {
    s.provider = activeProvider
    s.apiEndpoint = isCustom ? customEndpoint : endpoint
    s.apiKey = key.trim()
    s.modelName = model
    await s.save()
    onclose?.()
  }

  async function testConnection() {
    const cleanKey = key.trim()
    if (cleanKey && !cleanKey.startsWith('sk-') && activeProvider === 'openrouter') {
      testResult = '⚠️ Keys usually start with sk- — make sure you pasted the full key'
    }
    if (!cleanKey) {
      testResult = '❌ Enter an API key first'
      return
    }
    if (!model || model === 'openrouter-free') {
      testResult = '⚠️ "openrouter-free" is not a valid model. Try openrouter/auto or model:free (e.g. mistralai/mistral-7b-instruct:free)'
      testing = false
      return
    }
    testing = true
    testResult = ''
    const ep = isCustom ? customEndpoint : endpoint
    try {
      const isOllama = activeProvider === 'ollama' || ep.includes('localhost') || ep.includes('0.0.0.0')
      const body = isOllama
        ? { model, prompt: 'Say "ok" and nothing else.', stream: false }
        : { model, messages: [{ role: 'user', content: 'Say "ok" and nothing else.' }], max_tokens: 10 }
      const headers = {
        'Content-Type': 'application/json',
        ...(isOllama ? {} : { 'Authorization': `Bearer ${cleanKey}` })
      }
      const res = await fetch(ep, { method: 'POST', headers, body: JSON.stringify(body) })
      if (res.ok) {
        testResult = '✅ Connection OK'
      } else {
        const text = await res.text().catch(() => 'Unknown')
        testResult = `❌ ${res.status}: ${text.slice(0, 150)}`
      }
    } catch (e) {
      testResult = `❌ ${e.message}`
    }
    testing = false
  }

  function handleOverlayClick(e) {
    if (e.target === e.currentTarget) onclose?.()
  }
</script>

{#if open}
  <div class="modal-overlay" onclick={handleOverlayClick} onkeydown={(e) => e.key === 'Escape' && onclose?.()} role="dialog" tabindex="-1">
    <div class="modal">
      <div class="modal-header">
        <h2>Settings</h2>
        <button class="close-btn" onclick={() => onclose?.()}>✕</button>
      </div>
      <div class="modal-body">
        <label class="field">
          <span>Provider</span>
          <select bind:value={activeProvider} onchange={onProviderChange}>
            {#each Object.entries(PROVIDERS) as [key, p]}
              <option value={key}>{p.label}</option>
            {/each}
          </select>
        </label>

        {#if isCustom}
          <label class="field">
            <span>API Endpoint</span>
            <input type="url" bind:value={customEndpoint} placeholder="https://..." />
          </label>
        {:else}
          <label class="field">
            <span>API Endpoint</span>
            <input type="url" bind:value={endpoint} disabled class="auto-filled" />
          </label>
        {/if}

        <label class="field">
          <span>API Key</span>
          <input type="password" bind:value={key} placeholder={activeProvider === 'ollama' ? 'Not needed for local models' : 'sk-...'} disabled={activeProvider === 'ollama'} />
        </label>

        <label class="field">
          <span>Model</span>
          <input type="text" bind:value={model} list="model-suggestions" placeholder={activeProvider === 'openrouter' ? 'openrouter/auto, model:free, ...' : activeProvider === 'ollama' ? 'llama3, mistral, ...' : 'gpt-4o, ...'} />
          {#if currentModels.length > 0}
            <datalist id="model-suggestions">
              {#each currentModels as m}
                <option value={m}></option>
              {/each}
            </datalist>
          {/if}
        </label>

        <label class="field toggle-field">
          <span class="toggle-label">
            <span>Link Context Analysis</span>
            <span class="toggle-desc">When enabled, AI analyzes URLs in your notes and provides mini-summaries</span>
          </span>
          <label class="switch">
            <input type="checkbox" checked={s.linkAnalysis} onchange={(e) => s.linkAnalysis = e.target.checked} />
            <span class="slider"></span>
          </label>
        </label>

        <button class="test-btn" onclick={testConnection} disabled={testing}>
          {testing ? 'Testing...' : 'Test Connection'}
        </button>
        {#if testResult}
          <p class="test-result">{testResult}</p>
        {/if}
      </div>
      <div class="modal-footer">
        <button class="cancel-btn" onclick={() => onclose?.()}>Cancel</button>
        <button class="save-btn" onclick={handleSave}>Save</button>
      </div>
    </div>
  </div>
{/if}

<style>
  .modal-overlay {
    position: fixed;
    inset: 0;
    background: rgba(0,0,0,0.4);
    display: flex;
    align-items: center;
    justify-content: center;
    z-index: 200;
  }
  .modal {
    background: var(--surface);
    border-radius: 12px;
    width: 440px;
    max-width: 90vw;
    box-shadow: 0 8px 40px rgba(0,0,0,0.15);
  }
  .modal-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 16px 20px;
    border-bottom: 1px solid var(--border);
  }
  .modal-header h2 {
    margin: 0;
    font-size: 1.1em;
    font-weight: 600;
  }
  .close-btn {
    background: none;
    border: none;
    font-size: 1.1em;
    cursor: pointer;
    color: var(--muted);
    padding: 4px;
  }
  .close-btn:hover { color: var(--fg); }
  .modal-body {
    padding: 20px;
    display: flex;
    flex-direction: column;
    gap: 14px;
  }
  .field {
    display: flex;
    flex-direction: column;
    gap: 4px;
  }
  .field span {
    font-size: 0.85em;
    font-weight: 500;
    color: var(--muted);
  }
  .field input, .field select {
    padding: 8px 10px;
    border: 1px solid var(--border);
    border-radius: 6px;
    font-size: 0.9em;
    background: var(--surface);
    color: var(--fg);
  }
  .field select {
    cursor: pointer;
  }
  .field input:focus, .field select:focus {
    outline: none;
    border-color: var(--accent);
  }
  .field input:disabled {
    opacity: 0.6;
    cursor: not-allowed;
  }
  .field input.auto-filled {
    font-family: 'Roboto Mono', monospace;
    font-size: 0.8em;
  }
  .toggle-field {
    flex-direction: row;
    align-items: center;
    justify-content: space-between;
}
.toggle-label {
    display: flex;
    flex-direction: column;
    gap: 2px;
}
.toggle-desc {
    font-size: 0.78em;
    color: var(--muted);
    font-weight: 400;
}
.switch {
    position: relative;
    display: inline-block;
    width: 36px;
    height: 20px;
    flex-shrink: 0;
}
.switch input { opacity: 0; width: 0; height: 0; }
.slider {
    position: absolute;
    cursor: pointer;
    inset: 0;
    background: var(--border);
    border-radius: 20px;
    transition: 0.2s;
}
.slider::before {
    content: '';
    position: absolute;
    height: 14px;
    width: 14px;
    left: 3px;
    bottom: 3px;
    background: #fff;
    border-radius: 50%;
    transition: 0.2s;
}
.switch input:checked + .slider { background: var(--accent); }
.switch input:checked + .slider::before { transform: translateX(16px); }

.test-btn {
    padding: 8px 14px;
    border: 1px solid var(--border);
    border-radius: 6px;
    background: var(--surface);
    cursor: pointer;
    font-size: 0.85em;
    align-self: flex-start;
    color: var(--fg);
  }
  .test-btn:hover { background: var(--hover); }
  .test-btn:disabled { opacity: 0.5; }
  .test-result { font-size: 0.85em; margin: 0; }
  .modal-footer {
    display: flex;
    justify-content: flex-end;
    gap: 8px;
    padding: 12px 20px;
    border-top: 1px solid var(--border);
  }
  .cancel-btn, .save-btn {
    padding: 8px 16px;
    border-radius: 6px;
    font-size: 0.9em;
    cursor: pointer;
  }
  .cancel-btn {
    background: none;
    border: 1px solid var(--border);
    color: var(--fg);
  }
  .save-btn {
    background: var(--accent);
    border: none;
    color: #fff;
    font-weight: 500;
  }
  .save-btn:hover { opacity: 0.9; }
</style>
