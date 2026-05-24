<script>
  let {
    apiEndpoint = '',
    apiKey = '',
    modelName = 'gpt-4o-mini',
    noteText = '',
    hidden = false,
    onOrganize,
    onApply,
    onError
  } = $props()

  let open = $state(false)
  let messages = $state([])
  let input = $state('')
  let loading = $state(false)
  let error = $state('')
  let welcomeSent = $state(false)

  let x = $state(0)
  let y = $state(0)
  let dragging = $state(false)
  let dragOffsetX = $state(0)
  let dragOffsetY = $state(0)
  let positioned = $state(false)
  let panelEl = $state(null)
  let headerEl = $state(null)
  let messagesEl = $state(null)
  let inputEl = $state(null)

  function handleMouseDown(e) {
    dragging = true
    const rect = panelEl.getBoundingClientRect()
    dragOffsetX = e.clientX - rect.left
    dragOffsetY = e.clientY - rect.top
  }

  function handleMouseMove(e) {
    if (!dragging) return
    x = e.clientX - dragOffsetX
    y = e.clientY - dragOffsetY
    positioned = true
  }

  function handleMouseUp() {
    dragging = false
  }

  function toggle() {
    open = !open
    if (open) {
      error = ''
      if (!welcomeSent) {
        welcomeSent = true
        messages = [
          {
            role: 'assistant',
            id: 'welcome',
            content: `👋 Hi! I'm **Wocus AI**, your note-taking assistant. I can help you with:

✨ **Answer questions** about your note
💡 **Brainstorm** ideas and expand on concepts
📝 **Summarize** — type \`/summarize\` for a concise summary
📂 **Organize** — type \`/organize\` to restructure your note
🔍 **Proofread** and suggest improvements

How can I help you today?`
          }
        ]
      }
      setTimeout(() => inputEl?.focus(), 50)
    }
  }

  function formatAIResponse(text) {
    return text.replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2" target="_blank" rel="noopener noreferrer">$1</a>')
  }

  function extractPlainText(html) {
    const div = document.createElement('div')
    div.innerHTML = html
    return div.textContent || div.innerText || ''
  }

  async function send() {
    const text = input.trim()
    if (!text || loading) return

    input = ''
    error = ''

    if (text === '/organize') {
      onOrganize?.()
      messages = [...messages, { role: 'user', content: text }]
      return
    }

    messages = [...messages, { role: 'user', content: text }]
    loading = true

    try {
      let res
      if (text === '/summarize') {
        if (!noteText.trim()) {
          throw new Error('Note is empty — nothing to summarize.')
        }
        const summaryMsg = `Please summarize the following note concisely:\n\n${noteText}`
        res = await fetchAI(summaryMsg, 'Summarize the provided note concisely, capturing the key points.')
      } else {
        res = await fetchAI(text)
      }
      res = formatAIResponse(res)
      messages = [...messages, { role: 'assistant', content: res, id: Date.now() }]
    } catch (e) {
      error = e.message || 'Something went wrong'
      onError?.(error)
    } finally {
      loading = false
    }

    setTimeout(() => {
      if (messagesEl) messagesEl.scrollTop = messagesEl.scrollHeight
    }, 50)
  }

  async function fetchAI(userMessage, systemOverride) {
    const systemPrompt = systemOverride || `You are Wocus AI, a friendly and helpful note-taking assistant. The user's current note contains the following text for context:

${noteText || '(empty note)'}

Your capabilities:
- Answer questions about the note content
- Brainstorm and expand ideas
- Type /summarize to get a concise summary
- Type /organize to restructure the note
- Proofread text and suggest improvements
- Help with writing and editing tasks

Be concise, practical, and maintain a warm, encouraging tone.`

    const body = {
      model: modelName,
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userMessage }
      ]
    }

    const headers = {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${apiKey}`
    }

    const response = await fetch(apiEndpoint, {
      method: 'POST',
      headers,
      body: JSON.stringify(body)
    })

    if (!response.ok) {
      const errText = await response.text().catch(() => 'Unknown error')
      throw new Error(`API error ${response.status}: ${errText}`)
    }

    const data = await response.json()
    const rawText = data.choices?.[0]?.message?.content

    if (!rawText) {
      throw new Error('Empty AI response')
    }

    return rawText
  }

  function handleKeydown(e) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      send()
    }
  }
</script>

<svelte:window
  onmousemove={handleMouseMove}
  onmouseup={handleMouseUp}
/>

<div class="panel" class:open class:hidden bind:this={panelEl} style={positioned ? `left:${x}px;top:${y}px;bottom:auto;right:auto;` : ''}>
  <button class="toggle" onclick={toggle} aria-label={open ? 'Close chat' : 'Open chat'}>
    {#if open}
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
        <line x1="18" y1="6" x2="6" y2="18"></line>
        <line x1="6" y1="6" x2="18" y2="18"></line>
      </svg>
    {:else}
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
        <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"></path>
      </svg>
    {/if}
  </button>

  {#if open}
    <div class="card">
      <div
        class="header"
        bind:this={headerEl}
        onmousedown={handleMouseDown}
        role="toolbar"
        aria-label="Drag handle"
        tabindex="-1"
      >
        <span class="title">Wocus AI</span>
        <span class="dots">
          <span></span><span></span><span></span>
        </span>
      </div>

      <div class="messages" bind:this={messagesEl}>
        {#if messages.length === 0}
          <div class="empty">
            <div class="welcome-card">
              <div class="welcome-icon">🤖</div>
              <div class="welcome-name">Wocus AI</div>
              <div class="welcome-tagline">Your intelligent note-taking assistant</div>
              <div class="welcome-abilities">
                <div class="ability">💬 Answer questions about your note</div>
                <div class="ability">💡 Brainstorm ideas</div>
                <div class="ability">📝 <code>/summarize</code> &mdash; get a concise summary</div>
                <div class="ability">📂 <code>/organize</code> &mdash; restructure your note</div>
                <div class="ability">🔍 Proofread &amp; improve your writing</div>
              </div>
            </div>
          </div>
        {/if}

        {#each messages as msg}
          <div class="msg" class:user={msg.role === 'user'} class:assistant={msg.role === 'assistant'}>
            <div class="bubble">
              {#if msg.role === 'assistant'}
                {@html msg.content}
              {:else}
                {msg.content}
              {/if}
            </div>
            {#if msg.role === 'assistant' && msg.id !== 'welcome'}
              <button class="apply-btn" onclick={() => onApply?.(extractPlainText(msg.content))} title="Apply to note">
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"></polyline></svg>
                Apply to note
              </button>
            {/if}
          </div>
        {/each}

        {#if loading}
          <div class="msg assistant">
            <div class="bubble loading">
              <span class="dot-pulse"></span>
            </div>
          </div>
        {/if}

        {#if error}
          <div class="msg error">
            <div class="bubble">{error}</div>
          </div>
        {/if}
      </div>

      <div class="input-row">
        <input
          bind:this={inputEl}
          type="text"
          bind:value={input}
          onkeydown={handleKeydown}
          placeholder="Ask something..."
          disabled={loading}
        />
        <button class="send" onclick={send} disabled={!input.trim() || loading} aria-label="Send message">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <line x1="22" y1="2" x2="11" y2="13"></line>
            <polygon points="22 2 15 22 11 13 2 9 22 2"></polygon>
          </svg>
        </button>
      </div>
    </div>
  {/if}
</div>

<style>
  .panel {
    position: fixed;
    bottom: 24px;
    right: 24px;
    z-index: 1000;
    display: flex;
    flex-direction: column;
    align-items: flex-end;
    gap: 8px;
    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
  }

  .panel.hidden .toggle {
    opacity: 0;
    pointer-events: none;
  }

  .toggle {
    width: 44px;
    height: 44px;
    border-radius: 50%;
    border: 1px solid var(--border);
    background: var(--accent);
    color: #fff;
    cursor: pointer;
    display: flex;
    align-items: center;
    justify-content: center;
    box-shadow: 0 2px 12px rgba(0,0,0,0.15);
    transition: background 0.15s, transform 0.15s;
    z-index: 1;
    flex-shrink: 0;
  }
  .toggle:hover {
    filter: brightness(1.1);
    transform: scale(1.05);
  }

  .card {
    width: 360px;
    max-height: 500px;
    min-width: 280px;
    min-height: 300px;
    background: var(--surface);
    border: 1px solid var(--border);
    border-radius: 12px;
    display: flex;
    flex-direction: column;
    overflow: auto;
    resize: both;
    box-shadow: 0 4px 24px rgba(0,0,0,0.12);
    animation: slideIn 0.18s ease-out;
  }

  @keyframes slideIn {
    from { opacity: 0; transform: translateY(8px) scale(0.97); }
    to { opacity: 1; transform: translateY(0) scale(1); }
  }

  .header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 10px 14px;
    cursor: grab;
    user-select: none;
    border-bottom: 1px solid var(--border);
    background: var(--bg);
    flex-shrink: 0;
  }
  .header:active { cursor: grabbing; }
  .title {
    font-size: 0.85em;
    font-weight: 600;
    color: var(--fg);
  }
  .dots {
    display: flex;
    gap: 4px;
  }
  .dots span {
    width: 6px;
    height: 6px;
    border-radius: 50%;
    background: var(--muted);
    opacity: 0.4;
  }

  .messages {
    flex: 1;
    overflow-y: auto;
    padding: 12px;
    display: flex;
    flex-direction: column;
    gap: 8px;
    scroll-behavior: smooth;
  }

  .empty {
    text-align: center;
    color: var(--muted);
    font-size: 0.78em;
    padding: 16px 8px;
    line-height: 1.6;
  }

  .welcome-card {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 6px;
  }
  .welcome-icon {
    font-size: 2.4em;
    margin-bottom: 4px;
  }
  .welcome-name {
    font-size: 1.15em;
    font-weight: 700;
    color: var(--fg);
  }
  .welcome-tagline {
    font-size: 0.9em;
    color: var(--muted);
    margin-bottom: 10px;
  }
  .welcome-abilities {
    display: flex;
    flex-direction: column;
    gap: 5px;
    text-align: left;
  }
  .ability {
    background: var(--bg);
    padding: 5px 10px;
    border-radius: 6px;
    font-size: 0.95em;
    color: var(--fg);
  }
  .ability code {
    background: var(--surface);
    padding: 1px 5px;
    border-radius: 3px;
    color: var(--accent);
    font-size: 0.95em;
  }

  .msg {
    display: flex;
  }
  .msg.user {
    justify-content: flex-end;
  }
  .msg.assistant {
    flex-direction: column;
    align-items: flex-start;
  }
  .msg.error {
    justify-content: center;
  }

  .bubble {
    max-width: 85%;
    padding: 8px 12px;
    border-radius: 10px;
    font-size: 0.82em;
    line-height: 1.5;
    white-space: pre-wrap;
    word-break: break-word;
  }
  .bubble :global(a) {
    color: var(--accent);
    text-decoration: underline;
  }
  .msg.user .bubble {
    background: var(--accent);
    color: #fff;
    border-bottom-right-radius: 3px;
  }
  .msg.assistant .bubble {
    background: var(--bg);
    color: var(--fg);
    border-bottom-left-radius: 3px;
  }
  .msg.error .bubble {
    background: rgba(220, 38, 38, 0.1);
    color: #ef4444;
    font-size: 0.78em;
    text-align: center;
    border: 1px solid rgba(220, 38, 38, 0.25);
  }

  .loading .dot-pulse {
    display: inline-block;
    width: 8px;
    height: 8px;
    border-radius: 50%;
    background: var(--muted);
    animation: pulse 1s ease-in-out infinite;
  }
  @keyframes pulse {
    0%, 100% { opacity: 0.3; transform: scale(1); }
    50% { opacity: 1; transform: scale(1.3); }
  }

  .input-row {
    display: flex;
    gap: 6px;
    padding: 10px 12px;
    border-top: 1px solid var(--border);
    background: var(--bg);
    flex-shrink: 0;
  }
  .input-row input {
    flex: 1;
    border: 1px solid var(--border);
    border-radius: 8px;
    padding: 8px 12px;
    font-size: 0.82em;
    background: var(--surface);
    color: var(--fg);
    outline: none;
    font-family: inherit;
  }
  .input-row input::placeholder { color: var(--muted); }
  .input-row input:focus { border-color: var(--accent); }
  .input-row input:disabled { opacity: 0.5; }

  .send {
    width: 36px;
    height: 36px;
    border-radius: 8px;
    border: 1px solid var(--border);
    background: var(--surface);
    color: var(--muted);
    cursor: pointer;
    display: flex;
    align-items: center;
    justify-content: center;
    flex-shrink: 0;
    transition: background 0.15s, color 0.15s;
  }
  .send:hover:not(:disabled) {
    background: var(--accent);
    color: #fff;
    border-color: var(--accent);
  }
  .send:disabled { opacity: 0.35; cursor: default; }

  .apply-btn {
    display: flex;
    align-items: center;
    gap: 4px;
    margin-top: 4px;
    padding: 3px 8px;
    border: 1px solid var(--border);
    border-radius: 5px;
    background: var(--surface);
    color: var(--accent);
    cursor: pointer;
    font-size: 0.72em;
    font-family: inherit;
    transition: background 0.12s;
  }
  .apply-btn:hover {
    background: var(--accent);
    color: #fff;
    border-color: var(--accent);
  }
</style>