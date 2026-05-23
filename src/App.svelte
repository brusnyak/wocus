<script>
  import { onMount } from 'svelte'
  import { TextSelection } from '@tiptap/pm/state'
  import { ensureNote, saveNote } from './lib/db.js'
  import { getSettings } from './lib/settings.svelte.js'
  import { organizeWithAI } from './lib/ai.js'
  import Editor from './lib/Editor.svelte'
  import SettingsModal from './lib/SettingsModal.svelte'
  import HelpModal from './lib/HelpModal.svelte'
  import AboutModal from './lib/AboutModal.svelte'
  import Sidebar from './lib/Sidebar.svelte'

  let s = getSettings()
  let viewMode = $state('raw')
  let settingsOpen = $state(false)
  let helpOpen = $state(false)
  let aboutOpen = $state(false)
  let note = $state(null)
  let loaded = $state(false)
  let organizing = $state(false)
  let error = $state('')
  let headingElements = $state([])
  let editorApi = $state(null)
  let searchOpen = $state(false)
  let searchQuery = $state('')
  let searchMatches = $state([])
  let searchIndex = $state(0)
  let searchInputEl = $state(null)
  let listening = $state(false)
  let recognition = $state(null)
  let interimText = $state('')

  const FONTS = ['monospace', 'serif', 'sans-serif']
  let fontIndex = $state(0)

  const THEMES = ['light', 'dark', 'solarized']
  let themeIndex = $state(0)

  let charCount = $state(0)
  let wordCount = $state(0)

  let theme = $derived(THEMES[themeIndex])
  let font = $derived(FONTS[fontIndex])

  let saveTimer
  let organizePromptResolve = null

  $effect(() => {
    document.documentElement.setAttribute('data-theme', theme)
  })

  async function load() {
    await s.load()
    const n = await ensureNote()
    themeIndex = THEMES.indexOf(s.darkMode ? 'dark' : 'light')
    if (themeIndex === -1) themeIndex = 0
    note = n
    updateCounts(n.content ? textFromJson(n.content) : '')
    loaded = true
  }

  function textFromJson(jsonStr) {
    if (!jsonStr) return ''
    try {
      const data = typeof jsonStr === 'string' ? JSON.parse(jsonStr) : jsonStr
      if (data.type === 'doc' && data.content) {
        return data.content.map(b => {
          const t = b.content ? (Array.isArray(b.content) ? b.content.map(c => c.text || '').join('') : b.content) : ''
          return t
        }).filter(t => t).join('\n\n')
      }
      return ''
    } catch { return '' }
  }

  function updateCounts(text) {
    charCount = text?.length || 0
    wordCount = text?.match(/\S+/g)?.length || 0
  }

  function queueSave() {
    clearTimeout(saveTimer)
    saveTimer = setTimeout(async () => {
      await saveNote($state.snapshot(note))
    }, 400)
  }

  function handleUpdate({ html, json, text }) {
    if (!note || !loaded) return
    note.content = JSON.stringify(json)
    note.html = html
    note.text = text
    updateCounts(text)
    queueSave()
  }

  function blocksToTipTapNode(b) {
    const text = (b.content || '').toString()
    switch (b.type) {
      case 'heading':
        return { type: 'heading', attrs: { level: b.level || 1 }, content: [{ type: 'text', text }] }
      case 'text':
        return { type: 'paragraph', content: [{ type: 'text', text }] }
      case 'toggle':
        return {
          type: 'details',
          attrs: { open: false },
          content: [
            { type: 'detailsSummary', content: [{ type: 'text', text }] },
            { type: 'detailsContent', content: (b.children || []).map(c => ({ type: 'paragraph', content: [{ type: 'text', text: c.content || '' }] })) }
          ]
        }
      case 'divider':
        return { type: 'horizontalRule' }
      case 'todo':
        return {
          type: 'taskList',
          content: [{ type: 'taskItem', attrs: { checked: b.checked || false }, content: [{ type: 'paragraph', content: [{ type: 'text', text }] }] }]
        }
      case 'bullet':
        return {
          type: 'bulletList',
          content: [{ type: 'listItem', content: [{ type: 'paragraph', content: [{ type: 'text', text }] }] }]
        }
      case 'number':
        return {
          type: 'orderedList',
          content: [{ type: 'listItem', content: [{ type: 'paragraph', content: [{ type: 'text', text }] }] }]
        }
      case 'code':
        return { type: 'codeBlock', content: [{ type: 'text', text }] }
      default:
        return { type: 'paragraph', content: [{ type: 'text', text }] }
    }
  }

  function blocksToTipTapJson(blocks) {
    return { type: 'doc', content: blocks.map(blockToTipTapNode) }
  }

  function blocksToHtml(blocks) {
    return blocks.map(b => {
      switch (b.type) {
        case 'heading': return `<h${b.level}>${b.content}</h${b.level}>`
        case 'text': return `<p>${b.content}</p>`
        case 'toggle': return `<details><summary>${b.content}</summary>${(b.children || []).map(c => `<p>${c.content}</p>`).join('')}</details>`
        case 'divider': return '<hr>'
        case 'todo': return `<ul data-type="taskList"><li><label><input type="checkbox" ${b.checked ? 'checked' : ''}>${b.content}</label></li></ul>`
        case 'bullet': return `<p>• ${b.content}</p>`
        case 'number': return `<ol><li>${b.content}</li></ol>`
        case 'code': return `<pre><code>${b.content}</code></pre>`
        default: return `<p>${b.content || ''}</p>`
      }
    }).join('')
  }

  function extractSections(jsonStr) {
    if (!jsonStr) return []
    try {
      const data = typeof jsonStr === 'string' ? JSON.parse(jsonStr) : jsonStr
      const blocks = Array.isArray(data) ? data : (data.content || [])
      const sections = []
      let currentSection = { heading: null, index: 0 }
      blocks.forEach((b, i) => {
        if (b.type === 'divider' || b.type === 'horizontalRule') {
          sections.push({ ...currentSection, isDivider: true })
          currentSection = { heading: null, index: i + 1 }
        } else if (b.type === 'heading' && (b.level === 1 || b.level === 2)) {
          const text = b.content
            ? (Array.isArray(b.content) ? b.content.map(c => c.text || '').join('') : b.content)
            : ''
          currentSection.heading = { level: b.level || 1, content: text, blockIndex: i }
        }
      })
      if (currentSection.heading || sections.length === 0) {
        sections.push(currentSection)
      }
      return sections.filter(s => s.heading)
    } catch { return [] }
  }

  $effect(() => {
    if (viewMode === 'organized' && note?.content) {
      headingElements = extractSections(note.content).map(s => s.heading)
    } else { headingElements = [] }
  })

  function hasStructure(jsonStr) {
    if (!jsonStr) return false
    try {
      const data = typeof jsonStr === 'string' ? JSON.parse(jsonStr) : jsonStr
      const blocks = data.content || []
      return blocks.some(b => ['heading', 'details', 'taskList', 'horizontalRule', 'bulletList', 'orderedList', 'codeBlock'].includes(b.type)
        && b.type !== 'paragraph')
    } catch { return false }
  }

  async function organize() {
    if (!s.hasApiKey()) { error = 'Add an API key in Settings first.'; return }
    const latestText = note?.text || note?.rawText || ''
    if (!latestText) { error = 'Nothing to organize — write some text first.'; return }
    organizing = true; error = ''
    try {
      const result = await organizeWithAI(latestText, {
        apiEndpoint: s.apiEndpoint, apiKey: s.apiKey, modelName: s.modelName
      })
      if (result?.blocks) {
        const tipTapJson = blocksToTipTapJson(result.blocks)
        note.content = JSON.stringify(tipTapJson)
        note.html = blocksToHtml(result.blocks)
        note.text = result.blocks.map(b => b.content || '').join('\n')
        await saveNote($state.snapshot(note))
        viewMode = 'organized'
        requestAnimationFrame(() => loadContent())
      } else { error = 'AI returned unexpected format.' }
    } catch (e) { error = e.message || 'Failed to organize' }
    organizing = false
  }

  function loadContent() {
    if (!editorApi) return
    if (note?.content) {
      try { editorApi.setContent(JSON.parse(note.content)) } catch { editorApi.setContent('') }
    } else { editorApi.setContent('') }
  }

  function handleReady(api) {
    editorApi = api
    loadContent()
  }

  function switchMode(mode) {
    viewMode = mode
  }

  function handleNavigate(index) {
    if (!editorApi) return
    const { view } = editorApi.getEditor()
    const headings = view.dom.querySelectorAll('h1, h2')
    if (headings[index]) headings[index].scrollIntoView({ behavior: 'smooth' })
  }

  function getCurrentEditor() { return editorApi }

  function doSearch() {
    const editor = getCurrentEditor()
    if (!editor || !searchQuery) { searchMatches = []; return }
    const view = editor.getEditor().view
    const doc = view.state.doc
    const matches = []
    const lower = searchQuery.toLowerCase()
    doc.descendants((node, pos) => {
      if (node.isText && node.text) {
        let idx = node.text.toLowerCase().indexOf(lower)
        while (idx !== -1) {
          matches.push({ from: pos + idx, to: pos + idx + searchQuery.length })
          idx = node.text.toLowerCase().indexOf(lower, idx + 1)
        }
      }
    })
    searchMatches = matches
    searchIndex = 0
    if (matches.length > 0) navigateToMatch(0)
  }

  function navigateToMatch(index) {
    const editor = getCurrentEditor()
    if (!editor || !searchMatches.length) return
    const { state, dispatch } = editor.getEditor().view
    const tr = state.tr.setSelection(TextSelection.create(state.doc, searchMatches[index].from, searchMatches[index].to))
    dispatch(tr.scrollIntoView())
    editor.getEditor().view.focus()
  }

  function nextMatch() {
    if (searchMatches.length === 0) return
    searchIndex = (searchIndex + 1) % searchMatches.length
    navigateToMatch(searchIndex)
  }

  function prevMatch() {
    if (searchMatches.length === 0) return
    searchIndex = (searchIndex - 1 + searchMatches.length) % searchMatches.length
    navigateToMatch(searchIndex)
  }

  function toggleVoice() {
    if (listening) { recognition?.stop(); listening = false; interimText = ''; return }
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition
    if (!SpeechRecognition) { error = 'Speech recognition not supported in this browser.'; return }
    const sr = new SpeechRecognition()
    sr.lang = 'en-US'
    sr.interimResults = true
    sr.continuous = true
    let finalizedText = ''
    sr.onresult = (e) => {
      let interim = ''
      for (let i = e.resultIndex; i < e.results.length; i++) {
        const transcript = e.results[i][0].transcript
        if (e.results[i].isFinal) {
          finalizedText += transcript + ' '
        } else {
          interim += transcript
        }
      }
      interimText = interim
      const editor = getCurrentEditor()
      if (editor && finalizedText) {
        const { view } = editor.getEditor()
        const tr = view.state.tr.insertText(finalizedText, view.state.selection.to)
        view.dispatch(tr)
        finalizedText = ''
      }
    }
    sr.onerror = () => { listening = false; interimText = '' }
    sr.onend = () => { listening = false; interimText = '' }
    sr.start()
    recognition = sr
    listening = true
  }

  function toggleSearch() {
    searchOpen = !searchOpen
    if (!searchOpen) { searchQuery = ''; searchMatches = []; searchIndex = 0 }
    else requestAnimationFrame(() => searchInputEl?.focus())
  }

  function cycleTheme() {
    themeIndex = (themeIndex + 1) % THEMES.length
    s.darkMode = theme === 'dark' || theme === 'solarized'
    s.save()
  }

  function cycleFont() { fontIndex = (fontIndex + 1) % FONTS.length }

  function downloadText() {
    const text = note?.text || ''
    const blob = new Blob([text], { type: 'text/plain' })
    const a = document.createElement('a')
    a.href = URL.createObjectURL(blob)
    a.download = 'wocus-note.txt'; a.click()
    URL.revokeObjectURL(a.href)
  }

  function printText() {
    const content = note?.html || ''
    const win = window.open('', '', 'width=800,height=600')
    win.document.write(`<html><head><title>Wocus</title><style>body{font-family:Georgia,serif;max-width:700px;margin:40px auto;line-height:1.8;padding:0 20px}</style></head><body>${content}</body></html>`)
    win.document.close(); win.focus(); win.print()
  }

  function toggleFullscreen() {
    if (!document.fullscreenElement) document.documentElement.requestFullscreen()
    else document.exitFullscreen()
  }

  function handleKeydown(e) {
    const mod = e.metaKey || e.ctrlKey
    if (e.key === '?' && !mod) { e.preventDefault(); helpOpen = true; return }
    if (mod && e.shiftKey) {
      switch (e.key) {
        case 'O': e.preventDefault(); organize(); break
        case 'V': e.preventDefault(); switchMode(viewMode === 'raw' ? 'organized' : 'raw'); break
        case 'E': e.preventDefault(); cycleTheme(); break
        case 'A': e.preventDefault(); cycleFont(); break
        case 'F': e.preventDefault(); toggleFullscreen(); break
      }
    }
    if (mod && e.key === 's') { e.preventDefault(); downloadText() }
    if (mod && e.key === 'f') { e.preventDefault(); toggleSearch() }
    if (e.key === 'Escape' && searchOpen) { toggleSearch() }
  }

  onMount(() => {
    load()
    document.addEventListener('keydown', handleKeydown)
    return () => document.removeEventListener('keydown', handleKeydown)
  })
</script>

{#if !loaded}
  <div class="loading">Loading...</div>
{:else}
  <div class="app-shell" class:font-serif={font === 'serif'} class:font-sans={font === 'sans-serif'}>
    {#if error}
      <div class="error-toast">
        <span>{error}</span>
        <button class="dismiss" onclick={() => error = ''}>✕</button>
      </div>
    {/if}

    <div class="mode-label" onclick={() => switchMode(viewMode === 'raw' ? 'organized' : 'raw')} role="button" tabindex="0" onkeydown={(e) => e.key === 'Enter' && switchMode(viewMode === 'raw' ? 'organized' : 'raw')}>
      {#if viewMode === 'raw'}
        <i class="fa-solid fa-pen-fancy"></i> Draft
      {:else}
        <i class="fa-solid fa-folder-tree"></i> Structured
      {/if}
    </div>

    <section><article class="editor-wrap">
      <Editor onUpdate={handleUpdate} onReady={handleReady} {viewMode} />
    </article></section>

    <div class="icons-top">
      <button class="icon-btn" onclick={toggleSearch} title="Search (⌘F)">
        <i class="fa-solid fa-magnifying-glass"></i>
      </button>
      <button class="icon-btn" onclick={toggleVoice} title={listening ? 'Stop listening' : 'Voice input'}>
        <i class="fa-solid fa-microphone" class:fa-beat-fade={listening} style={listening ? 'color:var(--accent)' : ''}></i>
      </button>
      <button class="icon-btn" onclick={organize} disabled={organizing} title="Organize with AI (⌘⇧O)">
        <i class="fa-solid fa-folder-tree"></i>
      </button>
      <button class="icon-btn" onclick={() => switchMode(viewMode === 'raw' ? 'organized' : 'raw')} title="Toggle view (⌘⇧V)">
        {#if viewMode === 'raw'}
          <i class="fa-solid fa-toggle-off"></i>
        {:else}
          <i class="fa-solid fa-toggle-on"></i>
        {/if}
      </button>
      <button class="icon-btn" onclick={() => settingsOpen = true} title="Settings">
        <i class="fa-solid fa-gear"></i>
      </button>
      <button class="icon-btn" onclick={cycleTheme} title="Theme (⌘⇧E)">
        <i class="fa-solid fa-circle-half-stroke"></i>
      </button>
      <button class="icon-btn" onclick={cycleFont} title="Font (⌘⇧A)">
        <i class="fa-solid fa-font"></i>
      </button>
      <button class="icon-btn" onclick={downloadText} title="Download (⌘S)">
        <i class="fa-solid fa-download"></i>
      </button>
      <button class="icon-btn" onclick={printText} title="Print (⌘P)">
        <i class="fa-solid fa-print"></i>
      </button>
      <button class="icon-btn" onclick={toggleFullscreen} title="Fullscreen (⌘⇧F)">
        <i class="fa-solid fa-expand"></i>
      </button>
    </div>

    {#if searchOpen}
      <div class="search-bar">
        <input
          type="text"
          bind:value={searchQuery}
          bind:this={searchInputEl}
          oninput={doSearch}
          onkeydown={(e) => { if (e.key === 'Enter') { e.shiftKey ? prevMatch() : nextMatch() } }}
          placeholder="Search..."
        />
        {#if searchMatches.length > 0}
          <span class="search-count">{searchIndex + 1}/{searchMatches.length}</span>
        {:else if searchQuery}
          <span class="search-count no-matches">No matches</span>
        {/if}
        <button class="search-nav" onclick={prevMatch} disabled={searchMatches.length === 0} title="Previous (Shift+Enter)">
          <i class="fa-solid fa-chevron-up"></i>
        </button>
        <button class="search-nav" onclick={nextMatch} disabled={searchMatches.length === 0} title="Next (Enter)">
          <i class="fa-solid fa-chevron-down"></i>
        </button>
        <button class="search-close" onclick={toggleSearch}>✕</button>
      </div>
    {/if}

    {#if listening}
      <div class="voice-indicator">
        <i class="fa-solid fa-microphone" class:fa-beat-fade={true} style="color:var(--accent)"></i>
        {#if interimText}
          <span class="voice-interim">{interimText}</span>
        {:else}
          <span class="voice-hint">Listening...</span>
        {/if}
      </div>
    {/if}

    <div class="word-count">{charCount} / {wordCount}</div>

    <div class="icons-bottom-right">
      <button class="icon-btn" onclick={() => helpOpen = true} title="Help (?)">
        <i class="fa-regular fa-circle-question"></i>
      </button>
      <button class="icon-btn" onclick={() => aboutOpen = true} title="About">
        <i class="fa-solid fa-circle-info"></i>
      </button>
    </div>

    {#if viewMode === 'organized' && headingElements.length > 0}
      <Sidebar {headings} onNavigate={handleNavigate} />
    {/if}

    <SettingsModal open={settingsOpen} onclose={() => settingsOpen = false} />
    <HelpModal open={helpOpen} onclose={() => helpOpen = false} />
    <AboutModal open={aboutOpen} onclose={() => aboutOpen = false} />
  </div>
{/if}

<style>
  .loading {
    display: flex; align-items: center; justify-content: center;
    height: 100vh; color: var(--muted); font-family: 'Roboto Mono', monospace;
  }
  .app-shell {
    height: 100vh; overflow-y: scroll;
    background: var(--bg); color: var(--fg);
    transition: background 0.3s, color 0.3s;
    padding: 50px 80px;
    font-family: 'Roboto Mono', monospace;
  }
  .app-shell.font-serif { font-family: 'Roboto Slab', Georgia, serif; }
  .app-shell.font-sans { font-family: Roboto, Arial, Helvetica, sans-serif; }
  section { max-width: 800px; margin: auto; line-height: 1.8; font-size: 16px; }
  .editor-wrap { min-height: 80vh; }

  .mode-label {
    position: fixed; top: 16px; left: 20px;
    display: flex; align-items: center; gap: 6px;
    font-size: 0.75em; color: var(--muted); opacity: 0.4;
    cursor: pointer; z-index: 50;
    transition: opacity 0.2s; user-select: none;
    font-family: 'Roboto Mono', monospace;
  }
  .mode-label:hover { opacity: 0.8; color: var(--fg); }

  .error-toast {
    position: fixed; top: 16px; left: 50%; transform: translateX(-50%);
    display: flex; align-items: center; gap: 8px;
    padding: 10px 16px; background: var(--error-bg);
    border: 1px solid var(--error-color); border-radius: 8px;
    font-size: 0.85em; color: var(--error-color); z-index: 100;
    max-width: 500px;
  }
  .dismiss { background: none; border: none; cursor: pointer; color: inherit; font-size: 1em; padding: 2px; }

  .icon-btn {
    display: flex; align-items: center; justify-content: center;
    width: 32px; height: 32px; padding: 0;
    border: none; background: none; cursor: pointer;
    color: var(--muted); transition: color 0.15s;
    font-size: 16px;
  }
  .icon-btn:hover { color: var(--fg); }
  .icon-btn:disabled { opacity: 0.25; cursor: default; }

  .icons-top {
    position: fixed; top: 12px; right: 12px;
    display: flex; flex-direction: column; gap: 2px; z-index: 50;
  }
  .icons-bottom-right {
    position: fixed; bottom: 12px; right: 12px;
    display: flex; flex-direction: column; gap: 2px; z-index: 50;
  }
  .word-count {
    position: fixed; bottom: 16px; left: 20px;
    font-size: 0.75em; color: var(--muted);
    font-family: 'Roboto Mono', monospace;
    opacity: 0.4; transition: opacity 0.15s; z-index: 50;
  }
  .word-count:hover { opacity: 0.8; }

  .voice-indicator {
    position: fixed; bottom: 16px; left: 50%; transform: translateX(-50%);
    display: flex; align-items: center; gap: 8px;
    padding: 8px 16px;
    background: var(--surface);
    border: 1px solid var(--border);
    border-radius: 20px;
    font-size: 0.8em; color: var(--fg);
    z-index: 100;
    box-shadow: 0 2px 12px rgba(0,0,0,0.1);
    max-width: 400px;
  }
  .voice-interim {
    opacity: 0.7; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;
  }
  .voice-hint { opacity: 0.5; }

  .search-bar {
    position: fixed; top: 12px; left: 50%; transform: translateX(-50%);
    display: flex; align-items: center; gap: 6px;
    padding: 6px 10px; background: var(--surface);
    border: 1px solid var(--border); border-radius: 8px;
    z-index: 100; box-shadow: 0 4px 20px rgba(0,0,0,0.12);
    font-family: 'Roboto Mono', monospace;
  }
  .search-bar input {
    padding: 4px 8px; border: none; background: none;
    font-size: 0.85em; color: var(--fg); outline: none;
    width: 180px; font-family: inherit;
  }
  .search-count {
    font-size: 0.75em; color: var(--muted); white-space: nowrap;
    min-width: 40px; text-align: center;
  }
  .search-count.no-matches { color: var(--error-color); }
  .search-nav, .search-close {
    display: flex; align-items: center; justify-content: center;
    width: 24px; height: 24px; padding: 0;
    border: none; background: none; cursor: pointer;
    color: var(--muted); font-size: 12px;
  }
  .search-nav:hover, .search-close:hover { color: var(--fg); }
  .search-nav:disabled { opacity: 0.25; cursor: default; }
  @media (max-width: 768px) { .app-shell { padding: 30px 20px; } }
</style>
