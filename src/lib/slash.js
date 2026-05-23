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

function applyBlock(id, editor, pos) {
  const chain = editor.chain().focus()
  switch (id) {
    case 'h1': chain.toggleHeading({ level: 1 }); break
    case 'h2': chain.toggleHeading({ level: 2 }); break
    case 'h3': chain.toggleHeading({ level: 3 }); break
    case 'toggle': chain.toggleWrap('details'); break
    case 'todo': chain.toggleTaskList(); break
    case 'bullet': chain.toggleBulletList(); break
    case 'number': chain.toggleOrderedList(); break
    case 'divider': chain.setHorizontalRule(); break
    case 'code': chain.toggleCodeBlock(); break
  }
  chain.run()
  if (pos !== undefined) {
    editor.chain().focus().deleteRange({ from: pos - 1, to: pos }).run()
  }
  hideMenu()
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
    btn.onclick = () => applyBlock(b.id, editor, activePos)
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
}

function hideMenu() {
  if (menu) { menu.remove(); menu = null }
  activePos = null
  filterText = ''
  selectedIndex = 0
}

function getSlashText(view) {
  const { selection } = view.state
  const { $from } = selection
  const lineText = $from.parent.textContent
  if (lineText.startsWith('/')) return lineText.slice(1)
  return ''
}

export default Extension.create({
  name: 'slash',

  addKeyboardShortcuts() {
    return { Escape: () => { hideMenu(); return false } }
  },

  addProseMirrorPlugins() {
    const editor = this.editor
    return [new Plugin({
      key: new PluginKey('slash'),
      props: {
        handleKeyDown(view, event) {
          if (!menu) {
            if (event.key === '/') {
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
          }

          if (event.key === 'Escape') { hideMenu(); return true }
          if (event.key === 'Backspace') {
            const text = getSlashText(view)
            if (text === '') { hideMenu(); return false }
            filterText = text.length > 0 ? text : ''
            renderMenu(editor)
            if (getFilteredBlocks().length === 0) hideMenu()
            return false
          }

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
            if (item) applyBlock(item.id, editor, activePos)
            return true
          }

          if (event.key.length === 1 && !event.ctrlKey && !event.metaKey && !event.altKey) {
            filterText += event.key
            selectedIndex = 0
            renderMenu(editor)
            const f = getFilteredBlocks()
            if (f.length === 0) hideMenu()
            return true
          }

          return false
        }
      }
    })]
  }
})
