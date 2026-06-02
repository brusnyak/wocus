<script>
  let {
    apiEndpoint = '',
    apiKey = '',
    modelName = 'gpt-4o-mini',
    noteText = '',
    hidden = false,
    onOrganize,
    onApply,
    onError,
    onCommand = null,
    appState = null
  } = $props()

  import { detectSensitiveData } from './ai.js'
  import { getAllNotes } from './db.js'

  let open = $state(false)
  let docked = $state(false)
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
  let dragStartX = $state(0)
  let dragStartY = $state(0)
  let dragMoved = $state(false)
  let positioned = $state(false)
  let panelEl = $state(null)
  let headerEl = $state(null)
  let messagesEl = $state(null)
  let inputEl = $state(null)

  function handleMouseDown(e) {
    dragging = true
    dragMoved = false
    const rect = panelEl.getBoundingClientRect()
    dragOffsetX = e.clientX - rect.left
    dragOffsetY = e.clientY - rect.top
    dragStartX = e.clientX
    dragStartY = e.clientY
  }

  function handleMouseMove(e) {
    if (!dragging) return
    if (Math.abs(e.clientX - dragStartX) > 5 || Math.abs(e.clientY - dragStartY) > 5) {
      dragMoved = true
    }
    x = Math.max(0, Math.min(e.clientX - dragOffsetX, window.innerWidth - 60))
    y = Math.max(0, Math.min(e.clientY - dragOffsetY, window.innerHeight - 60))
    positioned = true
  }

  function handleMouseUp() {
    if (!dragging) return
    const moved = dragMoved
    dragging = false
    if (moved) {
      try { localStorage.setItem('wocus_chat_x', x); localStorage.setItem('wocus_chat_y', y) } catch {}
    }
  }

  function restorePosition() {
    try {
      const sx = localStorage.getItem('wocus_chat_x')
      const sy = localStorage.getItem('wocus_chat_y')
      if (sx && sy) { x = +sx; y = +sy; positioned = true }
    } catch {}
  }
  restorePosition()

  function toggleDock() {
    docked = !docked
    if (docked) { open = true }
  }

  function toggle() {
    if (dragMoved) return
    if (docked) { docked = false; open = false; return }
    open = !open
    if (open) {
      error = ''
      if (!welcomeSent) {
        welcomeSent = true
      }
      if (!positioned) {
        x = window.innerWidth - 400
        y = window.innerHeight - 540
        positioned = true
      } else {
        x = Math.min(x, window.innerWidth - 380)
        y = Math.min(y, window.innerHeight - 320)
        x = Math.max(x, 8)
        y = Math.max(y, 8)
      }
      setTimeout(() => inputEl?.focus(), 50)
    }
  }

  function formatAIResponse(text) {
    // Remove woku action blocks from display, execute them
    // Matches both ```woku\n...``` and ```woku appendToNote...```
    const actionRegex = /```(?:wocus|woku)[ \t]*\n?([\s\S]*?)```/g
    let cleaned = text
    let match
    while ((match = actionRegex.exec(text)) !== null) {
      const block = match[1].trim()
      if (block) executeActionBlock(block)
      cleaned = cleaned.replace(match[0], '').trim()
    }
    return cleaned.replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2" target="_blank" rel="noopener noreferrer">$1</a>')
  }

  function executeActionBlock(block) {
    const lines = block.split('\n')
    let appendContent = null

    for (const line of lines) {
      const trimmed = line.trim()
      if (!trimmed) continue

      // If we're accumulating appendToNote content, collect everything until the next action
      if (appendContent !== null) {
        // Check if this line starts a new action (word followed by space or end)
        const nextAction = trimmed.match(/^(\S+)\s*/)
        if (nextAction && ['createnote', 'updatenote', 'seticon', 'settheme', 'setfont', 'navigate', 'appendtonote', 'setsetting'].includes(nextAction[1].toLowerCase())) {
          // Flush previous append before processing new action
          onCommand?.({ action: 'appendToNote', content: appendContent.trimEnd() })
          appendContent = null
        } else {
          appendContent += line + '\n'
          continue
        }
      }

      const parts = trimmed.split(/\s+(.+)/)
      const action = parts[0]?.toLowerCase()
      const args = parts[1] || ''
      switch (action) {
        case 'createnote':
          onCommand?.({ action: 'createNote', title: args || 'Untitled' })
          break
        case 'updatenote':
          // Format: updateNote <id> <content>
          { const match = args.match(/^(\d+)\s+(.+)/)
            if (match) onCommand?.({ action: 'updateNote', noteId: parseInt(match[1]), content: match[2] }) }
          break
        case 'seticon':
          // Format: setIcon <id> <emoji>
          { const match = args.match(/^(\d+)\s+(\S+)/)
            if (match) onCommand?.({ action: 'setIcon', noteId: parseInt(match[1]), icon: match[2] }) }
          break
        case 'settheme':
          onCommand?.({ action: 'setTheme', value: args.trim() })
          break
        case 'setfont':
          onCommand?.({ action: 'setFont', value: args.trim() })
          break
        case 'navigate':
          { const id = parseInt(args.trim(), 10)
            if (!isNaN(id)) onCommand?.({ action: 'navigate', value: id }) }
          break
        case 'appendtonote':
          // Always multi-line: collect same-line content and everything after
          appendContent = args || ''
          if (appendContent) appendContent += '\n'
          break
        case 'setsetting':
          { const match = args.match(/^(\S+)\s+(.+)/)
            if (match) onCommand?.({ action: 'setSetting', key: match[1], value: match[2] }) }
          break
        default:
          // Pass through unknown actions
          onCommand?.({ action, raw: args })
          break
      }
    }

    // Flush any remaining multi-line append content
    if (appendContent !== null) {
      onCommand?.({ action: 'appendToNote', content: appendContent.trimEnd() })
    }
  }

  // Generate a stable session ID for OpenRouter (persists across page loads)
  let sessionId = $state('')
  $effect(() => {
    if (!sessionId) {
      try {
        let sid = localStorage.getItem('woku_session_id')
        if (!sid) {
          sid = crypto.randomUUID ? crypto.randomUUID() : Date.now().toString(36) + Math.random().toString(36).slice(2)
          localStorage.setItem('woku_session_id', sid)
        }
        sessionId = sid
      } catch { sessionId = 'session-' + Date.now() }
    }
  })

  function extractPlainText(html) {
    const div = document.createElement('div')
    div.innerHTML = html
    return div.textContent || div.innerText || ''
  }

  function handleCommand(text) {
    const cmd = text.toLowerCase().trim()
    if (cmd === '/organize') { onOrganize?.(); return true }
    if (cmd === '/clearchat') { messages = []; return true }
    if (cmd.startsWith('/theme ')) {
      const val = cmd.replace('/theme ', '').trim()
      onCommand?.({ action: 'setTheme', value: val })
      return true
    }
    if (cmd.startsWith('/font ')) {
      const val = cmd.replace('/font ', '').trim()
      onCommand?.({ action: 'setFont', value: val })
      return true
    }
    if (cmd.startsWith('/navigate ') || cmd.startsWith('/goto ')) {
      const id = parseInt(cmd.replace(/^\/(navigate|goto) /, '').trim(), 10)
      if (!isNaN(id)) onCommand?.({ action: 'navigate', value: id })
      return true
    }
    return false
  }

  async function send() {
    const text = input.trim()
    if (!text || loading) return

    input = ''
    error = ''

    // Handle local commands first
    if (handleCommand(text)) {
      messages = [...messages, { role: 'user', content: text }]
      return
    }

    const sensitive = detectSensitiveData(text) || (noteText && detectSensitiveData(noteText))
    if (sensitive) {
      const msg = `Your message or note may contain sensitive data:\n\n${sensitive.join('\n')}\n\nThis will be sent to ${modelName}. Continue?`
      if (!confirm(msg)) return
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
    let allNotesContext = '(no other notes)'
    try {
      const all = await getAllNotes()
      if (all.length > 1) {
        allNotesContext = all.map(n =>
          `- "${n.title}" (ID: ${n.id}${n.parentId ? `, parent: ${n.parentId}` : ''}): ${(n.text || '').slice(0, 200)}`
        ).join('\n')
      }
    } catch {}

    // Build app state context
    let stateStr = ''
    if (appState) {
      stateStr = `\nCurrent app state:
- Theme: ${appState.theme || 'light'}
- Font: ${appState.font || 'monospace'}
- Word count: ${appState.wordCount || 0}
- Total notes: ${appState.totalNotes || 0}
`
    }

    const wokuBlock = '```woku'
    const systemPrompt = systemOverride || `You are Woku AI, a friendly and helpful note-taking assistant. The user's current note contains the following text for context:

${noteText || '(empty note)'}

All notes in the workspace:
${allNotesContext}
${stateStr}
Your capabilities:
- Answer questions about the note content or any note in the workspace
- Brainstorm and expand ideas
- Type /summarize to get a concise summary
- Type /organize to restructure the note
- Type /theme dark|light|solarized to change the app theme
- Type /font monospace|serif|sans to change the font

## MANDATORY: Use action blocks to DO things

When the user asks you to write, create, modify, or change anything — you MUST execute it using an action block. DO NOT just describe what you would do. DO IT.

Format — open a fenced code block labeled "${wokuBlock}" on its own line, then one action per line, then close the block:

\`\`\`woku
setTheme dark|light|solarized     — switch theme
setFont monospace|serif|sans      — switch font
navigate {noteId}                  — go to another note
createNote {title}                 — make new note & navigate there
appendToNote                       — write markdown to current note (put content on following lines)
  ## Heading
  - bullet
  - bullet
setSetting {key} {true|false}      — toggle a setting (typingSound, linkAnalysis, autoOrganize, aiEnabled)
\`\`\`

Examples:

User: "outline findings at bottom of note"
You respond with explanation, then:
\`\`\`woku
appendToNote
## Key Findings
- Finding one
- Finding two
\`\`\`

User: "create a note about X" or just "create a note about [...]"
\`\`\`woku
createNote Title About X
\`\`\`

User: "make it dark" or "switch to dark mode"
\`\`\`woku
setTheme dark
\`\`\`

User: "turn on typing sound" or "enable typing sound"
\`\`\`woku
setSetting typingSound true
\`\`\`

User: "research X and write findings to note"
\`\`\`woku
appendToNote
## Research: X
- Finding one
- Finding two
\`\`\`

CRITICAL RULES:
- NEVER just say "I'll do X" — actually do it with an action block.
- Multi-line appendToNote content goes on lines AFTER the action word.
- You can include BOTH explanation text AND action blocks in one response.
- The action block is hidden from display but still executes.
- You can use emoji in appendToNote content.
- Refer to other notes by their title when providing cross-note insights.
- Be concise, practical, and maintain a warm, encouraging tone.`

    // Build conversation history (last 10 exchanges max)
    const history = messages.slice(-20).map(m => ({
      role: m.role,
      content: m.content
    }))

    const body = {
      model: modelName,
      messages: [
        { role: 'system', content: systemPrompt },
        ...history,
        { role: 'user', content: userMessage }
      ]
    }

    // Add OpenRouter session grouping if available
    if (sessionId) body.session_id = sessionId

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

<div class="panel" class:open class:hidden class:docked bind:this={panelEl} style={!docked && positioned ? `left:${x}px;top:${y}px;bottom:auto;right:auto;` : ''}>
  <button class="toggle" onclick={toggle} onmousedown={docked ? undefined : handleMouseDown} aria-label={open ? 'Close chat' : 'Open chat'}>
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
        <span class="title">Woku AI</span>
        <div class="header-actions">
          <button class="dock-btn" onclick={toggleDock} title={docked ? 'Undock' : 'Dock to sidebar'}>
            {#if docked}
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="3" width="18" height="18" rx="2" ry="2"></rect><line x1="9" y1="3" x2="9" y2="21"></line></svg>
            {:else}
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="3" width="18" height="18" rx="2" ry="2"></rect><line x1="15" y1="3" x2="15" y2="21"></line></svg>
            {/if}
          </button>
        </div>
      </div>

      <div class="messages" bind:this={messagesEl}>
        {#if messages.length === 0}
          <div class="empty">
            <div class="welcome-card">
              <div class="welcome-icon">🤖</div>
              <div class="welcome-name">Woku AI</div>
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
  .panel.docked {
    position: fixed;
    right: 0;
    top: 48px;
    bottom: 0;
    width: 340px;
    z-index: 100;
    display: flex;
    flex-direction: column;
    align-items: stretch;
    border-left: 1px solid var(--border);
    background: var(--surface);
    box-shadow: -2px 0 12px rgba(0,0,0,0.06);
  }
  .panel.docked .toggle {
    display: none;
  }
  .panel.docked .card {
    border-radius: 0;
    border: none;
    width: 100%;
    max-height: none;
    min-height: 0;
    height: 100%;
    resize: none;
    animation: none;
    box-shadow: none;
  }
  .panel.docked .header {
    cursor: default;
  }
  .panel.docked .header:active { cursor: default; }

  .panel.docked .messages {
    flex: 1;
  }

  .header-actions {
    display: flex;
    align-items: center;
    gap: 4px;
  }
  .dock-btn {
    display: flex; align-items: center; justify-content: center;
    width: 24px; height: 24px; padding: 0;
    border: none; background: none; cursor: pointer;
    color: var(--muted); border-radius: 4px;
    transition: color 0.15s, background 0.15s;
  }
  .dock-btn:hover { color: var(--fg); background: var(--hover); }

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