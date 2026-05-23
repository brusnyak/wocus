import { Extension } from '@tiptap/core'
import { Plugin, PluginKey } from '@tiptap/pm/state'

const blocks = [
  { id: 'h1', label: 'Heading 1', icon: 'H1' },
  { id: 'h2', label: 'Heading 2', icon: 'H2' },
  { id: 'h3', label: 'Heading 3', icon: 'H3' },
  { id: 'toggle', label: 'Toggle', icon: '▶' },
  { id: 'todo', label: 'To-Do List', icon: '☐' },
  { id: 'bullet', label: 'Bullet List', icon: '•' },
  { id: 'number', label: 'Numbered List', icon: '1.' },
  { id: 'divider', label: 'Divider', icon: '—' },
  { id: 'code', label: 'Code Block', icon: '<>' },
]

let menu = null
let selectedIndex = 0
let filterText = ''
let activePos = null

function applyBlock(id, editor) {
  hideMenu()
  const chain = editor.chain().focus()
  switch (id) {
    case 'h1': chain.toggleHeading({ level: 1 }).run(); break
    case 'h2': chain.toggleHeading({ level: 2 }).run(); break
    case 'h3': chain.toggleHeading({ level: 3 }).run(); break
    case 'toggle':
      chain.insertContent({
        type: 'details',
        content: [
          { type: 'detailsSummary', content: [{ type: 'text', text: 'Toggle' }] },
          { type: 'detailsContent', content: [{ type: 'paragraph' }] }
        ]
      }).run()
      break
    case 'todo': chain.toggleTaskList().run(); break
    case 'bullet': chain.toggleBulletList().run(); break
    case 'number': chain.toggleOrderedList().run(); break
    case 'divider': chain.setHorizontalRule().run(); break
    case 'code': chain.toggleCodeBlock().run(); break
  }
}

function getFilteredBlocks() {
  if (!filterText) return blocks
  const q = filterText.toLowerCase()
  return blocks.filter(b => b.label.toLowerCase().includes(q) || b.id.toLowerCase().includes(q))
}

function renderMenu(editor) {
  if (!menu) return
  const filtered = getFilteredBlocks()
  if (selectedIndex >= filtered.length) selectedIndex = 0
  if (selectedIndex < 0) selectedIndex = filtered.length - 1

  menu.innerHTML = ''
  filtered.forEach((b, i) => {
    const btn = document.createElement('button')
    btn.className = 'slash-item'
    if (i === selectedIndex) btn.classList.add('slash-selected')
    btn.innerHTML = `<span class="slash-icon">${b.icon}</span><span>${b.label}</span>`
    btn.onmouseenter = () => { selectedIndex = i; renderMenu(editor) }
    btn.onclick = () => applyBlock(b.id, editor)
    menu.appendChild(btn)
  })
}

function showMenu(x, y, editor, pos) {
  hideMenu()
  activePos = pos
  selectedIndex = 0
  filterText = ''
  menu = document.createElement('div')
  menu.id = 'slash-menu'
  menu.style.cssText = `position:fixed;left:${x}px;top:${y + 4}px;z-index:100;background:var(--surface);border:1px solid var(--border);border-radius:8px;box-shadow:0 4px 20px rgba(0,0,0,0.12);padding:4px;min-width:200px;font-family:system-ui,sans-serif;font-size:13px;`
  renderMenu(editor)

  document.body.appendChild(menu)

  setTimeout(() => {
    const closer = (e) => {
      if (menu && !menu.contains(e.target)) {
        hideMenu()
        document.removeEventListener('mousedown', closer)
      }
    }
    document.addEventListener('mousedown', closer)
  }, 0)
}

function hideMenu() {
  if (menu) { menu.remove(); menu = null }
  activePos = null
  filterText = ''
  selectedIndex = 0
}

export default Extension.create({
  name: 'slash',

  addKeyboardShortcuts() {
    return { Escape: () => { hideMenu(); return false } }
  },

  onSelectionUpdate() { if (menu) hideMenu() },

  addProseMirrorPlugins() {
    const editor = this.editor
    return [new Plugin({
      key: new PluginKey('slash'),
      props: {
        handleTextInput(view, from, to, text) {
          if (text === '/' && !menu) {
            const { selection } = view.state
            const { empty, $from } = selection
            if (!empty) return false
            if ($from.parent.textContent.length === 0) {
              const coords = view.coordsAtPos($from.pos)
              showMenu(coords.left, coords.bottom, editor, $from.pos)
              return true
            }
          }
          return false
        },

        handleKeyDown(view, event) {
          if (!menu) return false

          if (event.key === 'Escape') { hideMenu(); return true }

          const filtered = getFilteredBlocks()

          if (event.key === 'ArrowDown') {
            event.preventDefault()
            selectedIndex = (selectedIndex + 1) % filtered.length
            renderMenu(editor)
            return true
          }
          if (event.key === 'ArrowUp') {
            event.preventDefault()
            selectedIndex = (selectedIndex - 1 + filtered.length) % filtered.length
            renderMenu(editor)
            return true
          }
          if (event.key === 'Enter' || event.key === 'Tab') {
            event.preventDefault()
            const item = filtered[selectedIndex]
            if (item) applyBlock(item.id, editor)
            return true
          }
          if (event.key === 'Backspace') {
            hideMenu()
            return false
          }

          if (event.key.length === 1 && !event.ctrlKey && !event.metaKey && !event.altKey) {
            filterText += event.key
            selectedIndex = 0
            renderMenu(editor)
            if (getFilteredBlocks().length === 0) hideMenu()
            return true
          }

          return false
        }
      }
    })]
  }
})
