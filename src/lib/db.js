import { openDB } from 'idb'

const DB_NAME = 'wocus'
const DB_VERSION = 3

let dbPromise

const DEFAULT_TEMPLATES = [
  {
    id: '_default_meeting',
    name: 'Meeting Notes',
    content: '{"type":"doc","content":[{"type":"heading","attrs":{"level":1},"content":[{"type":"text","text":"Meeting Notes"}]},{"type":"heading","attrs":{"level":2},"content":[{"type":"text","text":"Date"}]},{"type":"paragraph","content":[{"type":"text","text":"[Date]"}]},{"type":"heading","attrs":{"level":2},"content":[{"type":"text","text":"Attendees"}]},{"type":"paragraph","content":[{"type":"text","text":"[List attendees]"}]},{"type":"divider"},{"type":"heading","attrs":{"level":2},"content":[{"type":"text","text":"Agenda"}]},{"type":"bulletList","content":[{"type":"listItem","content":[{"type":"paragraph","content":[{"type":"text","text":"Item 1"}]}]},{"type":"listItem","content":[{"type":"paragraph","content":[{"type":"text","text":"Item 2"}]}]},{"type":"listItem","content":[{"type":"paragraph","content":[{"type":"text","text":"Item 3"}]}]}]},{"type":"divider"},{"type":"heading","attrs":{"level":2},"content":[{"type":"text","text":"Discussion"}]},{"type":"paragraph","content":[{"type":"text","text":"[Key discussion points]"}]},{"type":"divider"},{"type":"heading","attrs":{"level":2},"content":[{"type":"text","text":"Action Items"}]},{"type":"taskList","content":[{"type":"taskItem","attrs":{"checked":false},"content":[{"type":"paragraph","content":[{"type":"text","text":"[Action 1 — assignee]"}]}]},{"type":"taskItem","attrs":{"checked":false},"content":[{"type":"paragraph","content":[{"type":"text","text":"[Action 2 — assignee]"}]}]}]}]}',
    html: '<h1>Meeting Notes</h1><h2>Date</h2><p>[Date]</p><h2>Attendees</h2><p>[List attendees]</p><hr><h2>Agenda</h2><ul><li><p>Item 1</p></li><li><p>Item 2</p></li><li><p>Item 3</p></li></ul><hr><h2>Discussion</h2><p>[Key discussion points]</p><hr><h2>Action Items</h2><ul data-type="taskList"><li><label><input type="checkbox">[Action 1 — assignee]</label></li><li><label><input type="checkbox">[Action 2 — assignee]</label></li></ul>',
    text: 'Meeting Notes\n\nDate\n[Date]\n\nAttendees\n[List attendees]\n\nAgenda\n- Item 1\n- Item 2\n- Item 3\n\nDiscussion\n[Key discussion points]\n\nAction Items\n- [ ] [Action 1 — assignee]\n- [ ] [Action 2 — assignee]',
    createdAt: 0,
    isDefault: true
  },
  {
    id: '_default_weekly',
    name: 'Weekly Review',
    content: '{"type":"doc","content":[{"type":"heading","attrs":{"level":1},"content":[{"type":"text","text":"Weekly Review"}]},{"type":"paragraph","content":[{"type":"text","text":"Week of [date]"}]},{"type":"divider"},{"type":"heading","attrs":{"level":2},"content":[{"type":"text","text":"✅ Accomplished"}]},{"type":"bulletList","content":[{"type":"listItem","content":[{"type":"paragraph","content":[{"type":"text","text":"[Achievement 1]"}]}]},{"type":"listItem","content":[{"type":"paragraph","content":[{"type":"text","text":"[Achievement 2]"}]}]}]},{"type":"divider"},{"type":"heading","attrs":{"level":2},"content":[{"type":"text","text":"📝 Lessons Learned"}]},{"type":"bulletList","content":[{"type":"listItem","content":[{"type":"paragraph","content":[{"type":"text","text":"[Lesson 1]"}]}]}]},{"type":"divider"},{"type":"heading","attrs":{"level":2},"content":[{"type":"text","text":"🎯 Next Week Goals"}]},{"type":"taskList","content":[{"type":"taskItem","attrs":{"checked":false},"content":[{"type":"paragraph","content":[{"type":"text","text":"[Goal 1]"}]}]},{"type":"taskItem","attrs":{"checked":false},"content":[{"type":"paragraph","content":[{"type":"text","text":"[Goal 2]"}]}]}]}]}',
    html: '<h1>Weekly Review</h1><p>Week of [date]</p><hr><h2>✅ Accomplished</h2><ul><li><p>[Achievement 1]</p></li><li><p>[Achievement 2]</p></li></ul><hr><h2>📝 Lessons Learned</h2><ul><li><p>[Lesson 1]</p></li></ul><hr><h2>🎯 Next Week Goals</h2><ul data-type="taskList"><li><label><input type="checkbox">[Goal 1]</label></li><li><label><input type="checkbox">[Goal 2]</label></li></ul>',
    text: 'Weekly Review\nWeek of [date]\n\nAccomplished\n- [Achievement 1]\n- [Achievement 2]\n\nLessons Learned\n- [Lesson 1]\n\nNext Week Goals\n- [ ] [Goal 1]\n- [ ] [Goal 2]',
    createdAt: 1,
    isDefault: true
  },
  {
    id: '_default_project',
    name: 'Project Plan',
    content: '{"type":"doc","content":[{"type":"heading","attrs":{"level":1},"content":[{"type":"text","text":"Project Plan"}]},{"type":"paragraph","content":[{"type":"text","text":"[Project name]"}]},{"type":"divider"},{"type":"heading","attrs":{"level":2},"content":[{"type":"text","text":"Objectives"}]},{"type":"bulletList","content":[{"type":"listItem","content":[{"type":"paragraph","content":[{"type":"text","text":"[Objective 1]"}]}]}]},{"type":"divider"},{"type":"heading","attrs":{"level":2},"content":[{"type":"text","text":"Timeline"}]},{"type":"bulletList","content":[{"type":"listItem","content":[{"type":"paragraph","content":[{"type":"text","text":"Phase 1: [dates]"}]}]},{"type":"listItem","content":[{"type":"paragraph","content":[{"type":"text","text":"Phase 2: [dates]"}]}]}]},{"type":"divider"},{"type":"heading","attrs":{"level":2},"content":[{"type":"text","text":"Tasks"}]},{"type":"taskList","content":[{"type":"taskItem","attrs":{"checked":false},"content":[{"type":"paragraph","content":[{"type":"text","text":"[Task 1]"}]}]},{"type":"taskItem","attrs":{"checked":false},"content":[{"type":"paragraph","content":[{"type":"text","text":"[Task 2]"}]}]}]},{"type":"divider"},{"type":"heading","attrs":{"level":2},"content":[{"type":"text","text":"Notes"}]},{"type":"paragraph","content":[{"type":"text","text":"[Additional notes]"}]}]}',
    html: '<h1>Project Plan</h1><p>[Project name]</p><hr><h2>Objectives</h2><ul><li><p>[Objective 1]</p></li></ul><hr><h2>Timeline</h2><ul><li><p>Phase 1: [dates]</p></li><li><p>Phase 2: [dates]</p></li></ul><hr><h2>Tasks</h2><ul data-type="taskList"><li><label><input type="checkbox">[Task 1]</label></li><li><label><input type="checkbox">[Task 2]</label></li></ul><hr><h2>Notes</h2><p>[Additional notes]</p>',
    text: 'Project Plan\n[Project name]\n\nObjectives\n- [Objective 1]\n\nTimeline\n- Phase 1: [dates]\n- Phase 2: [dates]\n\nTasks\n- [ ] [Task 1]\n- [ ] [Task 2]\n\nNotes\n[Additional notes]',
    createdAt: 2,
    isDefault: true
  },
  {
    id: '_default_journal',
    name: 'Journal Entry',
    content: '{"type":"doc","content":[{"type":"heading","attrs":{"level":1},"content":[{"type":"text","text":"Journal"}]},{"type":"paragraph","content":[{"type":"text","text":"[Date]"}]},{"type":"divider"},{"type":"heading","attrs":{"level":2},"content":[{"type":"text","text":"What happened today?"}]},{"type":"paragraph","content":[{"type":"text","text":"[Write here]"}]},{"type":"divider"},{"type":"heading","attrs":{"level":2},"content":[{"type":"text","text":"How do I feel?"}]},{"type":"paragraph","content":[{"type":"text","text":"[Write here]"}]},{"type":"divider"},{"type":"heading","attrs":{"level":2},"content":[{"type":"text","text":"Gratitude"}]},{"type":"bulletList","content":[{"type":"listItem","content":[{"type":"paragraph","content":[{"type":"text","text":"[Something I\'m grateful for]"}]}]}]},{"type":"divider"},{"type":"heading","attrs":{"level":2},"content":[{"type":"text","text":"Tomorrow\'s intention"}]},{"type":"paragraph","content":[{"type":"text","text":"[What I want to focus on]"}]}]}',
    html: '<h1>Journal</h1><p>[Date]</p><hr><h2>What happened today?</h2><p>[Write here]</p><hr><h2>How do I feel?</h2><p>[Write here]</p><hr><h2>Gratitude</h2><ul><li><p>[Something I\'m grateful for]</p></li></ul><hr><h2>Tomorrow\'s intention</h2><p>[What I want to focus on]</p>',
    text: 'Journal\n[Date]\n\nWhat happened today?\n[Write here]\n\nHow do I feel?\n[Write here]\n\nGratitude\n- [Something I\'m grateful for]\n\nTomorrow\'s intention\n[What I want to focus on]',
    createdAt: 3,
    isDefault: true
  }
]

function seedDefaults(store) {
  for (const t of DEFAULT_TEMPLATES) {
    store.put(t)
  }
}

export function getDb() {
  if (!dbPromise) {
    dbPromise = openDB(DB_NAME, DB_VERSION, {
      upgrade(db, oldVersion, newVersion, transaction) {
        if (!db.objectStoreNames.contains('notes')) {
          const store = db.createObjectStore('notes', { keyPath: 'id', autoIncrement: true })
          store.createIndex('updatedAt', 'updatedAt')
        }
        if (!db.objectStoreNames.contains('settings')) {
          db.createObjectStore('settings', { keyPath: 'key' })
        }
        if (!db.objectStoreNames.contains('templates')) {
          const store = db.createObjectStore('templates', { keyPath: 'id' })
          seedDefaults(store)
        } else if (oldVersion < 3) {
          const tx = transaction.objectStore('templates')
          seedDefaults(tx)
        }
      }
    })
  }
  return dbPromise
}

export async function ensureNote() {
  const db = await getDb()
  const tx = db.transaction('notes', 'readwrite')
  const store = tx.objectStore('notes')
  let note = await store.get(1)
  if (!note) {
    note = {
      id: 1,
      content: '',
      title: 'Untitled',
      createdAt: Date.now(),
      updatedAt: Date.now()
    }
    await store.put(note)
  }
  return note
}

export async function saveNote(data) {
  const db = await getDb()
  const note = {
    id: 1,
    content: typeof data.content === 'string' ? data.content : '',
    html: typeof data.html === 'string' ? data.html : '',
    text: typeof data.text === 'string' ? data.text : '',
    title: data.title || 'Untitled',
    createdAt: data.createdAt || Date.now(),
    updatedAt: Date.now()
  }
  await db.put('notes', note)
}

export async function getSetting(key) {
  const db = await getDb()
  const entry = await db.get('settings', key)
  return entry ? entry.value : null
}

export async function setSetting(key, value) {
  const db = await getDb()
  await db.put('settings', { key, value })
}