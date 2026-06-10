<script>
  import { getSettings, PROVIDERS } from './settings.svelte.js'
  import { getDb } from './db.js'

  let { open = false, onclose } = $props()
  let s = $derived(getSettings())

  let activeTab = $state('connection')
  let activeProvider = $state('openrouter')
  let endpoint = $state('')
  let key = $state('')
  let model = $state('')
  let customEndpoint = $state('')
  let testing = $state(false)
  let testResult = $state('')

  let templates = $state([])
  let templateName = $state('')
  let savingTemplate = $state(false)

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
      loadTemplates()
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
      testResult = '⚠️ "openrouter-free" is not a valid model. Try openrouter/auto or model:free'
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

  async function loadTemplates() {
    const db = await getDb()
    const all = await db.getAll('templates')
    templates = all.sort((a, b) => b.createdAt - a.createdAt)
  }

  async function saveTemplateFromSettings() {
    const name = templateName.trim()
    if (!name) return
    savingTemplate = true
    const db = await getDb()
    const currentNote = await db.get('notes', 1)
    await db.put('templates', {
      id: Date.now().toString(),
      name,
      content: currentNote?.content || '',
      html: currentNote?.html || '',
      text: currentNote?.text || '',
      createdAt: Date.now()
    })
    templateName = ''
    savingTemplate = false
    await loadTemplates()
  }

  async function deleteTemplate(id) {
    const db = await getDb()
    await db.delete('templates', id)
    await loadTemplates()
  }

  async function applyTemplateFromSettings(t) {
    const db = await getDb()
    const note = await db.get('notes', 1)
    if (!note) return
    note.content = t.content
    note.html = t.html
    note.text = t.text
    note.updatedAt = Date.now()
    await db.put('notes', note)
    onclose?.()
    setTimeout(() => window.location.reload(), 100)
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
      <div class="tabs">
        <button class="tab" class:active={activeTab === 'connection'} onclick={() => activeTab = 'connection'}>Connection</button>
        <button class="tab" class:active={activeTab === 'templates'} onclick={() => activeTab = 'templates'}>Templates</button>
      </div>
      <div class="modal-body">
        {#if activeTab === 'connection'}
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

          <label class="field toggle-field">
            <span class="toggle-label">
              <span>Typing Sound</span>
              <span class="toggle-desc">Synthesized mechanical keyboard click (no audio files needed)</span>
            </span>
            <label class="switch">
              <input type="checkbox" checked={s.typingSound} onchange={(e) => s.typingSound = e.target.checked} />
              <span class="slider"></span>
            </label>
          </label>

          {#if s.typingSound}
            <label class="field">
              <span class="field-label">Sound Volume</span>
              <div style="display:flex;align-items:center;gap:8px">
                <i class="fa-solid fa-volume-low" style="font-size:0.7em;color:var(--muted)"></i>
                <input type="range" min="0" max="1" step="0.05" value={s.soundVolume} oninput={(e) => s.soundVolume = parseFloat(e.target.value)} style="flex:1" />
                <i class="fa-solid fa-volume-high" style="font-size:0.7em;color:var(--muted)"></i>
                <span style="font-size:0.75em;color:var(--muted);min-width:2.5em;text-align:right">{Math.round(s.soundVolume * 100)}%</span>
              </div>
            </label>
          {/if}

          <button class="test-btn" onclick={testConnection} disabled={testing}>
            {testing ? 'Testing...' : 'Test Connection'}
          </button>
          {#if testResult}
            <p class="test-result">{testResult}</p>
          {/if}

        {:else if activeTab === 'templates'}
          <div class="template-section">
            <div class="save-current">
              <input type="text" bind:value={templateName} placeholder="Save current note as template..." onkeydown={(e) => e.key === 'Enter' && saveTemplateFromSettings()} />
              <button class="small-btn" onclick={saveTemplateFromSettings} disabled={!templateName.trim() || savingTemplate}>
                {savingTemplate ? 'Saving...' : 'Save'}
              </button>
            </div>
            <div class="template-grid">
              {#each templates as t}
                <div class="template-card">
                  <div class="card-body">
                    <span class="card-name">{t.name}</span>
                    <span class="card-date">{new Date(t.createdAt).toLocaleDateString()}</span>
                    <span class="card-preview">{t.text?.slice(0, 100) || 'Empty note'}</span>
                  </div>
                  <div class="card-actions">
                    <button class="small-btn primary" onclick={() => applyTemplateFromSettings(t)} title="Apply to note">Apply</button>
                    <button class="small-btn danger" onclick={() => deleteTemplate(t.id)} title="Delete">Delete</button>
                  </div>
                </div>
              {:else}
                <div class="empty-templates">
                  <p>No templates yet. Save your current note as a template, or the defaults will appear once you create some.</p>
                </div>
              {/each}
            </div>
          </div>
        {/if}
      </div>
      {#if activeTab === 'connection'}
        <div class="modal-footer">
          <button class="cancel-btn" onclick={() => onclose?.()}>Cancel</button>
          <button class="save-btn" onclick={handleSave}>Save</button>
        </div>
      {:else}
        <div class="modal-footer">
          <button class="cancel-btn" onclick={() => onclose?.()}>Close</button>
        </div>
      {/if}
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
    width: 520px;
    max-width: 90vw;
    max-height: 85vh;
    display: flex;
    flex-direction: column;
    box-shadow: 0 8px 40px rgba(0,0,0,0.15);
  }
  .modal-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 16px 20px;
    border-bottom: 1px solid var(--border);
    flex-shrink: 0;
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

  .tabs {
    display: flex;
    border-bottom: 1px solid var(--border);
    flex-shrink: 0;
  }
  .tab {
    flex: 1;
    padding: 10px;
    border: none;
    background: none;
    cursor: pointer;
    font-size: 0.85em;
    font-weight: 500;
    color: var(--muted);
    border-bottom: 2px solid transparent;
    transition: color 0.15s, border-color 0.15s;
  }
  .tab:hover { color: var(--fg); }
  .tab.active {
    color: var(--accent);
    border-bottom-color: var(--accent);
  }

  .modal-body {
    padding: 20px;
    display: flex;
    flex-direction: column;
    gap: 14px;
    overflow-y: auto;
    flex: 1;
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
  .field select { cursor: pointer; }
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

  /* Templates tab */
  .template-section {
    display: flex;
    flex-direction: column;
    gap: 16px;
  }
  .save-current {
    display: flex;
    gap: 6px;
  }
  .save-current input {
    flex: 1;
    padding: 8px 10px;
    border: 1px solid var(--border);
    border-radius: 6px;
    font-size: 0.85em;
    background: var(--surface);
    color: var(--fg);
    outline: none;
  }
  .save-current input:focus { border-color: var(--accent); }

  .small-btn {
    padding: 6px 12px;
    border: 1px solid var(--border);
    border-radius: 6px;
    background: var(--surface);
    cursor: pointer;
    font-size: 0.8em;
    color: var(--fg);
    white-space: nowrap;
  }
  .small-btn:hover { background: var(--hover); }
  .small-btn:disabled { opacity: 0.4; cursor: default; }
  .small-btn.primary {
    background: var(--accent);
    border-color: var(--accent);
    color: #fff;
  }
  .small-btn.primary:hover { filter: brightness(1.1); }
  .small-btn.danger { color: #ef4444; }
  .small-btn.danger:hover { background: rgba(220,38,38,0.1); }

  .template-grid {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(200px, 1fr));
    gap: 10px;
    max-height: 400px;
    overflow-y: auto;
  }

  .template-card {
    display: flex;
    flex-direction: column;
    border: 1px solid var(--border);
    border-radius: 8px;
    overflow: hidden;
    background: var(--bg);
    transition: border-color 0.15s;
  }
  .template-card:hover { border-color: var(--accent); }

  .card-body {
    display: flex;
    flex-direction: column;
    gap: 4px;
    padding: 10px 12px;
    flex: 1;
  }
  .card-name {
    font-weight: 600;
    font-size: 0.85em;
    color: var(--fg);
  }
  .card-date {
    font-size: 0.7em;
    color: var(--muted);
  }
  .card-preview {
    font-size: 0.75em;
    color: var(--muted);
    line-height: 1.4;
    display: -webkit-box;
    -webkit-line-clamp: 3;
    -webkit-box-orient: vertical;
    overflow: hidden;
  }

  .card-actions {
    display: flex;
    gap: 4px;
    padding: 6px 10px;
    border-top: 1px solid var(--border);
    background: var(--surface);
  }
  .card-actions .small-btn { flex: 1; text-align: center; padding: 4px 8px; font-size: 0.75em; }

  .empty-templates {
    grid-column: 1 / -1;
    text-align: center;
    padding: 32px 16px;
    color: var(--muted);
    font-size: 0.8em;
  }
  .empty-templates p { margin: 0; }

  .modal-footer {
    display: flex;
    justify-content: flex-end;
    gap: 8px;
    padding: 12px 20px;
    border-top: 1px solid var(--border);
    flex-shrink: 0;
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