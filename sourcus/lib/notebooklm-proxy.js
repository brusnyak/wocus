/*
 * Content script injected into notebooklm.google.com.
 * Executes batchexecute RPCs using the page's session cookies.
 * Required because MV3 service workers can't send SameSite cookies cross-origin.
 *
 * Path and RPC IDs synced from notebooklm-py (github.com/teng-lin/notebooklm-py).
 */

const BATCHEXECUTE_PATH = '/_/LabsTailwindUi/data/batchexecute'

chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  if (msg.source !== 'sourcus') return false

  if (msg.action === 'ping') {
    sendResponse({ ok: true })
    return false
  }

  if (msg.action === 'rpc') {
    executeRPC(msg.rpcId, msg.args, msg.sourcePath)
      .then(result => sendResponse({ ok: true, data: result }))
      .catch(err => sendResponse({ ok: false, error: err.message }))
    return true
  }

  return false
})

async function executeRPC(rpcId, args, sourcePath) {
  const payload = [[[rpcId, JSON.stringify(args), null, 'generic']]]
  const params = new URLSearchParams()
  params.set('f.req', JSON.stringify(payload))

  // Extract SNlM0e (CSRF token) from the page
  const atMatch = document.documentElement.innerHTML.match(/"SNlM0e":"([^"]+)"/)
  const at = atMatch ? atMatch[1] : ''

  // CRITICAL: Use absolute URL with window.location.origin, not relative path.
  // In Chrome content scripts, fetch() resolves relative URLs against the
  // extension's origin (chrome-extension://<id>) instead of the page's origin.
  const fullUrl = window.location.origin + BATCHEXECUTE_PATH
  // Use explicit sourcePath from caller, fall back to current page path
  const sp = sourcePath || window.location.pathname
  const url = fullUrl + '?rpcids=' + encodeURIComponent(rpcId) + '&source-path=' + encodeURIComponent(sp)

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
  // Strip anti-XSSI prefix `)]}'`
  let cleaned = text.replace(/^\)\]\}'\n?/, '').trim()
  // Some batchexecute endpoints include a byte-length line between XSSI prefix and JSON
  cleaned = cleaned.replace(/^\d+\n/, '').trim()
  if (!cleaned) {
    throw new Error('Empty NotebookLM RPC response (session may have expired)')
  }

  return JSON.parse(cleaned)
}
