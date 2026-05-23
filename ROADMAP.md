# Wocus Roadmap

Wocus is a minimal, local-first, privacy-focused AI note-taking app.  
No accounts, no servers, no data leaving your machine (except what you explicitly send to your chosen AI provider).

---

## ✅ Recently Shipped

- Markdown import/export
- Template system (save/load/delete templates, stored locally in IndexedDB)
- AI link context analysis (toggle in Settings for privacy)
- Fixed icon layout (top-right toolbar, bottom-right help/about, bottom-left word count)

---

## 🔜 Next Up (High Impact, Low Effort)

### Template Enhancements
- Pre-installed starter templates (meeting notes, journal, project planning)
- Template categories / search in load dialog

### Mobile Optimization
- Responsive layout for phones and tablets
- Touch-friendly toolbar (larger tap targets, bottom sheet menus)
- PWA install prompt improvements

### Search Improvements
- Fuzzy / substring matching (currently exact match only)
- Match highlighting in the editor
- Search-and-replace

### Quick Actions
- `/todo` slash command creates a task list
- `/calendar` slash command inserts a date picker / calendar view
- Keyboard shortcut cheat sheet (accessible via `?`)

---

## 📋 Medium Term

### Organization & Productivity
- **Kanban board view** for todo items extracted from notes
- **Calendar view** showing notes grouped by date (/calendar slash command)
- **Daily / weekly review templates** with auto-populated prompts
- **Pomodoro timer** integration (simple overlay)

### AI Improvements
- **AI-powered tagging/suggestions** — auto-tag notes based on content
- **Context-aware summarization** — per-section or full-note summaries
- **Smart linking** between related notes (local graph, no external service)
- **Audio transcription** improvement with speaker detection

### Knowledge Assistant
- **Proactive suggestions** based on note content (e.g., "You mentioned X yesterday — want to follow up?")
- **"Talk to your notes"** — conversational interface over your local note store
- **Research assistant** — paste a URL, get a structured summary
- **Spaced repetition** for learning notes (flashcard mode)

---

## 🚀 Longer Term / Stretch Goals

### Customization & Extensibility
- **Plugin system** for community extensions (sandboxed)
- **Custom CSS / themes** — user-defined color schemes and fonts
- **API for third-party integrations** — read/write notes programmatically
- **Scriptable automations** — user-defined triggers (e.g., "auto-organize every day at 5pm")

### Context Awareness
- **Time-based note organization** (auto-group by creation/modification time)
- **Location-aware notes** (when permitted by user, stored locally)
- **Activity-based suggestions** (detect focus/mode from system)
- **Integration with system focus modes** (e.g., macOS Focus, Windows Focus Assist)

### Advanced AI
- On-device AI models (WebGPU / ONNX runtime) for zero-server-operation features
- Local embedding search for semantic note retrieval
- AI-generated note relationships and knowledge graph visualization

---

## Design Principles

1. **Local-first** — everything runs in your browser, data stays in IndexedDB
2. **No accounts** — no sign-up, no login, no email
3. **Privacy by default** — all AI features are opt-in and clearly labeled
4. **Offline capable** — works without internet (AI features naturally require connectivity)
5. **Simple but powerful** — one file, one note, zero friction
6. **Keyboard-first** — every action has a shortcut