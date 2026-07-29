# Sourcus

Auto-collect YouTube tabs and send them as sources to NotebookLM.

## How It Works

1. **Watcher** — The extension watches all open tabs for YouTube video pages.
2. **Thresholds** — When a tab has been open for >X minutes OR more than N YouTube tabs are open, collection triggers.
3. **Collect** — Video titles, URLs, and IDs are gathered from eligible tabs.
4. **Send** — Each video is added as a source to your NotebookLM notebook.
5. **Digest** — NotebookLM processes each video (transcript + summarization + Q&A).

No transcript API. No LLM key needed. Just the tab watcher + NotebookLM batch injector.

## Defaults

- Tab age threshold: 5 minutes
- Tab count threshold: 5 tabs
- Target: Create a new notebook named "Sourcus - YouTube Digest"

## Installation (Development)

1. Open `chrome://extensions/`
2. Enable **Developer mode**
3. Click **Load unpacked**
4. Select the `sourcus/` directory

## Configuration

Open the extension popup and click **Settings**, or right-click the extension icon and select **Options**.

- **Thresholds**: Adjust tab age and count triggers
- **Target**: Use existing notebook or auto-create new ones
- **Connection**: Verify your NotebookLM session is working

## Permissions

- `tabs` — Read tab URLs to detect YouTube pages
- `storage` — Save settings and collected video queue
- `alarms` — Periodic threshold checks
- `notebooklm.google.com` — Add sources to your notebooks
- `youtube.com` — Detect and read YouTube video pages
