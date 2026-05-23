import { Node } from '@tiptap/core'

export const DetailsSummary = Node.create({
  name: 'detailsSummary',
  group: 'block',
  content: 'inline*',
  parseHTML() { return [{ tag: 'summary' }] },
  renderHTML({ HTMLAttributes }) {
    return ['summary', HTMLAttributes, 0]
  },
  addAttributes() {
    return { class: { default: null } }
  }
})

export const DetailsContent = Node.create({
  name: 'detailsContent',
  group: 'block',
  content: 'block+',
  parseHTML() { return [{ tag: 'div[class="details-content"]' }] },
  renderHTML({ HTMLAttributes }) {
    return ['div', { class: 'details-content' }, 0]
  },
  addAttributes() {
    return { class: { default: 'details-content' } }
  }
})

export const Details = Node.create({
  name: 'details',
  group: 'block',
  content: 'detailsSummary detailsContent',
  parseHTML() { return [{ tag: 'details' }] },
  renderHTML({ HTMLAttributes }) {
    return ['details', HTMLAttributes, 0]
  },
  addAttributes() {
    return { class: { default: null } }
  }
})
