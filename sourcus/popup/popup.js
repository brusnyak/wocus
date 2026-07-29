// ── DOM refs ────────────────────────────────────────────────────
const statusBadge = document.getElementById('statusBadge')
const watchCount = document.getElementById('watchCount')
const queueCount = document.getElementById('queueCount')
const sentCount = document.getElementById('sentCount')
const failedCount = document.getElementById('failedCount')
const failedStat = document.getElementById('failedStat')
const queueSection = document.getElementById('queueSection')
const queueList = document.getElementById('queueList')
const clearBtn = document.getElementById('clearBtn')
const collectBtn = document.getElementById('collectBtn')
const optionsBtn = document.getElementById('optionsBtn')
const debugSection = document.getElementById('debugSection')
const debugLog = document.getElementById('debugLog')
const toggleDebug = document.getElementById('toggleDebug')
const connectionStatusEl = document.getElementById('connectionStatus')

function renderConnectionStatus(cs) {
  if (!cs) {
    connectionStatusEl.textContent = 'NotebookLM: tap to check connection'
    connectionStatusEl.className = 'conn-status conn-unknown'
    connectionStatusEl.style.cursor = 'pointer'
    return
  }
  if (cs.connected) {
    const count = cs.notebookCount !== undefined ? ` (${cs.notebookCount} notebooks)` : ''
    connectionStatusEl.textContent = `NotebookLM: ✓ connected${count}`
    connectionStatusEl.className = 'conn-status conn-ok'
    connectionStatusEl.style.cursor = 'default'
  } else {
    connectionStatusEl.textContent = `NotebookLM: ✗ ${cs.error || 'disconnected'}  (tap to retry)`
    connectionStatusEl.className = 'conn-status conn-err'
    connectionStatusEl.style.cursor = 'pointer'
  }
}

async function retryConnection() {
  connectionStatusEl.textContent = 'NotebookLM: checking...'
  connectionStatusEl.className = 'conn-status conn-unknown'
  connectionStatusEl.style.cursor = 'default'
  const result = await chrome.runtime.sendMessage({ action: 'retryAuth' })
  renderConnectionStatus(result.connectionStatus)
}

connectionStatusEl.addEventListener('click', () => {
  if (connectionStatusEl.classList.contains('conn-err') ||
      connectionStatusEl.classList.contains('conn-unknown')) {
    retryConnection()
  }
})

// ── Load & Render ───────────────────────────────────────────────
async function load() {
  const status = await chrome.runtime.sendMessage({ action: 'getStatus' })
  renderStatus(status)
  renderQueue(status)
  // Auto-retry connection if never checked
  if (!status.connectionStatus) {
    retryConnection()
  }
}

function renderStatus(s) {
  renderConnectionStatus(s.connectionStatus)
  watchCount.textContent = s.watchedCount ?? '?'
  queueCount.textContent = s.queueCount
  sentCount.textContent = s.sentCount
  failedCount.textContent = s.failedCount

  failedStat.style.display = s.failedCount > 0 ? '' : 'none'
  statusBadge.textContent = s.enabled ? 'active' : 'paused'
  statusBadge.className = 'badge' + (s.enabled ? '' : ' inactive')
  collectBtn.textContent = s.pendingWatchCount > 0
    ? `Collect ${s.pendingWatchCount} Video${s.pendingWatchCount > 1 ? 's' : ''}`
    : 'Collect Now'
}

async function renderQueue() {
  const { queue = [] } = await chrome.storage.local.get('queue')
  const pending = queue.filter(v => v.status === 'pending' || v.status === 'sending')
  const sent = queue.filter(v => v.status === 'sent')
  const failed = queue.filter(v => v.status === 'failed')

  if (queue.length === 0) {
    queueSection.style.display = 'none'
    return
  }
  queueSection.style.display = ''

  queueList.innerHTML = queue.map(v => `
    <div class="queue-item">
      <span class="title" title="${escapeHtml(v.title)}">${escapeHtml(v.title || v.videoId)}</span>
      <span class="status ${v.status}">${v.status}${v.error ? ': ' + escapeHtml(v.error) : ''}</span>
    </div>
  `).join('')
}

function escapeHtml(s) {
  if (!s) return ''
  const d = document.createElement('div')
  d.textContent = s
  return d.innerHTML
}

// ── Actions ─────────────────────────────────────────────────────
collectBtn.addEventListener('click', async () => {
  collectBtn.disabled = true
  collectBtn.textContent = 'Collecting...'
  const result = await chrome.runtime.sendMessage({ action: 'collectNow' })
  await load()
})

optionsBtn.addEventListener('click', () => {
  chrome.runtime.openOptionsPage()
})

clearBtn.addEventListener('click', async () => {
  await chrome.runtime.sendMessage({ action: 'debugReset' })
  await load()
})

toggleDebug.addEventListener('click', async () => {
  if (debugLog.style.display === 'none' || !debugLog.style.display) {
    debugLog.style.display = ''
    toggleDebug.textContent = 'Hide'
    const { log = [] } = await chrome.storage.local.get('log')
    debugLog.innerHTML = log.slice(-50).reverse().map(e =>
      `<div class="debug-entry">[${new Date(e.timestamp).toLocaleTimeString()}] ${e.type}: ${JSON.stringify(e)}</div>`
    ).join('')
  } else {
    debugLog.style.display = 'none'
    toggleDebug.textContent = 'Show'
  }
})

// ── Init ────────────────────────────────────────────────────────
load()
// Auto-refresh every 5 seconds while popup is open
setInterval(load, 5000)
