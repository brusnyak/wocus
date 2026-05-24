<script>
  import { onMount } from 'svelte'
  import { TextSelection } from '@tiptap/pm/state'
  import { ensureNote, saveNote, getDb } from './lib/db.js'
  import { getSettings } from './lib/settings.svelte.js'
  import { organizeWithAI } from './lib/ai.js'
  import Editor from './lib/Editor.svelte'
  import SettingsModal from './lib/SettingsModal.svelte'
  import HelpModal from './lib/HelpModal.svelte'
  import AboutModal from './lib/AboutModal.svelte'
  import Sidebar from './lib/Sidebar.svelte'
  import ChatPanel from './lib/ChatPanel.svelte'

  let s = getSettings()
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
let uiHidden = $state(false)
let lastActivity = $state(Date.now())
let fileInput = $state(null)
let showTemplateMenu = $state(false)
let showLoadTemplate = $state(false)
let templateName = $state('')
let templates = $state([])
let markdownView = $state(false)
let markdownSource = $state('')

  $effect(() => {
    document.documentElement.classList.toggle('ui-hidden', uiHidden)
  })

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
    // Migrate old schema
    if (!n.content && (n.rawContent || n.organizedContent)) {
      n.content = n.organizedContent || n.rawContent || ''
      n.html = n.organizedHtml || n.rawHtml || ''
      n.text = n.organizedText || n.rawText || ''
    }
    if (!n.content) n.content = ''
    if (!n.text) n.text = ''
    note = n
    updateCounts(note.text)
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

  function handleUpdate({ html, json, text }) {
    if (!note || !loaded) return
    note.content = JSON.stringify(json)
    note.html = html
    note.text = text
    updateCounts(text)
    queueSave()
  }

  async function toggleMarkdownView() {
    if (markdownView) {
      markdownView = false
    } else {
      const TurndownService = (await import('turndown')).default
      const turndown = new TurndownService({ headingStyle: 'atx', codeBlockStyle: 'fenced' })
      const md = turndown.turndown(note?.html || '')
      const { marked } = await import('marked')
      markdownSource = await marked.parse(md)
      markdownView = true
    }
  }

  function handleApplySuggestion(text) {
    if (!editorApi) return
    const { view } = editorApi.getEditor()
    const { state, dispatch } = view
    const tr = state.tr.insertText('\n' + text, state.selection.to)
    dispatch(tr)
    view.focus()
    const html = editorApi.getHTML()
    const json = editorApi.getJSON()
    const plainText = editorApi.getText()
    note.html = html
    note.content = JSON.stringify(json)
    note.text = plainText
    updateCounts(plainText)
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
    return { type: 'doc', content: blocks.map(blocksToTipTapNode) }
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
    if (note?.content) {
      headingElements = extractSections(note.content).map(s => s.heading)
    } else { headingElements = [] }
  })

  async function organize() {
    if (!s.hasApiKey()) { error = 'Add an API key in Settings first.'; return }
    const latestText = note?.text || ''
    if (!latestText) { error = 'Nothing to organize — write some text first.'; return }
    organizing = true; error = ''
    try {
      const result = await organizeWithAI(latestText, {
        apiEndpoint: s.apiEndpoint, apiKey: s.apiKey, modelName: s.modelName, linkAnalysis: s.linkAnalysis
      })
      if (result?.blocks && result.blocks.length > 0) {
        const tipTapJson = blocksToTipTapJson(result.blocks)
        note.content = JSON.stringify(tipTapJson)
        note.html = blocksToHtml(result.blocks)
        note.text = result.blocks.map(b => b.content || '').join('\n')
        await saveNote($state.snapshot(note))
        requestAnimationFrame(() => loadContent())
      } else { error = 'AI returned empty content. Try again.' }
    } catch (e) { error = e.message || 'Failed to organize' }
    organizing = false
  }

  function loadContent() {
    if (!editorApi) return
    if (note?.content) {
      try { editorApi.setContent(JSON.parse(note.content)) } catch { }
    }
  }

  function handleReady(api) {
    editorApi = api
    loadContent()
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
     if (listening) {
       if (recognition) {
         recognition.stop()
         recognition = null
       }
       listening = false
       interimText = ''
       return
     }
     const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition
     if (!SpeechRecognition) {
       error = 'Speech recognition not supported in this browser.'
       return
     }
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
       if (editor && finalizedText.trim()) {
         const { view } = editor.getEditor()
         const tr = view.state.tr.insertText(finalizedText, view.state.selection.to)
         view.dispatch(tr)
         finalizedText = ''
       }
     }
     sr.onerror = (e) => {
       console.error('Speech recognition error:', e)
       listening = false
       interimText = ''
       if (recognition === sr) {
         recognition = null
       }
       // Don't set error here to avoid spamming UI with frequent errors
       // Only set error for permanent issues
       if (e.error === 'not-allowed' || e.error === 'service-not-allowed') {
         error = 'Speech recognition access denied. Please check browser permissions.'
       }
     }
     sr.onend = () => {
       listening = false
       interimText = ''
       if (recognition === sr) {
         recognition = null
       }
     }
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

  async function exportMarkdown() {
    const TurndownService = (await import('turndown')).default
    const turndown = new TurndownService({ headingStyle: 'atx', codeBlockStyle: 'fenced' })
    const md = turndown.turndown(note?.html || '')
    const blob = new Blob([md], { type: 'text/markdown' })
    const a = document.createElement('a')
    a.href = URL.createObjectURL(blob)
    a.download = 'wocus-note.md'; a.click()
    URL.revokeObjectURL(a.href)
  }

  function importMarkdown() {
    fileInput?.click()
  }

  async function handleFileImport(e) {
    const file = e.target.files?.[0]
    if (!file) return
    const text = await file.text()
    const { marked } = await import('marked')
    const html = await marked.parse(text)
    if (editorApi) {
      editorApi.setContent(html)
      const div = document.createElement('div')
      div.innerHTML = html
      const plainText = div.textContent || ''
      note.text = plainText
      note.html = html
      updateCounts(plainText)
      queueSave()
    }
    e.target.value = ''
  }

  async function loadTemplates() {
    const db = await getDb()
    const all = await db.getAll('templates')
    templates = all.sort((a, b) => b.createdAt - a.createdAt)
  }

  async function saveTemplate() {
    const name = templateName.trim()
    if (!name || !note) return
    const db = await getDb()
    await db.put('templates', {
      id: Date.now().toString(),
      name,
      content: note.content,
      html: note.html,
      text: note.text,
      createdAt: Date.now()
    })
    templateName = ''
    showTemplateMenu = false
    await loadTemplates()
  }

  async function applyTemplate(t) {
    if (!editorApi) return
    try { editorApi.setContent(JSON.parse(t.content)) } catch { editorApi.setContent(t.html) }
    note.content = t.content
    note.html = t.html
    note.text = t.text
    updateCounts(t.text)
    queueSave()
    showLoadTemplate = false
  }

  async function deleteTemplate(id) {
    const db = await getDb()
    await db.delete('templates', id)
    await loadTemplates()
  }

  function handleKeydown(e) {
    const mod = e.metaKey || e.ctrlKey
    if (mod && e.altKey) {
      switch (e.key) {
        case 'o': e.preventDefault(); organize(); break
        case 'e': e.preventDefault(); cycleTheme(); break
        case 'a': e.preventDefault(); cycleFont(); break
        case 'f': e.preventDefault(); toggleFullscreen(); break
      }
    }
    if (mod && e.key === 's') { e.preventDefault(); downloadText() }
    if (mod && e.key === 'f') { e.preventDefault(); toggleSearch() }
    if (e.key === 'Escape' && searchOpen) { toggleSearch() }
  }

  let typingTimeout = null

  function handleTyping() {
    const tag = document.activeElement?.tagName || ''
    const isInput = tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT'
    const inSearch = document.activeElement?.closest('.search-bar')
    if (isInput && !inSearch) {
      uiHidden = true
      clearTimeout(typingTimeout)
      typingTimeout = setTimeout(() => {
        uiHidden = false
      }, 3000)
    }
  }

  onMount(() => {
    load()
    document.addEventListener('keydown', handleKeydown)
    document.addEventListener('keydown', handleTyping)
    document.addEventListener('mousemove', () => {
      uiHidden = false
      clearTimeout(typingTimeout)
      typingTimeout = setTimeout(() => {
        uiHidden = true
      }, 3000)
    })
    return () => {
      document.removeEventListener('keydown', handleKeydown)
      document.removeEventListener('keydown', handleTyping)
      document.removeEventListener('mousemove', () => {})
    }
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
        <div class:editor-hidden={markdownView}>
          <Editor onUpdate={handleUpdate} onReady={handleReady} />
        </div>
        <div class:markdown-visible={markdownView}>
          <div class="markdown-preview">{@html markdownSource}</div>
        </div>
      </article></section>

{#if !uiHidden}
     <div class="icons-top">
        <button class="icon-btn" onclick={toggleSearch} title="Search (⌘F)">
          <i class="fa-solid fa-magnifying-glass"></i>
        </button>
        <button class="icon-btn" onclick={toggleVoice} title={listening ? 'Stop listening' : 'Voice input'}>
          <i class="fa-solid fa-microphone" class:fa-beat-fade={listening} style={listening ? 'color:var(--accent)' : ''}></i>
        </button>
        <button class="icon-btn" onclick={organize} disabled={organizing} title="Organize with AI (⌘⌥O)">
          <i class="fa-solid fa-folder-tree"></i>
        </button>
        <button class="icon-btn" onclick={exportMarkdown} title="Export Markdown">
          <i class="fa-solid fa-file-export"></i>
        </button>
        <button class="icon-btn" onclick={importMarkdown} title="Import Markdown">
          <i class="fa-solid fa-file-import"></i>
        </button>
        <button class="icon-btn" onclick={toggleMarkdownView} title={markdownView ? 'Exit markdown view' : 'Markdown source'}>
          <i class="fa-brands fa-markdown"></i>
        </button>
        <button class="icon-btn" onclick={() => { templateName = ''; showTemplateMenu = !showTemplateMenu }} title="Save as template">
          <i class="fa-regular fa-floppy-disk"></i>
        </button>
        <button class="icon-btn" onclick={() => settingsOpen = true} title="Settings">
          <i class="fa-solid fa-gear"></i>
        </button>
        <button class="icon-btn" onclick={cycleTheme} title="Theme (⌘⌥E)">
          <i class="fa-solid fa-circle-half-stroke"></i>
        </button>
        <button class="icon-btn" onclick={cycleFont} title="Font (⌘⌥A)">
          <i class="fa-solid fa-font"></i>
        </button>
        <button class="icon-btn" onclick={downloadText} title="Download (⌘S)">
          <i class="fa-solid fa-download"></i>
        </button>
        <button class="icon-btn" onclick={printText} title="Print (⌘P)">
          <i class="fa-solid fa-print"></i>
        </button>
        <button class="icon-btn" onclick={toggleFullscreen} title="Fullscreen (⌘⌥F)">
          <i class="fa-solid fa-expand"></i>
        </button>
      </div>
      <input type="file" accept=".md,.markdown" bind:this={fileInput} onchange={handleFileImport} style="display:none" />
      {#if showTemplateMenu}
        <div class="template-save-popup">
          <input type="text" bind:value={templateName} placeholder="Template name..." onkeydown={(e) => e.key === 'Enter' && saveTemplate()} />
          <button class="icon-btn" onclick={saveTemplate} title="Save"><i class="fa-solid fa-check"></i></button>
        </div>
      {/if}
      {/if}

     {#if !uiHidden && searchOpen}
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

     {#if !uiHidden && listening}
     <div class="voice-indicator">
       <i class="fa-solid fa-microphone" class:fa-beat-fade={true} style="color:var(--accent)"></i>
       {#if interimText}
         <span class="voice-interim">{interimText}</span>
       {:else}
         <span class="voice-hint">Listening...</span>
       {/if}
     </div>
     {/if}

     {#if !uiHidden}
     <div class="word-count">{charCount} / {wordCount}</div>
     {/if}

     <div class="icons-bottom-right">
       {#if !uiHidden}
         <button class="icon-btn" onclick={() => helpOpen = true} title="Help">
           <i class="fa-regular fa-circle-question"></i>
         </button>
         <button class="icon-btn" onclick={() => aboutOpen = true} title="About">
           <i class="fa-solid fa-circle-info"></i>
         </button>
       {/if}
     </div>

     {#if !uiHidden && headingElements.length > 0}
       <Sidebar {headings} onNavigate={handleNavigate} />
     {/if}

<SettingsModal open={settingsOpen} onclose={() => settingsOpen = false} />
      <HelpModal open={helpOpen} onclose={() => helpOpen = false} />
      <AboutModal open={aboutOpen} onclose={() => aboutOpen = false} />
      <ChatPanel
        hidden={uiHidden}
        apiEndpoint={s.apiEndpoint}
        apiKey={s.apiKey}
        modelName={s.modelName}
        noteText={note?.text || ''}
        onOrganize={organize}
        onApply={handleApplySuggestion}
        onError={(msg) => error = msg}
      />
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

.icon-btn {
    display: flex; align-items: center; justify-content: center;
    width: 32px; height: 32px; padding: 0;
    border: none; background: none; cursor: pointer;
    color: var(--muted); transition: color 0.15s, opacity 0.3s;
    font-size: 16px;
}
.icon-btn:hover { color: var(--fg); }
.icon-btn:disabled { opacity: 0.25; cursor: default; }

.icons-top {
    position: fixed;
    top: 16px;
    right: 16px;
    display: flex;
    flex-direction: column;
    gap: 4px;
    z-index: 50;
    transition: opacity 0.3s ease, transform 0.3s ease;
    opacity: 1;
    transform: translateY(0);
}

.icons-bottom-right {
    position: fixed;
    bottom: 16px;
    right: 16px;
    display: flex;
    flex-direction: column;
    gap: 4px;
    z-index: 50;
    transition: opacity 0.3s ease, transform 0.3s ease;
    opacity: 1;
    transform: translateY(0);
}

.word-count {
    position: fixed;
    bottom: 16px;
    left: 16px;
    font-size: 0.75em;
    color: var(--muted);
    z-index: 50;
    font-family: 'Roboto Mono', monospace;
    transition: opacity 0.3s ease, transform 0.3s ease;
    opacity: 1;
    transform: translateY(0);
}

.search-bar {
    position: fixed;
    top: 16px;
    left: 50%;
    transform: translateX(-50%);
    display: flex;
    align-items: center;
    gap: 6px;
    padding: 6px 10px;
    background: var(--surface);
    border: 1px solid var(--border);
    border-radius: 8px;
    z-index: 60;
    transition: opacity 0.3s ease, transform 0.3s ease;
    opacity: 1;
}
.search-bar input {
    border: none; background: none; outline: none;
    color: var(--fg); font-size: 0.85em; width: 180px;
    font-family: inherit;
}
.search-count { font-size: 0.75em; color: var(--muted); white-space: nowrap; }
.search-count.no-matches { color: var(--error-color); }
.search-nav, .search-close {
    background: none; border: none; cursor: pointer;
    color: var(--muted); padding: 2px 4px; font-size: 0.85em;
}
.search-nav:hover, .search-close:hover { color: var(--fg); }
.search-nav:disabled { opacity: 0.25; cursor: default; }

.voice-indicator {
    position: fixed;
    bottom: 48px;
    left: 50%;
    transform: translateX(-50%);
    display: flex;
    align-items: center;
    gap: 6px;
    padding: 6px 12px;
    background: var(--surface);
    border: 1px solid var(--border);
    border-radius: 8px;
    z-index: 60;
    transition: opacity 0.3s ease, transform 0.3s ease;
    opacity: 1;
}
.voice-interim { font-size: 0.8em; color: var(--muted); font-style: italic; }
.voice-hint { font-size: 0.8em; color: var(--accent); }

.template-save-popup {
    position: fixed;
    top: 16px;
    right: 56px;
    display: flex;
    align-items: center;
    gap: 6px;
    padding: 6px 10px;
    background: var(--surface);
    border: 1px solid var(--border);
    border-radius: 8px;
    z-index: 55;
}
.template-save-popup input {
    border: none; background: none; outline: none;
    color: var(--fg); font-size: 0.85em; width: 160px;
    font-family: inherit;
}



.editor-hidden { display: none; }

.markdown-preview {
    width: 100%;
    min-height: 70vh;
    padding: 1rem;
    background: var(--bg);
    color: var(--fg);
    font-size: 1em;
    line-height: 1.8;
    outline: none;
}
:global(.markdown-preview) h1 { font-size: 2em; font-weight: 700; margin: 1.2em 0 0.5em; }
:global(.markdown-preview) h2 { font-size: 1.5em; font-weight: 600; margin: 1em 0 0.4em; }
:global(.markdown-preview) h3 { font-size: 1.2em; font-weight: 600; margin: 0.8em 0 0.3em; }
:global(.markdown-preview) p { margin: 0.5em 0; }
:global(.markdown-preview) ul, :global(.markdown-preview) ol { padding-left: 1.5em; }
:global(.markdown-preview) pre {
    background: var(--code-bg); border-radius: 4px;
    padding: 1em; overflow-x: auto; margin: 0.5em 0;
}
:global(.markdown-preview) code { font-size: 0.9em; }
:global(.markdown-preview) blockquote {
    border-left: 3px solid var(--accent); padding-left: 1em; margin: 0.5em 0; color: var(--muted);
}
:global(.markdown-preview) hr { border: none; border-top: 1px solid var(--border); margin: 1.5em 0; }
:global(.markdown-preview) a { color: var(--accent); text-decoration: underline; }

:global(.ui-hidden) .icons-top,
:global(.ui-hidden) .icons-bottom-right,
:global(.ui-hidden) .search-bar,
:global(.ui-hidden) .voice-indicator,
:global(.ui-hidden) .word-count {
    opacity: 0;
    transform: translateY(-10px);
    pointer-events: none;
}
</style>
