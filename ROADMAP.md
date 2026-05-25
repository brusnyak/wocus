# Wocus Roadmap

Wocus is a minimal, local-first, privacy-focused AI note-taking app.
No accounts, no servers, no data leaving your machine (except what you explicitly send to your chosen AI provider).

---

## Design Principles

1. **Local-first** — everything runs in your browser, data stays in IndexedDB
2. **No accounts** — no sign-up, no login, no email
3. **Privacy by default** — all AI features are opt-in and clearly labeled
4. **Offline capable** — works without internet (AI features naturally require connectivity)
5. **Simple but powerful** — single note, zero friction
6. **Keyboard-first** — every action has a shortcut

---

## ✅ Done

- Markdown import/export
- Template system (save/load/delete templates, stored locally in IndexedDB)
- AI link context analysis (toggle in Settings for privacy)
- Fixed icon layout (top-right toolbar, bottom-right help/about, bottom-left word count)
- Markdown source view toggle (edit raw markdown)
- AI Chat panel (draggable, with /organize and /summarize commands)
- Settings tabs (Connection + Templates gallery)
- Default templates (Meeting Notes, Weekly Review, Project Plan, Journal Entry)
- Search fix: typing in search no longer hides the UI
- Typing sound with real typewriter recording (juskiddink, CC BY 4.0) using librosa-detected cue points
- Sensitive data detection in AI sends (API keys, tokens, etc.)
- Kanban board from task items
- Smart Links component (related note sections)
- Voice input via Web Speech API

---

## 🥇 Phase 1 — Polish & Fixes (Small, High Impact)

### 1. Typing Sound — Refine audio analysis
**Problem:** current librosa onset detection picks up mechanical noise transients, not just clean key clicks. 60ms segments cut off the sound. Random pitch variation + random cue selection creates disjointed artifacts.
**Solution:** Re-analyze with higher threshold. Extract only the loudest, cleanest clicks. Use longer segments (~100ms). Remove pitch variation. Consider hand-picking 5-10 pristine clicks instead of 191 noisy ones.

### 2. Voice Input — Keepalive & stability
**Problem:** Chrome kills SpeechRecognition after ~20s of silence. The `onend` callback sets `listening = false` with no auto-restart.
**Solution:** Restart recognition in `onend` unless user explicitly stopped. Add a periodic silent keepalive ping. Improve error recovery.

### 3. Kanban Tasks — Add In-Progress state
**Problem:** The data model only has `checked: bool`. There's no distinction between "in progress" and "done" — `inProgressItems` is always empty (was derived from a flawed slice).
**Solution:** Add proper `status` field (`todo | in-progress | done`) to TipTap task item attrs. Update Kanban grid to read the new field. Keep backward compat with existing `checked` items.

### 4. Chat Draggable — Collapsed bubble too
**Problem:** Drag is only on the card header (open state). The collapsed toggle bubble is fixed at bottom-right.
**Solution:** Add `onmousedown` to the toggle button with same drag logic. Store position in localStorage so it persists.

---

## 🥈 Phase 2 — Multi-Note Architecture (Medium)

### 5. Multi-Noted Sidebar
**Problem:** Currently hardcoded to a single note (`id: 1` in db.js).
**Solution:**
- Migrate DB schema: remove `id: 1` assumption, switch to auto-increment notes store
- Create sidebar component (left panel) listing all notes with title + preview
- Add create/rename/delete note operations
- Note pagination and search within sidebar
- Preserve existing single note as first note after migration
- Toggle sidebar via hamburger button (like Cadennce)
- Collapsed state for focus writing

### 6. `/page` Command — Notion-like inline pages
**Problem:** No way to create sub-pages from within the editor.
**Solution:**
- New slash command `/page` creates an inline toggle widget in the main note
- Opening the toggle navigates into a full new note (loaded in the main editor)
- Back arrow at top-left returns to the parent note
- Page is stored as a separate note in IndexedDB, linked by parent ID
- AI can generate page content with `/organize` or dedicated agent command

---

## 🥉 Phase 3 — AI Agents & Advanced (Large)

### 7. AI Agents
**Problem:** AI only responds in chat. No autonomous actions.
**Solution:**
- Agent mode where AI can return structured commands the frontend executes
- Commands: `create-note`, `add-task`, `search-notes`, `summarize-note`, `move-task`
- Agent has read access to all notes for context-aware operations
- Visualize Kanban tasks as live board that agent can modify
- Similar to opencode agents but inside the app

### 8. Deep Research Pages
**Problem:** No way for AI to generate comprehensive structured content.
**Solution:**
- AI creates full multi-section notes with `/research <topic>` command
- Generates headings, sub-headings, toggles, task lists automatically
- Created as a separate note linked from the main page
- Can be reviewed, edited, or used as reference by the agent

---

## 📋 Backlog

### Quality of Life
- Pre-installed starter templates (done — meeting notes, journal, project planning)
- Template categories / search in load dialog
- Keyboard shortcut cheat sheet (accessible via `?`)
- Auto-tag notes based on content

### AI Improvements
- Context-aware summarization — per-section or full-note summaries
- Smart linking between related notes (local graph, no external service)

### Stretch
- Plugin system for community extensions (sandboxed)
- Custom CSS / themes — user-defined color schemes and fonts
- On-device AI models (WebGPU / ONNX runtime)
- Local embedding search for semantic note retrieval
