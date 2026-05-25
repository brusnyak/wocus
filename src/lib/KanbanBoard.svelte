<script>
  let { open = false, contentJson = '{}', onUpdateTodos, onclose } = $props()

  function extractTodos(json) {
    if (!json || !json.content) return []
    const todos = []
    json.content.forEach((node, blockIndex) => {
      if (node.type === 'taskList' && node.content) {
        node.content.forEach((item) => {
          const text = item.content?.[0]?.content?.[0]?.text || 'Untitled task'
          const rawStatus = item.attrs?.status || (item.attrs?.checked ? 'done' : 'todo')
          todos.push({
            text,
            blockIndex,
            taskListIndex: json.content.indexOf(node),
            status: rawStatus,
          })
        })
      }
    })
    return todos
  }

  let parsed = $derived(JSON.parse(contentJson))
  let todos = $derived(extractTodos(parsed))

  let todoItems = $derived(todos.filter(t => t.status === 'todo'))
  let inProgressItems = $derived(todos.filter(t => t.status === 'in-progress'))
  let doneItems = $derived(todos.filter(t => t.status === 'done'))

  function setStatus(item, status) {
    const json = JSON.parse(contentJson)
    const taskList = json.content[item.blockIndex]
    if (!taskList || !taskList.content) return
    for (const child of taskList.content) {
      if ((child.content?.[0]?.content?.[0]?.text || 'Untitled task') === item.text) {
        child.attrs = { ...child.attrs, status, checked: status === 'done' }
      }
    }
    onUpdateTodos?.(JSON.stringify(json))
  }

  function moveToInProgress(item) { setStatus(item, 'in-progress') }

  function moveBackToTodo(item) { setStatus(item, 'todo') }

  function moveToDone(item) { setStatus(item, 'done') }

  function handleOverlayClick(e) {
    if (e.target === e.currentTarget) onclose?.()
  }

  function truncate(text, len = 80) {
    return text.length > len ? text.slice(0, len) + '…' : text
  }
</script>

{#if open}
  <div class="kanban-overlay" onclick={handleOverlayClick} onkeydown={(e) => e.key === 'Escape' && onclose?.()} role="dialog" tabindex="-1">
    <div class="kanban">
      <div class="kanban-header">
        <h2>Kanban Board</h2>
        <button class="close-btn" onclick={() => onclose?.()}>✕</button>
      </div>
      <div class="kanban-body">
        {#if todos.length === 0}
          <div class="empty-state">No tasks found in note</div>
        {:else}
          <div class="columns">
            <div class="column">
              <div class="col-header muted">
                <span>To Do</span>
                <span class="badge">{todoItems.length}</span>
              </div>
              <div class="col-cards">
                {#each todoItems as item (item.blockIndex + '-' + item.text)}
                  <div class="card">
                    <span class="card-text">{truncate(item.text)}</span>
                    <button class="move-btn" onclick={() => moveToInProgress(item)} title="Move to In Progress">→</button>
                  </div>
                {/each}
              </div>
            </div>
            <div class="column">
              <div class="col-header accent">
                <span>In Progress</span>
                <span class="badge accent-badge">{inProgressItems.length}</span>
              </div>
              <div class="col-cards">
                {#each inProgressItems as item (item.blockIndex + '-' + item.text)}
                  <div class="card">
                    <button class="move-btn" onclick={() => moveBackToTodo(item)} title="Move back">←</button>
                    <span class="card-text">{truncate(item.text)}</span>
                    <button class="move-btn" onclick={() => moveToDone(item)} title="Move to Done">→</button>
                  </div>
                {/each}
              </div>
            </div>
            <div class="column">
              <div class="col-header done">
                <span>Done</span>
                <span class="badge done-badge">{doneItems.length}</span>
              </div>
              <div class="col-cards">
                {#each doneItems as item (item.blockIndex + '-' + item.text)}
                  <div class="card done-card">
                    <button class="move-btn" onclick={() => moveBackToTodo(item)} title="Move back">←</button>
                    <span class="card-text strikethrough">{truncate(item.text)}</span>
                  </div>
                {/each}
              </div>
            </div>
          </div>
        {/if}
      </div>
    </div>
  </div>
{/if}

<style>
  .kanban-overlay {
    position: fixed;
    inset: 0;
    background: rgba(0,0,0,0.4);
    display: flex;
    align-items: center;
    justify-content: center;
    z-index: 200;
  }
  .kanban {
    background: var(--surface);
    border-radius: 12px;
    width: 800px;
    max-width: 90vw;
    max-height: 80vh;
    display: flex;
    flex-direction: column;
    box-shadow: 0 8px 40px rgba(0,0,0,0.15);
  }
  .kanban-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 16px 20px;
    border-bottom: 1px solid var(--border);
    flex-shrink: 0;
  }
  .kanban-header h2 {
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
  .kanban-body {
    padding: 16px 20px;
    overflow-y: auto;
    flex: 1;
  }
  .empty-state {
    text-align: center;
    padding: 48px 16px;
    color: var(--muted);
    font-size: 0.9em;
  }
  .columns {
    display: grid;
    grid-template-columns: 1fr 1fr 1fr;
    gap: 12px;
    min-height: 200px;
  }
  .column {
    display: flex;
    flex-direction: column;
    gap: 8px;
    min-width: 0;
  }
  .col-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    font-size: 0.85em;
    font-weight: 600;
    padding-bottom: 8px;
    border-bottom: 2px solid var(--border);
  }
  .col-header.muted { color: var(--muted); border-color: var(--muted); }
  .col-header.accent { color: var(--accent); border-color: var(--accent); }
  .col-header.done { color: #22c55e; border-color: #22c55e; }
  .badge {
    font-size: 0.75em;
    background: var(--bg);
    color: var(--muted);
    padding: 2px 7px;
    border-radius: 10px;
    font-weight: 500;
  }
  .badge.accent-badge { background: var(--accent); color: #fff; }
  .badge.done-badge { background: #22c55e; color: #fff; }
  .col-cards {
    display: flex;
    flex-direction: column;
    gap: 6px;
  }
  .card {
    display: flex;
    align-items: center;
    gap: 6px;
    padding: 8px 10px;
    background: var(--bg);
    border: 1px solid var(--border);
    border-radius: 8px;
    transition: border-color 0.15s;
  }
  .card:hover { border-color: var(--accent); }
  .card.done-card { opacity: 0.7; }
  .card.done-card:hover { opacity: 1; }
  .card-text {
    flex: 1;
    font-size: 0.8em;
    line-height: 1.4;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
  .card-text.strikethrough { text-decoration: line-through; }
  .move-btn {
    background: var(--surface);
    border: 1px solid var(--border);
    border-radius: 4px;
    cursor: pointer;
    font-size: 0.8em;
    padding: 2px 6px;
    color: var(--muted);
    flex-shrink: 0;
    transition: background 0.15s, color 0.15s;
  }
  .move-btn:hover {
    background: var(--hover);
    color: var(--fg);
    border-color: var(--accent);
  }
</style>
