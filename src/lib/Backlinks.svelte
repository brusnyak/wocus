<script>
  let {
    notes = [],
    currentNoteId = null,
    onSelectNote
  } = $props()

  let backlinks = $derived(
    notes.filter(n =>
      n.id !== currentNoteId &&
      n.text &&
      n.text.includes(`page://${currentNoteId}`)
    )
  )

  function extractSnippet(text, noteId) {
    const idx = text.indexOf(`page://${noteId}`)
    if (idx === -1) return ''
    const start = Math.max(0, idx - 40)
    const end = Math.min(text.length, idx + 20 + String(noteId).length + 40)
    let snippet = text.slice(start, end).replace(/\n/g, ' ')
    if (start > 0) snippet = '...' + snippet
    if (end < text.length) snippet = snippet + '...'
    return snippet.trim()
  }
</script>

{#if backlinks.length > 0}
  <div class="backlinks">
    <div class="backlinks-header">
      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"></path><path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"></path></svg>
      <span>{backlinks.length} backlink{backlinks.length !== 1 ? 's' : ''}</span>
    </div>
    <div class="backlinks-list">
      {#each backlinks as note (note.id)}
        <button class="backlink-item" onclick={() => onSelectNote?.(note.id)} title="Navigate to note">
          <span class="backlink-icon">{note.icon || '📄'}</span>
          <div class="backlink-info">
            <span class="backlink-title">{note.title}</span>
            <span class="backlink-snippet">{extractSnippet(note.text, currentNoteId)}</span>
          </div>
        </button>
      {/each}
    </div>
  </div>
{/if}

<style>
  .backlinks {
    margin: 1.5rem 0;
    padding: 0.75rem 1rem;
    border: 1px solid var(--border);
    border-radius: 8px;
    background: var(--surface);
  }
  .backlinks-header {
    display: flex;
    align-items: center;
    gap: 6px;
    font-size: 0.75em;
    font-weight: 600;
    color: var(--muted);
    margin-bottom: 0.5rem;
    text-transform: uppercase;
    letter-spacing: 0.05em;
  }
  .backlinks-list {
    display: flex;
    flex-direction: column;
    gap: 4px;
  }
  .backlink-item {
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 6px 8px;
    border-radius: 6px;
    border: none;
    background: none;
    cursor: pointer;
    text-align: left;
    width: 100%;
    transition: background 0.12s;
    font-family: inherit;
  }
  .backlink-item:hover { background: var(--hover); }
  .backlink-icon { font-size: 0.9em; flex-shrink: 0; }
  .backlink-info {
    flex: 1;
    min-width: 0;
    display: flex;
    flex-direction: column;
    gap: 1px;
  }
  .backlink-title {
    font-size: 0.8em;
    font-weight: 500;
    color: var(--fg);
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
  .backlink-snippet {
    font-size: 0.7em;
    color: var(--muted);
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
</style>
