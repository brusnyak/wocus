import { getSettings, updateSettings, getLog, clearLog } from '../lib/storage.js'

// ── DOM refs ────────────────────────────────────────────────────
const tabAge = document.getElementById('tabAge')
const tabCount = document.getElementById('tabCount')
const notebookMode = document.getElementById('notebookMode')
const notebookSelectField = document.getElementById('notebookSelectField')
const notebookSelect = document.getElementById('notebookSelect')
const refreshNotebooks = document.getElementById('refreshNotebooks')
const notebookName = document.getElementById('notebookName')
const enabled = document.getElementById('enabled')
const debugMode = document.getElementById('debugMode')
const verifyBtn = document.getElementById('verifyBtn')
const verifyResult = document.getElementById('verifyResult')
const saveBtn = document.getElementById('saveBtn')
const saveStatus = document.getElementById('saveStatus')
const clearLogBtn = document.getElementById('clearLogBtn')
const collectNowBtn = document.getElementById('collectNowBtn')
const logEntries = document.getElementById('logEntries')

let currentNotebooks = []

// ── Load ────────────────────────────────────────────────────────
async function loadSettings() {
  const s = await getSettings()
  tabAge.value = s.tabAgeMinutes
  tabCount.value = s.tabCountThreshold
  notebookMode.value = s.targetNotebookId === '_new' ? '_new' : '_existing'
  notebookName.value = s.targetNotebookName
  enabled.checked = s.enabled
  debugMode.checked = s.debugMode
  toggleNotebookSelect()
}

function toggleNotebookSelect() {
  if (notebookMode.value === '_existing') {
    notebookSelectField.style.display = ''
  } else {
    notebookSelectField.style.display = 'none'
  }
}

notebookMode.addEventListener('change', toggleNotebookSelect)

async function loadNotebooks() {
  notebookSelect.innerHTML = '<option value="">Loading...</option>'
  notebookSelect.disabled = true
  try {
    const result = await chrome.runtime.sendMessage({ action: 'listNotebooks' })
    if (result.error) throw new Error(result.error)
    currentNotebooks = result.notebooks || []
    if (currentNotebooks.length === 0) {
      notebookSelect.innerHTML = '<option value="">No notebooks found</option>'
    } else {
      notebookSelect.innerHTML = currentNotebooks.map(n =>
        `<option value="${n.projectId || n.id}">${n.title || 'Untitled'}</option>`
      ).join('')
    }
    // Select current target if it exists
    const s = await getSettings()
    if (s.targetNotebookId && s.targetNotebookId !== '_new') {
      notebookSelect.value = s.targetNotebookId
    }
  } catch (err) {
    notebookSelect.innerHTML = `<option value="">Error: ${err.message}</option>`
  }
  notebookSelect.disabled = false
}

// ── Verify NotebookLM ──────────────────────────────────────────
verifyBtn.addEventListener('click', async () => {
  verifyBtn.disabled = true
  verifyResult.textContent = 'Verifying...'
  verifyResult.className = ''
  try {
    const result = await chrome.runtime.sendMessage({ action: 'verifyConnection' })
    if (result.connected) {
      verifyResult.textContent = `✓ Connected (${result.notebookCount} notebooks)`
      verifyResult.className = 'connected'
      await loadNotebooks()
    } else {
      verifyResult.textContent = `✗ ${result.error}`
      verifyResult.className = 'error'
    }
  } catch (err) {
    verifyResult.textContent = `✗ ${err.message}`
    verifyResult.className = 'error'
  }
  verifyBtn.disabled = false
})

refreshNotebooks.addEventListener('click', loadNotebooks)

// ── Save ────────────────────────────────────────────────────────
saveBtn.addEventListener('click', async () => {
  const targetNotebookId = notebookMode.value === '_new'
    ? '_new'
    : notebookSelect.value

  const createNewNotebook = notebookMode.value === '_new'

  await updateSettings({
    tabAgeMinutes: parseInt(tabAge.value) || 5,
    tabCountThreshold: parseInt(tabCount.value) || 5,
    targetNotebookId,
    targetNotebookName: notebookName.value || 'Sourcus - YouTube Digest',
    createNewNotebook,
    enabled: enabled.checked,
    debugMode: debugMode.checked,
  })

  saveStatus.textContent = '✓ Saved'
  setTimeout(() => { saveStatus.textContent = '' }, 2000)
})

// ── Debug Log ───────────────────────────────────────────────────
async function renderLog() {
  const log = await getLog()
  logEntries.innerHTML = log.slice(-100).reverse().map(e => {
    const cls = e.type.includes('error') || e.type.includes('fail') ? 'log-error'
      : e.type === 'sent' ? 'log-sent'
      : ''
    // Collect all fields EXCEPT the standard ones already rendered,
    // plus any long raw data that would be unreadable inline.
    const hiddenKeys = new Set(['type', 'timestamp', 'error', 'videoId', 'title'])
    const extra = Object.entries(e).filter(([k]) => !hiddenKeys.has(k))
    const extraHtml = extra.length > 0 ? ' <span class="log-extra">' + extra.map(([k, v]) => {
      const val = typeof v === 'string' ? v : JSON.stringify(v)
      return `<span class="log-kv"><strong>${k}:</strong> ${escapeHtml(val.slice(0, 300))}</span>`
    }).join(' | ') + '</span>' : ''
    return `<div class="log-entry">
      <span class="log-time">[${new Date(e.timestamp).toLocaleString()}]</span>
      <span class="log-type ${cls}">${e.type}</span>
      ${e.error ? `<span class="log-error">${escapeHtml(e.error)}</span>` : ''}
      ${e.videoId ? `— ${e.videoId}` : ''}
      ${e.title ? `— ${escapeHtml(e.title)}` : ''}
      ${extraHtml}
    </div>`
  }).join('')
}

clearLogBtn.addEventListener('click', async () => {
  await clearLog()
  await renderLog()
})

collectNowBtn.addEventListener('click', async () => {
  collectNowBtn.disabled = true
  collectNowBtn.textContent = 'Running...'
  const result = await chrome.runtime.sendMessage({ action: 'collectNow' })
  await renderLog()
  collectNowBtn.disabled = false
  collectNowBtn.textContent = 'Test Collect'
  const msg = result?.sent
    ? `Sent ${result.sent} video(s)`
    : result?.reason
      ? `Skipped: ${result.reason}`
      : 'Collect completed'
  collectNowBtn.textContent = msg
  setTimeout(() => { collectNowBtn.textContent = 'Test Collect' }, 3000)
})

// ── Init ────────────────────────────────────────────────────────
await loadSettings()
await renderLog()
setInterval(renderLog, 3000) // auto-refresh log

function escapeHtml(s) {
  if (!s) return ''
  const d = document.createElement('div')
  d.textContent = s
  return d.innerHTML
}
