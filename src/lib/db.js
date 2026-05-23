import { openDB } from 'idb'

const DB_NAME = 'wocus'
const DB_VERSION = 1

let dbPromise

export function getDb() {
  if (!dbPromise) {
    dbPromise = openDB(DB_NAME, DB_VERSION, {
      upgrade(db) {
        if (!db.objectStoreNames.contains('notes')) {
          const store = db.createObjectStore('notes', { keyPath: 'id', autoIncrement: true })
          store.createIndex('updatedAt', 'updatedAt')
        }
        if (!db.objectStoreNames.contains('settings')) {
          db.createObjectStore('settings', { keyPath: 'key' })
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
      rawContent: '',
      organizedContent: '',
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
    rawContent: typeof data.rawContent === 'string' ? data.rawContent : '',
    organizedContent: typeof data.organizedContent === 'string' ? data.organizedContent : '',
    rawHtml: typeof data.rawHtml === 'string' ? data.rawHtml : '',
    organizedHtml: typeof data.organizedHtml === 'string' ? data.organizedHtml : '',
    rawText: typeof data.rawText === 'string' ? data.rawText : '',
    organizedText: typeof data.organizedText === 'string' ? data.organizedText : '',
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
