import { getSettings, updateSettings, addLog, getQueue, setQueue, addToQueue, updateVideoStatus, clearQueue } from './lib/storage.js'
import { onTabUpdated, onTabRemoved, checkThresholds, collectAll, markCollected, syncWithOpenTabs, rescanAllTabs, getWatchedTabs, getPendingCount } from './lib/tabwatch.js'
import { listNotebooks, createNotebook, addSource, verifyConnection } from './lib/notebooklm.js'

// ── Initialization ──────────────────────────────────────────────
const ALARM_NAME = 'sourcus-check'
const CHECK_INTERVAL_MINUTES = 1

chrome.runtime.onInstalled.addListener(async () => {
  const settings = await getSettings()
  // Migrate: stale notebook IDs from buggy extractResponse (looked like RPC IDs
  // or single characters, e.g. "r" from "wrb.fr"[1])
  const NOT_A_REAL_NOTEBOOK = ['wXbhsf', 'CCqFvf', 'izAoDd', 'ozz5Z']
  const clean = settings.targetNotebookId
  if (clean && (NOT_A_REAL_NOTEBOOK.includes(clean) || clean.length === 1)) {
    await updateSettings({ targetNotebookId: '_new' })
    await addLog({ type: 'migrate_clear_stale_id', old: clean })
  }
  if (!settings.targetNotebookId) {
    await updateSettings({ targetNotebookId: '_new' })
  }
  await syncWithOpenTabs()
  chrome.alarms.create(ALARM_NAME, { periodInMinutes: CHECK_INTERVAL_MINUTES })
  await addLog({ type: 'installed', version: chrome.runtime.getManifest().version })
  // Auto-check NotebookLM connection on install
  checkNotebookLmConnection()
})

chrome.runtime.onStartup.addListener(async () => {
  await syncWithOpenTabs()
  chrome.alarms.create(ALARM_NAME, { periodInMinutes: CHECK_INTERVAL_MINUTES })
})

// ── Auto auth check ──────────────────────────────────────────────

async function checkNotebookLmConnection() {
  await addLog({ type: 'auth_check_start' })
  try {
    const result = await verifyConnection()
    await updateSettings({
      connectionStatus: { connected: true, notebookCount: result.notebookCount, checkedAt: Date.now() }
    })
    await addLog({ type: 'auth_check_ok', count: result.notebookCount })
  } catch (err) {
    await updateSettings({
      connectionStatus: { connected: false, error: err.message, checkedAt: Date.now() }
    })
    await addLog({ type: 'auth_check_fail', error: err.message })
  }
}

// ── Tab Watching ────────────────────────────────────────────────
chrome.tabs.onUpdated.addListener(onTabUpdated)
chrome.tabs.onRemoved.addListener(onTabRemoved)

// ── Periodic Check ──────────────────────────────────────────────
chrome.alarms.onAlarm.addListener(async (alarm) => {
  if (alarm.name !== ALARM_NAME) return
  await runCollectionCycle()
})

// ── Message Handling ────────────────────────────────────────────
chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  switch (msg.action) {
    case 'collectNow':
      runCollectionCycle({ force: true }).then(result => sendResponse(result))
      return true
    case 'verifyConnection':
      verifyConnection()
        .then(r => {
          updateSettings({ connectionStatus: { ...r, checkedAt: Date.now() } })
          sendResponse(r)
        })
        .catch(e => {
          const err = { connected: false, error: e.message, checkedAt: Date.now() }
          updateSettings({ connectionStatus: err })
          sendResponse(err)
        })
      return true
    case 'retryAuth':
      checkNotebookLmConnection().then(() => {
        getSettings().then(s => sendResponse({ connectionStatus: s.connectionStatus }))
      })
      return true
    case 'listNotebooks':
      listNotebooks()
        .then(nb => sendResponse({ notebooks: nb }))
        .catch(e => sendResponse({ error: e.message }))
      return true
    case 'getStatus':
      getStatus().then(s => sendResponse(s))
      return true
    case 'debugReset':
      clearQueue()
      markCollected([])
      sendResponse({ ok: true })
      return true
  }
})

// ── Core Collection Cycle ───────────────────────────────────────
async function runCollectionCycle(opts = {}) {
  // Rescan all tabs in case service worker restarted
  await rescanAllTabs()

  const settings = await getSettings()
  if (!settings.enabled) return { triggered: false, reason: 'disabled' }

  await addLog({ type: 'cycle_start' })

  // "Collect Now" collects all uncollected tabs regardless of age
  const result = opts.force ? collectAll() : await checkThresholds()
  if (!result.triggered) {
    await addLog({ type: 'cycle_end', reason: result.reason })
    return result
  }

  const { videos } = result
  await addLog({ type: 'collect', count: videos.length, videos: videos.map(v => v.videoId) })

  // Add all eligible videos to the queue
  for (const v of videos) {
    await addToQueue({
      videoId: v.videoId,
      title: v.title,
      url: v.url,
      status: 'pending',
    })
  }

  // Send to NotebookLM
  try {
    // Generate notebook name from first video title
    const notebookName = generateNotebookName(videos)
    const notebookId = await ensureNotebook(settings, notebookName)
    if (!notebookId) {
      throw new Error('No target notebook configured')
    }

    for (const v of videos) {
      try {
        await updateVideoStatus(v.videoId, 'sending')
        await addSource(notebookId, v.url, v.title)
        await updateVideoStatus(v.videoId, 'sent')
        await addLog({ type: 'sent', videoId: v.videoId, title: v.title })
      } catch (err) {
        await updateVideoStatus(v.videoId, 'failed', err.message)
        await addLog({ type: 'send_failed', videoId: v.videoId, error: err.message })
      }
    }

    markCollected(videos.map(v => v.videoId))
    // Connection confirmed — update stored status so popup shows it
    updateSettings({ connectionStatus: { connected: true, checkedAt: Date.now() } })
  } catch (err) {
    await addLog({ type: 'collection_error', error: err.message })
    for (const v of videos) {
      await updateVideoStatus(v.videoId, 'failed', err.message)
    }
  }

  await addLog({ type: 'cycle_end', reason: 'completed' })
  return { triggered: true, sent: videos.length }
}

function generateNotebookName(videos) {
  if (!videos || videos.length === 0) return 'Sourcus - YouTube Digest'
  const firstTitle = videos[0].title || 'YouTube Video'
  const extra = videos.length > 1 ? ` (+${videos.length - 1} more)` : ''
  const date = new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
  // Truncate first title to 60 chars so the full name stays under ~80
  const short = firstTitle.length > 60 ? firstTitle.slice(0, 57) + '...' : firstTitle
  return `${short}${extra} — ${date}`
}

async function ensureNotebook(settings, suggestedName) {
  // Reuse existing notebook ID unless user wants a fresh one each cycle
  if (!settings.createNewNotebook) {
    const NOT_A_REAL_NOTEBOOK2 = ['wXbhsf', 'CCqFvf', 'izAoDd', 'ozz5Z']
    const sid = settings.targetNotebookId
    if (sid && sid !== '_new' && !NOT_A_REAL_NOTEBOOK2.includes(sid) && sid.length > 1) {
      return sid
    }
  }

  // Create a new notebook — use suggested name, then settings override, then fallback
  const name = suggestedName || settings.targetNotebookName || 'Sourcus - YouTube Digest'
  try {
    const id = await createNotebook(name)
    await updateSettings({ targetNotebookId: id, targetNotebookName: name })
    await addLog({ type: 'notebook_created', id, name })
    return id
  } catch (err) {
    await addLog({ type: 'notebook_create_failed', error: err.message })
    throw err
  }
}

async function getStatus() {
  const queue = await getQueue()
  const settings = await getSettings()
  return {
    queueCount: queue.length,
    pendingCount: queue.filter(v => v.status === 'pending' || v.status === 'sending').length,
    sentCount: queue.filter(v => v.status === 'sent').length,
    failedCount: queue.filter(v => v.status === 'failed').length,
    enabled: settings.enabled,
    notebookId: settings.targetNotebookId,
    tabAgeMinutes: settings.tabAgeMinutes,
    tabCountThreshold: settings.tabCountThreshold,
    watchedCount: getWatchedTabs().size,
    pendingWatchCount: getPendingCount(),
    connectionStatus: settings.connectionStatus || null,
  }
}
