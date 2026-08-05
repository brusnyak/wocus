<script>
  import { getAllNotes, createNote, deleteNote, saveNote } from './db.js'

  let {
    currentNoteId = null,
    onSelectNote,
    onDeleteNote,
    onRefreshReady,
    collapsed = false,
    ontoggle,
    onReveal
  } = $props()

  let notes = $state([])
  let loading = $state(true)
  let collapsedTags = $state(new Set())
  let tagContextNoteId = $state(null)
  let tagInputValue = $state('')

  let currentNote = $derived(notes.find(n => n.id === currentNoteId))

  let rootNotes = $derived(notes.filter(n => !n.parentId).sort((a, b) => b.updatedAt - a.updatedAt))

  let allTags = $derived(() => {
    const tagSet = new Set()
    for (const n of rootNotes) {
      for (const t of (n.tags || [])) tagSet.add(t)
    }
    return [...tagSet].sort()
  })

  let tagGroups = $derived(() => {
    const groups = new Map()
    for (const tag of allTags()) groups.set(tag, [])
    for (const n of rootNotes) {
      const tags = n.tags || []
      if (tags.length > 0) {
        // Put in first tag's group
        const arr = groups.get(tags[0])
        if (arr) arr.push(n)
      }
    }
    return groups
  })

  let untaggedNotes = $derived(rootNotes.filter(n => !(n.tags || []).length))

  function toggleTagCollapse(tag) {
    const s = new Set(collapsedTags)
    if (s.has(tag)) s.delete(tag)
    else s.add(tag)
    collapsedTags = s
  }

  async function refresh() {
    loading = true
    notes = await getAllNotes()
    loading = false
  }

  async function handleCreate() {
    const note = await createNote({ title: 'Untitled' })
    await refresh()
    onSelectNote?.(note.id)
  }

  async function handleDelete(id, e) {
    e.stopPropagation()
    if (notes.length <= 1) return
    if (!confirm('Delete this page? This cannot be undone.')) return
    onDeleteNote?.(id)
  }

  async function handleRename(id, e) {
    e.stopPropagation()
    const note = notes.find(n => n.id === id)
    if (!note) return
    const name = prompt('Rename page:', note.title)
    if (!name || !name.trim()) return
    note.title = name.trim()
    await saveNote(note)
    await refresh()
  }

  function openTagInput(noteId, e) {
    e.stopPropagation()
    const note = notes.find(n => n.id === noteId)
    tagContextNoteId = noteId
    tagInputValue = (note?.tags || []).join(', ')
  }

  async function saveTags() {
    if (!tagContextNoteId) return
    const note = notes.find(n => n.id === tagContextNoteId)
    if (!note) return
    const tags = tagInputValue.split(',').map(t => t.trim().toLowerCase()).filter(Boolean)
    note.tags = tags
    await saveNote(note)
    tagContextNoteId = null
    tagInputValue = ''
    await refresh()
  }

  function handleTagKeydown(e) {
    if (e.key === 'Enter') saveTags()
    else if (e.key === 'Escape') { tagContextNoteId = null; tagInputValue = '' }
  }

  function getPreview(note) {
    const text = note.text || ''
    return text.slice(0, 80).replace(/\n/g, ' ').trim() || 'Empty page'
  }

  async function load() {
    onRefreshReady?.(refresh)
    await refresh()
    if (notes.length > 0 && !currentNoteId) {
      onSelectNote?.(notes[0].id)
    }
  }

  $effect(() => { if (!loading) return; load() })
</script>

<aside class="note-sidebar" class:collapsed>
  <div class="sidebar-header">
    <button class="icon-btn toggle-btn" onclick={() => ontoggle?.()} title="Toggle sidebar">
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="3" y1="12" x2="21" y2="12"></line><line x1="3" y1="6" x2="21" y2="6"></line><line x1="3" y1="18" x2="21" y2="18"></line></svg>
    </button>
    <span class="sidebar-title">Notes</span>
    <button class="new-btn-inline" onclick={handleCreate} title="New page">
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="12" y1="5" x2="12" y2="19"></line><line x1="5" y1="12" x2="19" y2="12"></line></svg>
    </button>
  </div>

  <div class="sidebar-body">
    {#each tagGroups() as [tag, tagNotes] (tag)}
      <div class="tag-group">
        <button class="tag-header" onclick={() => toggleTagCollapse(tag)}>
          <span class="tag-chevron" class:collapsed={collapsedTags.has(tag)}>
            <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="6 9 12 15 18 9"></polyline></svg>
          </span>
          <span class="tag-label">#{tag}</span>
          <span class="tag-count">{tagNotes.length}</span>
        </button>
        {#if !collapsedTags.has(tag)}
          {#each tagNotes as note (note.id)}
            <div
              class="note-item tagged"
              class:active={note.id === currentNoteId}
              onclick={() => onSelectNote?.(note.id)}
              role="button"
              tabindex="0"
              onkeydown={(e) => e.key === 'Enter' && onSelectNote?.(note.id)}
            >
              <span class="note-icon">{note.icon || '📄'}</span>
              <div class="note-info">
                <span class="note-title-text">{note.title}</span>
                <span class="note-preview">{getPreview(note)}</span>
              </div>
              <div class="note-actions">
                <button class="icon-btn small" onclick={(e) => openTagInput(note.id, e)} title="Edit tags">
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M20.59 13.41l-7.17 7.17a2 2 0 0 1-2.83 0L2 12V2h10l8.59 8.59a2 2 0 0 1 0 2.82z"></path><line x1="7" y1="7" x2="7.01" y2="7"></line></svg>
                </button>
                <button class="icon-btn small" onclick={(e) => handleRename(note.id, e)} title="Rename">
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path></svg>
                </button>
                <button class="icon-btn small danger" onclick={(e) => handleDelete(note.id, e)} title="Delete">
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path></svg>
                </button>
              </div>
            </div>
          {/each}
        {/if}
      </div>
    {/each}

    {#if untaggedNotes.length > 0}
      <div class="tag-group">
        {#if allTags().length > 0}
          <div class="tag-header untagged-label">
            <span class="tag-label">Notes</span>
            <span class="tag-count">{untaggedNotes.length}</span>
          </div>
        {/if}
        {#each untaggedNotes as note (note.id)}
          <div
            class="note-item"
            class:active={note.id === currentNoteId}
            onclick={() => onSelectNote?.(note.id)}
            role="button"
            tabindex="0"
            onkeydown={(e) => e.key === 'Enter' && onSelectNote?.(note.id)}
          >
            <span class="note-icon">{note.icon || '📄'}</span>
            <div class="note-info">
              <span class="note-title-text">{note.title}</span>
              <span class="note-preview">{getPreview(note)}</span>
            </div>
            <div class="note-actions">
              <button class="icon-btn small" onclick={(e) => openTagInput(note.id, e)} title="Add tag">
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M20.59 13.41l-7.17 7.17a2 2 0 0 1-2.83 0L2 12V2h10l8.59 8.59a2 2 0 0 1 0 2.82z"></path><line x1="7" y1="7" x2="7.01" y2="7"></line></svg>
              </button>
              <button class="icon-btn small" onclick={(e) => handleRename(note.id, e)} title="Rename">
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path></svg>
              </button>
              <button class="icon-btn small danger" onclick={(e) => handleDelete(note.id, e)} title="Delete">
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path></svg>
              </button>
            </div>
          </div>
        {/each}
      </div>
    {/if}

    {#if rootNotes.length === 0 && !loading}
      <div class="empty">No pages yet</div>
    {/if}
  </div>

  {#if tagContextNoteId}
    <div class="tag-input-bar">
      <input
        type="text"
        bind:value={tagInputValue}
        onkeydown={handleTagKeydown}
        placeholder="tags (comma-separated)"
      />
      <button class="icon-btn small" onclick={saveTags} title="Save tags">
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="20 6 9 17 4 12"></polyline></svg>
      </button>
    </div>
  {/if}

</aside>

{#if collapsed}
  <button class="sidebar-reveal" onclick={() => onReveal?.() || ontoggle?.()} title="Open pages">
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="3" y1="12" x2="21" y2="12"></line><line x1="3" y1="6" x2="21" y2="6"></line><line x1="3" y1="18" x2="21" y2="18"></line></svg>
  </button>
{/if}

<style>
  .note-sidebar {
    position: fixed;
    left: 0;
    top: 0;
    bottom: 0;
    width: 280px;
    background: var(--surface);
    border-right: 1px solid var(--border);
    display: flex;
    flex-direction: column;
    z-index: 100;
    transition: transform 0.25s ease;
  }
  .note-sidebar.collapsed { transform: translateX(-280px); }

  .sidebar-header {
    display: flex;
    align-items: center;
    gap: 6px;
    padding: 14px 12px;
    border-bottom: 1px solid var(--border);
    flex-shrink: 0;
    min-height: 48px;
  }
  .sidebar-title {
    flex: 1;
    font-size: 0.82em;
    font-weight: 600;
    color: var(--fg);
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .icon-btn {
    display: flex; align-items: center; justify-content: center;
    width: 28px; height: 28px; padding: 0;
    border: none; background: none; cursor: pointer;
    color: var(--muted); border-radius: 6px;
    transition: color 0.15s, background 0.15s;
    flex-shrink: 0;
  }
  .new-btn-inline {
    display: flex; align-items: center; justify-content: center;
    width: 26px; height: 26px; padding: 0; flex-shrink: 0;
    border: none; background: none; cursor: pointer;
    color: var(--muted); border-radius: 6px;
    transition: color 0.15s, background 0.15s;
  }
  .new-btn-inline:hover { color: var(--fg); background: var(--hover); }

  .icon-btn:hover { color: var(--fg); background: var(--hover); }
  .icon-btn.danger:hover { color: #ef4444; background: rgba(220,38,38,0.1); }
  .icon-btn.small { width: 24px; height: 24px; }

  .sidebar-body {
    flex: 1;
    overflow-y: auto;
    padding: 6px;
  }

  .note-item {
    display: flex;
    align-items: center;
    gap: 6px;
    padding: 8px 10px;
    border-radius: 6px;
    cursor: pointer;
    transition: background 0.12s;
  }
  .note-item:hover { background: var(--hover); }
  .note-item.active {
    background: var(--accent);
    color: #fff;
  }
  .note-item.active .note-actions { opacity: 1; }

  .note-icon { font-size: 0.85em; flex-shrink: 0; }

  .note-info {
    flex: 1;
    min-width: 0;
    display: flex;
    flex-direction: column;
    gap: 1px;
  }
  .note-title-text {
    font-size: 0.82em;
    font-weight: 500;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
  .note-preview {
    font-size: 0.7em;
    color: var(--muted);
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
  .note-item.active .note-preview { color: rgba(255,255,255,0.65); }

  .note-actions {
    display: flex;
    gap: 1px;
    opacity: 0;
    transition: opacity 0.12s;
    flex-shrink: 0;
  }
  .note-item:hover .note-actions { opacity: 1; }

  .empty {
    text-align: center;
    padding: 32px 16px;
    color: var(--muted);
    font-size: 0.82em;
  }

  .tag-group { margin-bottom: 2px; }
  .tag-header {
    display: flex;
    align-items: center;
    gap: 4px;
    width: 100%;
    padding: 5px 10px;
    border: none;
    background: none;
    cursor: pointer;
    color: var(--muted);
    font-size: 0.72em;
    font-weight: 600;
    text-transform: uppercase;
    letter-spacing: 0.04em;
    border-radius: 4px;
    transition: color 0.12s, background 0.12s;
    font-family: inherit;
    text-align: left;
  }
  .tag-header:hover { color: var(--fg); background: var(--hover); }
  .tag-chevron {
    display: flex;
    align-items: center;
    transition: transform 0.15s;
    flex-shrink: 0;
  }
  .tag-chevron.collapsed { transform: rotate(-90deg); }
  .tag-label { flex: 1; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
  .tag-count {
    font-size: 0.9em;
    font-weight: 400;
    opacity: 0.5;
  }
  .untagged-label { cursor: default; }
  .untagged-label:hover { background: none; }
  .note-item.tagged { padding-left: 20px; }

  .tag-input-bar {
    display: flex;
    align-items: center;
    gap: 4px;
    padding: 6px 10px;
    border-top: 1px solid var(--border);
    flex-shrink: 0;
  }
  .tag-input-bar input {
    flex: 1;
    border: none;
    background: none;
    outline: none;
    color: var(--fg);
    font-size: 0.78em;
    font-family: inherit;
    padding: 2px 0;
  }
  .tag-input-bar input::placeholder { color: var(--muted); }



  .sidebar-reveal {
    position: fixed;
    left: 8px;
    top: 12px;
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
    z-index: 90;
    transition: color 0.15s, background 0.15s;
  }
  .sidebar-reveal:hover { color: var(--fg); background: var(--hover); }
</style>
