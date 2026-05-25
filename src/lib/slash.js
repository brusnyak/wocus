import { Extension } from '@tiptap/core'
import { Plugin, PluginKey } from '@tiptap/pm/state'

const blocks = [
  { id: 'h1', label: 'Heading 1', icon: 'H1' },
  { id: 'h2', label: 'Heading 2', icon: 'H2' },
  { id: 'h3', label: 'Heading 3', icon: 'H3' },
  { id: 'toggle', label: 'Toggle', icon: '▶' },
  { id: 'page', label: 'Page', icon: '📄' },
  { id: 'todo', label: 'To-Do List', icon: '☐' },
  { id: 'bullet', label: 'Bullet List', icon: '•' },
  { id: 'number', label: 'Numbered List', icon: '1.' },
  { id: 'calendar', label: 'Calendar / Date', icon: '📅' },
  { id: 'divider', label: 'Divider', icon: '—' },
  { id: 'code', label: 'Code Block', icon: '<>' },
]

let menu = null
let selectedIndex = 0
let filterText = ''

function exec(id, editor) {
  switch (id) {
    case 'h1': editor.commands.toggleHeading({ level: 1 }); break
    case 'h2': editor.commands.toggleHeading({ level: 2 }); break
    case 'h3': editor.commands.toggleHeading({ level: 3 }); break
    case 'page':
      window.dispatchEvent(new CustomEvent('wocus-create-page'))
      hideMenu(); return
    case 'toggle':
      editor.commands.insertContent({
        type: 'details',
        content: [
          { type: 'detailsSummary', content: [{ type: 'text', text: 'Toggle' }] },
          { type: 'detailsContent', content: [{ type: 'paragraph' }] }
        ]
      })
      break
    case 'todo': editor.commands.toggleTaskList(); break
    case 'bullet': editor.commands.toggleBulletList(); break
    case 'number': editor.commands.toggleOrderedList(); break
    case 'calendar':
      const now = new Date()
      const dateStr = now.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' })
      editor.commands.insertContent(dateStr)
      break
    case 'divider': editor.commands.setHorizontalRule(); break
    case 'code': editor.commands.toggleCodeBlock(); break
  }
  hideMenu()
}

function getFiltered() {
  if (!filterText) return blocks
  const q = filterText.toLowerCase()
  return blocks.filter(b => b.label.toLowerCase().includes(q) || b.id.toLowerCase().includes(q))
}

function render(editor) {
  if (!menu) return
  const items = getFiltered()
  if (selectedIndex >= items.length) selectedIndex = 0
  if (selectedIndex < 0) selectedIndex = items.length - 1
  menu.innerHTML = ''
  items.forEach((b, i) => {
    const btn = document.createElement('button')
    btn.className = 'slash-item'
    if (i === selectedIndex) btn.classList.add('slash-selected')
    btn.innerHTML = `<span style="width:22px;text-align:center;font-size:12px;opacity:0.6">${b.icon}</span><span>${b.label}</span>`
    btn.onmouseenter = () => { selectedIndex = i; render(editor) }
    btn.onclick = () => exec(b.id, editor)
    menu.appendChild(btn)
  })
}

function showMenu(x, y, editor) {
  hideMenu()
  selectedIndex = 0
  filterText = ''
  menu = document.createElement('div')
  menu.id = 'slash-menu'
  menu.style.cssText = `position:fixed;left:${x}px;top:${y + 4}px;z-index:100;background:var(--surface);border:1px solid var(--border);border-radius:8px;box-shadow:0 4px 20px rgba(0,0,0,0.12);padding:4px;min-width:200px;font-family:system-ui,sans-serif;font-size:13px;`
  render(editor)
  document.body.appendChild(menu)
}

function hideMenu() {
  if (menu) { menu.remove(); menu = null }
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
        handleKeyDown(view, event) {
          if (menu) {
            const items = getFiltered()

            if (event.key === 'Escape') { hideMenu(); return true }
            if (event.key === 'ArrowDown') { event.preventDefault(); selectedIndex = (selectedIndex + 1) % items.length; render(editor); return true }
            if (event.key === 'ArrowUp') { event.preventDefault(); selectedIndex = (selectedIndex - 1 + items.length) % items.length; render(editor); return true }
            if (event.key === 'Enter' || event.key === 'Tab') {
              event.preventDefault()
              const item = items[selectedIndex]
              if (item) exec(item.id, editor)
              return true
            }
            if (event.key === 'Backspace') { hideMenu(); return false }

            if (event.key.length === 1 && !event.ctrlKey && !event.metaKey && !event.altKey) {
              filterText += event.key
              selectedIndex = 0
              render(editor)
              if (getFiltered().length === 0) hideMenu()
              return true
            }

            return false
          }

          if (event.key === '/' && !event.ctrlKey && !event.metaKey) {
            const { selection } = view.state
            const { empty, $from } = selection
            if (empty && $from.parent.textContent.length === 0) {
              const coords = view.coordsAtPos($from.pos)
              showMenu(coords.left, coords.bottom, editor)
              return true
            }
          }

          return false
        }
      }
    })]
  }
})
