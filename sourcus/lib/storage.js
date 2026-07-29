// chrome.storage.local wrapper for Sourcus settings and state
const DEFAULTS = {
  tabAgeMinutes: 5,
  tabCountThreshold: 5,
  targetNotebookId: '_new',
  targetNotebookName: 'Sourcus - YouTube Digest',
  createNewNotebook: true,
  enabled: true,
  debugMode: false,
  connectionStatus: null,
}

export async function getSettings() {
  const data = await chrome.storage.local.get(Object.keys(DEFAULTS))
  return { ...DEFAULTS, ...data }
}

export async function updateSettings(partial) {
  await chrome.storage.local.set(partial)
}

// Collected video queue — persists between popup opens
export async function getQueue() {
  const { queue = [] } = await chrome.storage.local.get('queue')
  return queue
}

export async function setQueue(queue) {
  await chrome.storage.local.set({ queue })
}

export async function addToQueue(video) {
  const queue = await getQueue()
  // Deduplicate by videoId
  const exists = queue.some(v => v.videoId === video.videoId)
  if (exists) return queue
  const updated = [...queue, { ...video, status: 'pending', addedAt: Date.now() }]
  await chrome.storage.local.set({ queue: updated })
  return updated
}

export async function updateVideoStatus(videoId, status, error) {
  const queue = await getQueue()
  const updated = queue.map(v =>
    v.videoId === videoId ? { ...v, status, error, processedAt: Date.now() } : v
  )
  await chrome.storage.local.set({ queue: updated })
  return updated
}

export async function clearQueue() {
  await chrome.storage.local.set({ queue: [] })
}

// Debug log
export async function addLog(entry) {
  const { log = [] } = await chrome.storage.local.get('log')
  log.push({ ...entry, timestamp: Date.now() })
  if (log.length > 500) log.splice(0, log.length - 500)
  await chrome.storage.local.set({ log })
}

export async function getLog() {
  const { log = [] } = await chrome.storage.local.get('log')
  return log
}

export async function clearLog() {
  await chrome.storage.local.set({ log: [] })
}
