import { Node } from '@tiptap/core'

export const DetailsSummary = Node.create({
  name: 'detailsSummary',
  group: 'block',
  content: 'inline*',
  parseHTML() { return [{ tag: 'summary' }] },
  renderHTML() {
    return ['summary', 0]
  },
})

export const DetailsContent = Node.create({
  name: 'detailsContent',
  group: 'block',
  content: 'block+',
  parseHTML() { return [{ tag: 'div[class="details-content"]' }] },
  renderHTML() {
    return ['div', { class: 'details-content' }, 0]
  },
})

export const Details = Node.create({
  name: 'details',
  group: 'block',
  content: 'detailsSummary detailsContent',
  parseHTML() { return [{ tag: 'details' }] },
  renderHTML({ HTMLAttributes }) {
    return ['details', { ...HTMLAttributes, 'data-toggle': '' }, 0]
  },
  addAttributes() {
    return {
      open: { default: false, parseHTML: el => el.hasAttribute('open'), renderHTML: attrs => attrs.open ? { open: '' } : {} }
    }
  }
})
