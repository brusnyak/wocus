/*
 * NotebookLM RPC client.
 *
 * Uses a content script injected into notebooklm.google.com OR
 * notebook.google.com to execute batchexecute RPCs (required: MV3 service
 * workers can't send SameSite cookies cross-origin). Falls back to direct
 * fetch from the service worker if no NotebookLM tab is open.
 *
 * RPC IDs and parameter shapes sourced from the actively maintained
 * notebooklm-py project (github.com/teng-lin/notebooklm-py).
 * Domain handling: notebook.google.com is the primary (Google redirects
 * notebooklm.google.com → notebook.google.com); both are supported.
 */

import { addLog } from './storage.js'

const BATCHEXECUTE_PATH = '/_/LabsTailwindUi/data/batchexecute'

// Try both domains — Google is migrating from notebooklm.google.com to
// notebook.google.com. Different users/cohorts may be on either domain.
const DOMAINS = [
  'https://notebook.google.com',
  'https://notebooklm.google.com',
]

const RPC = {
  LIST_NOTEBOOKS: 'wXbhsf',    // -> ListRecentlyViewedProjects
  CREATE_NOTEBOOK: 'CCqFvf',   // -> CreateProject
  ADD_SOURCE_V2: 'ozz5Z',      // -> AddSources (v2; some cohorts require this)
  ADD_SOURCE_V1: 'izAoDd',     // -> AddSources (original; other cohorts still use this)
}

// ── Content script proxy ─────────────────────────────────────────

async function findNotebookLmTab() {
  for (const domain of DOMAINS) {
    const tabs = await chrome.tabs.query({ url: domain + '/*' })
    if (tabs.length > 0) return tabs[0]
  }
  // Fallback: scan all tabs for any domain that contains "notebook"
  const allTabs = await chrome.tabs.query({})
  return allTabs.find(t => t.url && (
    t.url.startsWith('https://notebook.google.com/') ||
    t.url.startsWith('https://notebooklm.google.com/')
  ))
}

async function rpcViaContentScript(rpcId, args, sourcePath) {
  const tab = await findNotebookLmTab()
  if (!tab) throw new Error('Open NotebookLM (notebook.google.com) and log in first.')

  const result = await chrome.tabs.sendMessage(tab.id, {
    source: 'sourcus',
    action: 'rpc',
    rpcId,
    args,
    sourcePath,
  })

  if (!result || !result.ok) {
    throw new Error(result?.error || 'Content script did not respond. Reload NotebookLM.')
  }

  return result.data
}

// ── Direct fetch fallback ────────────────────────────────────────

let authCache = null

async function getAuthToken() {
  if (authCache && authCache.expires > Date.now()) {
    return authCache
  }

  // Try each domain until one works (handles redirect/cohort differences)
  let lastError = null
  for (const domain of DOMAINS) {
    try {
      const resp = await fetch(domain + '/', { credentials: 'include' })
      if (resp.ok || resp.type === 'opaqueredirect') {
        // Even with opaque redirect, the response might not have the token.
        // If we got a 200, extract the token.
        if (resp.ok) {
          const html = await resp.text()
          const atMatch = html.match(/"SNlM0e":"([^"]+)"/)
          if (atMatch) {
            authCache = { at: atMatch[1], expires: Date.now() + 55 * 60 * 1000, domain }
            return authCache
          }
        }
      }
    } catch (e) {
      lastError = e
    }
  }

  throw new Error(lastError || 'Could not reach NotebookLM. Are you logged in?')
}

async function rpcDirect(rpcId, args, sourcePath) {
  const { at, domain } = await getAuthToken()

  const payload = [[[rpcId, JSON.stringify(args), null, 'generic']]]
  const params = new URLSearchParams()
  params.set('f.req', JSON.stringify(payload))

  const url = domain + BATCHEXECUTE_PATH + '?rpcids=' + encodeURIComponent(rpcId) + '&source-path=' + encodeURIComponent(sourcePath || '/')

  const resp = await fetch(url, {
    method: 'POST',
    credentials: 'include',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded;charset=UTF-8',
    },
    body: params.toString() + '&at=' + encodeURIComponent(at),
  })

  if (!resp.ok) {
    throw new Error(`NotebookLM RPC error ${resp.status}`)
  }

  const text = await resp.text()
  let cleaned = text.replace(/^\)\]\}'\n?/, '').trim()
  // Strip optional byte-length prefix line
  cleaned = cleaned.replace(/^\d+\n/, '').trim()
  if (!cleaned) {
    throw new Error('Empty NotebookLM RPC response (auth may have expired)')
  }

  return JSON.parse(cleaned)
}

// ── Unified RPC call ────────────────────────────────────────────

async function batchexecute(rpcId, args, sourcePath) {
  // Try content script first (has proper SameSite cookies and page context)
  try {
    return await rpcViaContentScript(rpcId, args, sourcePath)
  } catch (csError) {
    // Fall back to direct fetch from service worker
    try {
      return await rpcDirect(rpcId, args, sourcePath)
    } catch (directError) {
      throw new Error(directError.message)
    }
  }
}

// ── Response parsing ────────────────────────────────────────────

function extractResponse(raw) {
  try {
    const outer = Array.isArray(raw) ? raw : JSON.parse(raw)
    if (!Array.isArray(outer) || !outer[0]) return raw

    // batchexecute has two response formats:
    //
    // 1) wrb.fr (flat): [["wrb.fr","rpcId",response_body,...], ["di",N], ...]
    //    RPC tuple is outer[0]; response body is outer[0][2].
    //
    // 2) Nested (legacy): [[["rpcId","response_body",null,"generic"]]]
    //    RPC tuple is outer[0][0]; response body is outer[0][0][1].
    //
    // Detect by checking if outer[0][0] is a marker string ("wrb.fr") or an array.

    if (Array.isArray(outer[0])) {
      const first = outer[0]
      if (first[0] === 'wrb.fr') {
        // wrb.fr format: ["wrb.fr","rpcId",response_body,null,null,status,"generic"]
        if (first.length >= 3 && first[2] !== null && first[2] !== undefined) {
          const body = first[2]
          if (typeof body === 'string') {
            try { return JSON.parse(body) } catch { return body }
          }
          return body  // already parsed (number/array/object)
        }
        return raw
      }
      if (Array.isArray(first[0])) {
        // Nested format: [[["rpcId","response_body",null,"generic"]]]
        const inner = first[0]
        if (inner.length >= 2 && inner[1]) {
          try { return JSON.parse(inner[1]) } catch { return inner[1] }
        }
      }
    }
    return raw
  } catch {
    return raw
  }
}

// ── Public API ───────────────────────────────────────────────────

export async function listNotebooks() {
  const raw = await batchexecute(RPC.LIST_NOTEBOOKS, [null, 1, null, [2]], '/')
  const data = extractResponse(raw)
  addLog({ type: 'rpc_list_response', error: 'RAW: ' + JSON.stringify(raw).slice(0, 500) })
  addLog({ type: 'rpc_list_response', error: 'EXTRACTED: ' + (data !== raw ? JSON.stringify(data).slice(0, 500) : 'same-as-raw') })
  try {
    if (data && Array.isArray(data) && data.length > 0) {
      // Array of notebook arrays: [title, null, notebookUuid, ...]
      // post-migration: [0]=title, [2]=UUID
      // pre-migration:  [0]=id, [1]=title
      if (Array.isArray(data[0])) {
        return data.map(nb => {
          if (!Array.isArray(nb) || nb.length < 2) return null
          if (typeof nb[2] === 'string' && nb[2].includes('-')) {
            // modern format: [title, null, uuid, ...]
            return { id: nb[2], title: nb[0] || 'Untitled' }
          }
          // legacy format: [id, title, ...]
          return { id: nb[0], title: nb[1] || 'Untitled' }
        }).filter(Boolean)
      }
      // Array of notebook objects: [{projectId, title}, ...]
      if (data[0] && data[0].projectId) {
        return data.map(nb => ({ id: nb.projectId, title: nb.title }))
      }
    }
  } catch {}
  return []
}

export async function createNotebook(title) {
  const templateBlock = [2, null, null, [1, null, null, null, null, null, null, null, null, null, [1]]]
  const args = [title, null, null, templateBlock]
  const raw = await batchexecute(RPC.CREATE_NOTEBOOK, args, '/')
  const data = extractResponse(raw)
  addLog({ type: 'rpc_create_response_raw', summary: JSON.stringify(raw).slice(0, 500) })
  addLog({ type: 'rpc_create_response_extracted', typeof_data: typeof data, data: data !== null && data !== undefined ? JSON.stringify(data).slice(0, 500) : String(data) })
  // Known response formats (verified from wrb.fr on this cohort):
  //   [title, null, notebookUuid, null, null, ...]   ← index 2 = UUID
  //   [title, null, null, null, ..., [sources...]]    ← older format
  //   [{projectId: uuid, title: name}, ...]            ← alternative
  if (Array.isArray(data) && data.length >= 3) {
    if (typeof data[2] === 'string' && data[0] === title) {
      return data[2]  // UUID at index 2
    }
  }
  if (typeof data === 'string') return data
  if (data && data.projectId) return data.projectId
  if (Array.isArray(data) && data.length > 0 && typeof data[0] === 'string') {
    return data[0]  // fallback: return title as-is (better than nothing)
  }
  throw new Error('Could not parse createNotebook response. Check debug log.')
}

// ── Source add helpers ────────────────────────────────────────────

function isWrbRejection(raw) {
  return Array.isArray(raw) && raw[0] && Array.isArray(raw[0]) &&
    raw[0][0] === 'wrb.fr' && raw[0].length >= 6 &&
    Array.isArray(raw[0][5]) && raw[0][5][0] === 3
}

export async function addSource(notebookId, url, title) {
  const sourcePath = '/notebook/' + notebookId

  // Verified format from live web UI capture (2026-07-29):
  // RPC ID izAoDd, 3 outer params:
  //   [0] = source data array with URL at index 7 wrapped in [url]
  //   [1] = notebook UUID
  //   [2] = template block [2,null,[1],[1,null,...,[1,3]]]
  const sourceData = [null, null, null, null, null, null, null, [url], null, null, 1]
  const templateBlock = [2, null, [1], [1, null, null, null, null, null, null, null, null, null, [1, 3]]]
  const args = [[sourceData], notebookId, templateBlock]

  const raw = await batchexecute(RPC.ADD_SOURCE_V1, args, sourcePath)

  // wrb.fr rejection check
  if (isWrbRejection(raw)) {
    addLog({ type: 'rpc_add_rejected', videoId: title.slice(0, 40), raw_summary: JSON.stringify(raw).slice(0, 500) })
    throw new Error('addSource rejected by server (status [3])')
  }

  const result = extractResponse(raw)
  addLog({ type: 'rpc_add_response', videoId: title.slice(0, 40),
    raw_summary: JSON.stringify(raw).slice(0, 500),
    extracted: result !== null && result !== undefined ? JSON.stringify(result).slice(0, 500) : String(result) })

  if (result === null || result === undefined) {
    throw new Error('addSource returned null')
  }

  return true
}

export async function verifyConnection() {
  const notebooks = await listNotebooks()
  return { connected: true, notebookCount: notebooks.length }
}
