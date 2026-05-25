import TaskItem from '@tiptap/extension-task-item'

export const KanbanTaskItem = TaskItem.extend({
  addAttributes() {
    return {
      checked: {
        default: false,
        parseHTML: el => el.getAttribute('data-checked') === 'true',
        renderHTML: attrs => ({ 'data-checked': !!attrs.checked }),
      },
      status: {
        default: 'todo',
        parseHTML: el => el.getAttribute('data-status') || 'todo',
        renderHTML: attrs => attrs.status ? { 'data-status': attrs.status } : {},
      },
    }
  },
})
