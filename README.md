# Wocus

**Infinite Local Notes. AI-Organized on Demand.**

Wocus is a minimal, private, local-first note-taking app with a unique "Dual-View" AI organization feature. All data stays in your browser (IndexedDB) — no servers, no accounts, no tracking.

Live at [wocus.vercel.app](https://wocus.vercel.app)

## Features

### Zen Interface
- Infinite vertical scroll, distraction-free
- No login, no signup — just type
- Auto-saves to IndexedDB on every keystroke
- Works 100% offline after first visit (Service Worker)

### Editor with Slash Commands (`/`)
- `/h1`, `/h2`, `/h3` — Headers
- `/div` or `/divider` — Horizontal rule
- `/toggle` — Collapsible section
- `/todo` — Checkbox list
- `/bullet`, `/number` — Lists
- `/code` — Code block

### Dual-View AI Organization
- **Raw View** — your original input, preserved exactly as written
- **Organized View** — AI-structured version with headers, toggles, and dividers
- Toggle instantly between both views — no data loss
- Sidebar navigation auto-generated from organized content headers

### AI Configuration (BYO API Key)
- Bring your own API key for any OpenAI-compatible endpoint:
  - OpenRouter, OpenAI, Anthropic, Together AI, etc.
  - Local models via Ollama (`http://localhost:11434`)
- Key stored in localStorage only — never sent anywhere but your configured API endpoint

### Themes & Display
- Light / Dark / Solarized themes
- Monospace / Serif / Sans-serif fonts
- Fullscreen mode
- Download as `.txt` or Print

### Keyboard Shortcuts
| Action | Shortcut |
|--------|----------|
| Organize with AI | `⌘⇧O` / `Ctrl+Shift+O` |
| Toggle Raw / Organized | `⌘⇧V` / `Ctrl+Shift+V` |
| Cycle theme | `⌘⇧E` / `Ctrl+Shift+E` |
| Cycle font | `⌘⇧A` / `Ctrl+Shift+A` |
| Fullscreen | `⌘⇧F` / `Ctrl+Shift+F` |
| Download | `⌘S` / `Ctrl+S` |
| Print | `⌘P` / `Ctrl+P` |

## Tech Stack

- **Framework:** Svelte 5 + Vite
- **Editor:** TipTap (headless ProseMirror-based)
- **Storage:** IndexedDB via `idb`
- **AI:** Native `fetch` API — direct client-side calls, no backend proxy
- **Offline:** Service Worker (cache-first for app shell)
- **Icons:** Font Awesome 6 (CDN)
- **Deployment:** Vercel (static SPA)

## Getting Started

```bash
npm install
npm run dev
```

Opens at `http://localhost:5173`.

### Build for production

```bash
npm run build
npm run preview
```

## AI Setup

1. Click the gear icon (⚙️) or open **Settings**
2. Enter your **API Endpoint** (default: OpenRouter)
3. Enter your **API Key**
4. Choose your **Model** (default: `mistral-large`)
5. Click **Test Connection** to verify
6. Write text in Raw view, then click the organize button (🗂️) or press `⌘⇧O`

### Recommended providers

- **[OpenRouter](https://openrouter.ai)** — one API key for many models
- **Ollama** — run models locally at `http://localhost:11434/api/generate`
- **OpenAI** — `https://api.openai.com/v1/chat/completions`

## Deployment

```bash
npm run build
npx vercel --prod
```

The app is a static SPA — deployable to Vercel, Netlify, Cloudflare Pages, or any static host.

## Architecture

```
src/
├── App.svelte            — Main shell: state management, view switching, keyboard shortcuts
├── app.css               — Theme variables, global styles
├── main.js               — Entry point, mounts Svelte app + registers Service Worker
├── lib/
│   ├── Editor.svelte     — TipTap editor wrapper component
│   ├── slash.js          — Slash command plugin (ProseMirror Extension)
│   ├── ai.js             — AI fetch logic + JSON extraction
│   ├── db.js             — IndexedDB operations (notes + settings stores)
│   ├── settings.svelte.js— Reactive settings store (Svelte 5 runes)
│   ├── SettingsModal.svelte — API key/endpoint configuration modal
│   ├── Sidebar.svelte    — Auto-generated navigation from headings
│   ├── HelpModal.svelte  — Keyboard shortcuts reference
│   └── AboutModal.svelte — About info
public/
└── sw.js                 — Service Worker for offline caching
```

## Security & Privacy

Wocus is designed to be **fully private by default**:

- **All data is local** — notes are stored in IndexedDB (your browser's local database). Nothing is sent to any server unless you explicitly trigger the AI Organize feature.
- **No accounts, no tracking** — no signup, no cookies, no analytics, no telemetry. The Service Worker only caches the app shell for offline use, never your data.
- **API key stays in localStorage** — your key is only sent to the API endpoint you configure. It is never transmitted anywhere else, and Wocus has no backend to intercept it.
- **AI data flow** — when you click "Organize," your raw text is sent directly from your browser to your configured API endpoint (OpenRouter, OpenAI, etc.). Wocus itself never sees your data.
- **100% offline after first visit** — the Service Worker caches the app so it works without internet. Your notes remain editable and searchable offline.

## License

MIT
