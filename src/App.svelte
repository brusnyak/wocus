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
  let rawApi = $state(null)
  let organizedApi = $state(null)
  let searchOpen = $state(false)
  let searchQuery = $state('')
  let searchMatches = $state([])
  let searchIndex = $state(0)

  const FONTS = ['monospace', 'serif', 'sans-serif']
  let fontIndex = $state(0)

  const THEMES = ['light', 'dark', 'solarized']
  let themeIndex = $state(0)

  let charCount = $state(0)
  let wordCount = $state(0)

  let theme = $derived(THEMES[themeIndex])
  let font = $derived(FONTS[fontIndex])

  let saveTimer

  $effect(() => {
    document.documentElement.setAttribute('data-theme', theme)
  })

  async function load() {
    await s.load()
    const n = await ensureNote()
    themeIndex = THEMES.indexOf(s.darkMode ? 'dark' : 'light')
    if (themeIndex === -1) themeIndex = 0
    note = n
    updateCounts(n.rawText || '')
    loaded = true
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

  function handleRawUpdate({ html, json, text }) {
    if (!note || !loaded) return
    note.rawContent = JSON.stringify(json)
    note.rawHtml = html
    note.rawText = text
    updateCounts(text)
    queueSave()
  }

  function handleOrganizedUpdate({ html, json, text }) {
    if (!note || !loaded) return
    note.organizedContent = JSON.stringify(json)
    note.organizedHtml = html
    note.organizedText = text
    updateCounts(text)
    queueSave()
  }

  function blockToTipTapNode(b) {
    const text = (b.content || '').toString()
    switch (b.type) {
      case 'heading':
        return { type: 'heading', attrs: { level: b.level || 1 }, content: [{ type: 'text', text }] }
      case 'text':
        return { type: 'paragraph', content: [{ type: 'text', text }] }
      case 'toggle':
        return {
          type: 'details',
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
        case 'code': return `<pre><code>${b.content}</code></pre>`
        default: return `<p>${b.content || ''}</p>`
      }
    }).join('')
  }

  function extractHeadingsFromJson(jsonStr) {
    if (!jsonStr) return []
    try {
      const data = JSON.parse(jsonStr)
      const blocks = Array.isArray(data) ? data : (data.content || [])
      return blocks
        .filter(b => b.type === 'heading' && (b.level === 1 || b.level === 2))
        .map(b => {
          const text = b.content
            ? (Array.isArray(b.content) ? b.content.map(c => c.text || '').join('') : b.content)
            : ''
          return { level: b.level || 1, content: text }
        })
    } catch { return [] }
  }

  $effect(() => {
    if (viewMode === 'organized' && note?.organizedContent) {
      headingElements = extractHeadingsFromJson(note.organizedContent)
    } else { headingElements = [] }
  })

  async function organize() {
    if (!s.hasApiKey()) { error = 'Add an API key in Settings first.'; return }
    if (!note?.rawText) { error = 'Nothing to organize — write some text first.'; return }
    organizing = true; error = ''
    try {
      const result = await organizeWithAI(note.rawText, {
        apiEndpoint: s.apiEndpoint, apiKey: s.apiKey, modelName: s.modelName
      })
      if (result?.blocks) {
        const tipTapJson = blocksToTipTapJson(result.blocks)
        note.organizedContent = JSON.stringify(tipTapJson)
        note.organizedText = result.blocks.map(b => b.content || '').join('\n')
        note.organizedHtml = blocksToHtml(result.blocks)
        await saveNote($state.snapshot(note))
        viewMode = 'organized'
        requestAnimationFrame(() => loadContent('organized'))
      } else { error = 'AI returned unexpected format.' }
    } catch (e) { error = e.message || 'Failed to organize' }
    organizing = false
  }

  function loadContent(mode) {
    const api = mode === 'raw' ? rawApi : organizedApi
    if (!api) return
    if (mode === 'raw' && note?.rawContent) {
      try { api.setContent(JSON.parse(note.rawContent)) } catch { api.setContent('') }
    } else if (mode === 'organized' && note?.organizedContent) {
      try {
        const c = JSON.parse(note.organizedContent)
        api.setContent(c.type === 'doc' ? c : blocksToTipTapJson(c))
      } catch { api.setContent(note.organizedHtml || '') }
    } else { api.setContent('') }
  }

  function handleRawReady(api) { rawApi = api; loadContent('raw') }
  function handleOrganizedReady(api) { organizedApi = api; loadContent('organized') }

  function switchView(mode) {
    viewMode = mode
    requestAnimationFrame(() => loadContent(mode))
  }

  function handleNavigate(index) {
    const editor = organizedApi?.getEditor()
    if (!editor) return
    const headings = editor.view.dom.querySelectorAll('h1, h2')
    if (headings[index]) headings[index].scrollIntoView({ behavior: 'smooth' })
  }

  function getCurrentEditor() {
    return viewMode === 'raw' ? rawApi : organizedApi
  }

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
    const match = searchMatches[index]
    const { state, dispatch } = editor.getEditor().view
    const tr = state.tr.setSelection(TextSelection.create(state.doc, match.from, match.to))
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

  function toggleSearch() {
    searchOpen = !searchOpen
    if (!searchOpen) { searchQuery = ''; searchMatches = []; searchIndex = 0 }
  }

  function cycleTheme() {
    themeIndex = (themeIndex + 1) % THEMES.length
    s.darkMode = theme === 'dark' || theme === 'solarized'
    s.save()
  }

  function cycleFont() { fontIndex = (fontIndex + 1) % FONTS.length }

  function downloadText() {
    const text = viewMode === 'raw' ? (note?.rawText || '') : (note?.organizedText || '')
    const blob = new Blob([text], { type: 'text/plain' })
    const a = document.createElement('a')
    a.href = URL.createObjectURL(blob)
    a.download = 'wocus-note.txt'; a.click()
    URL.revokeObjectURL(a.href)
  }

  function printText() {
    const content = viewMode === 'raw' ? (note?.rawHtml || '') : (note?.organizedHtml || '')
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
    if (mod && e.shiftKey) {
      switch (e.key) {
        case 'O': e.preventDefault(); organize(); break
        case 'V': e.preventDefault(); switchView(viewMode === 'raw' ? 'organized' : 'raw'); break
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

    <section><article class="editor-wrap">
      {#if viewMode === 'raw'}
        <Editor onUpdate={handleRawUpdate} onReady={handleRawReady} />
      {:else}
        {#if note?.organizedHtml || note?.organizedContent}
          <Editor onUpdate={handleOrganizedUpdate} onReady={handleOrganizedReady} />
        {:else}
          <div class="empty-organized">
            <p>No organized content yet.</p>
            <p>Write something in Raw view and click Organize.</p>
          </div>
        {/if}
      {/if}
    </article></section>

    <div class="icons-top">
      <button class="icon-btn" onclick={toggleSearch} title="Search (⌘F)">
        <i class="fa-solid fa-magnifying-glass"></i>
      </button>
      <button class="icon-btn" onclick={organize} disabled={organizing || viewMode !== 'raw'} title="Organize with AI (⌘⇧O)">
        <i class="fa-solid fa-folder-tree"></i>
      </button>
      <button class="icon-btn" onclick={() => switchView(viewMode === 'raw' ? 'organized' : 'raw')} disabled={!note?.organizedContent} title="Toggle view (⌘⇧V)">
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
          oninput={doSearch}
          onkeydown={(e) => { if (e.key === 'Enter') { e.shiftKey ? prevMatch() : nextMatch() } }}
          placeholder="Search..."
          autofocus
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

    <div class="icons-bottom-right">
      <button class="icon-btn" onclick={() => helpOpen = true} title="Help">
        <i class="fa-regular fa-circle-question"></i>
      </button>
      <button class="icon-btn" onclick={() => aboutOpen = true} title="About">
        <i class="fa-solid fa-circle-info"></i>
      </button>
    </div>

    <div class="word-count">{charCount} / {wordCount}</div>

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
  .error-toast {
    position: fixed; top: 16px; left: 50%; transform: translateX(-50%);
    display: flex; align-items: center; gap: 8px;
    padding: 10px 16px; background: var(--error-bg);
    border: 1px solid var(--error-color); border-radius: 8px;
    font-size: 0.85em; color: var(--error-color); z-index: 100;
    max-width: 500px;
  }
  .dismiss { background: none; border: none; cursor: pointer; color: inherit; font-size: 1em; padding: 2px; }
  .empty-organized { text-align: center; margin-top: 6rem; color: var(--muted); }
  .empty-organized p { margin: 0.5em 0; }

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
