import { addToQueue, getSettings, addLog } from './storage.js'

// Track open YouTube tabs: tabId -> { videoId, title, url, openedAt }
const watchedTabs = new Map()

export function getWatchedTabs() {
  return new Map(watchedTabs)
}

export function getPendingCount() {
  // Count all uncollected tabs — "Collect Now" bypasses age threshold
  let count = 0
  for (const t of watchedTabs.values()) {
    if (!t.collected) count++
  }
  return count
}

const YT_RE = /^https?:\/\/(?:www\.)?youtube\.com\/watch\?v=([\w-]{11})/

function extractVideoId(url) {
  const m = url.match(YT_RE)
  return m ? m[1] : null
}

// Called when a tab URL changes or a new tab appears
export async function onTabUpdated(tabId, changeInfo, tab) {
  if (!tab.url || tab.status !== 'complete') return
  const videoId = extractVideoId(tab.url)
  if (!videoId) {
    // Was a YouTube tab, now isn't — remove it
    if (watchedTabs.has(tabId)) {
      watchedTabs.delete(tabId)
      await addLog({ type: 'unwatch', tabId, url: tab.url })
    }
    return
  }

  // Already tracking this tab
  if (watchedTabs.has(tabId)) return

  watchedTabs.set(tabId, {
    tabId,
    videoId,
    title: tab.title?.replace(/ - YouTube$/, '') || 'Untitled',
    url: tab.url,
    openedAt: Date.now(),
    eligible: false,
    collected: false,
  })

  await addLog({ type: 'watch', tabId, videoId, title: tab.title })
}

// Called when a tab is closed
export function onTabRemoved(tabId) {
  watchedTabs.delete(tabId)
}

// Periodic check: mark tabs as eligible based on age threshold
export async function checkThresholds() {
  const settings = await getSettings()
  if (!settings.enabled) return { triggered: false, reason: 'disabled' }

  const thresholdAge = (settings.tabAgeMinutes || 5) * 60 * 1000
  const thresholdCount = settings.tabCountThreshold || 5

  const now = Date.now()
  let eligibleCount = 0

  for (const tab of watchedTabs.values()) {
    const age = now - tab.openedAt
    if (age >= thresholdAge) {
      tab.eligible = true
      eligibleCount++
    }
  }

  // Trigger if count threshold met
  if (eligibleCount >= thresholdCount) {
    const videos = [...watchedTabs.values()].filter(t => t.eligible && !t.collected)
    if (videos.length > 0) {
      await addLog({ type: 'threshold_trigger', count: videos.length, reason: 'count' })
      return { triggered: true, reason: 'count', videos }
    }
  }

  return { triggered: false, reason: 'thresholds_not_met' }
}

// Collect all currently watched tabs regardless of age (for "Collect Now")
export function collectAll() {
  const videos = [...watchedTabs.values()]
    .filter(t => !t.collected)
    .map(t => ({ videoId: t.videoId, title: t.title, url: t.url }))
  return { triggered: videos.length > 0, reason: videos.length > 0 ? 'manual' : 'nothing_to_collect', videos }
}

// Mark videos as collected (after sending to NotebookLM)
export function markCollected(videoIds) {
  for (const [tabId, tab] of watchedTabs) {
    if (videoIds.includes(tab.videoId)) {
      tab.collected = true
    }
  }
}

// Remove stale tabs that no longer exist
export async function syncWithOpenTabs() {
  const tabs = await chrome.tabs.query({})
  const openTabIds = new Set(tabs.map(t => t.id))
  for (const [tabId] of watchedTabs) {
    if (!openTabIds.has(tabId)) {
      watchedTabs.delete(tabId)
    }
  }
}

// Rescan all open tabs for YouTube videos (handles service worker restart)
export async function rescanAllTabs() {
  const tabs = await chrome.tabs.query({ url: 'https://www.youtube.com/*' })
  for (const tab of tabs) {
    if (tab.url && tab.status === 'complete' && !watchedTabs.has(tab.id)) {
      const videoId = extractVideoId(tab.url)
      if (videoId) {
        watchedTabs.set(tab.id, {
          tabId: tab.id,
          videoId,
          title: tab.title?.replace(/ - YouTube$/, '') || 'Untitled',
          url: tab.url,
          openedAt: Date.now(),
          eligible: false,
          collected: false,
        })
      }
    }
  }
}
