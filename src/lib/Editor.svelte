<script>
  import { onMount } from 'svelte'
  import { Editor } from '@tiptap/core'
  import StarterKit from '@tiptap/starter-kit'
  import Placeholder from '@tiptap/extension-placeholder'
  import TaskList from '@tiptap/extension-task-list'
  import TaskItem from '@tiptap/extension-task-item'
  import { Details, DetailsContent, DetailsSummary } from './toggle.js'
  import SlashCommandExtension from './slash.js'

  let { onUpdate, onReady } = $props()

  let el
  let editor

  onMount(() => {
    const tipTap = new Editor({
      element: el,
      content: '',
      extensions: [
        StarterKit.configure({
          heading: { levels: [1, 2, 3] },
        }),
        Placeholder.configure({
          placeholder: 'Type / for blocks, or just start writing...'
        }),
        TaskList,
        TaskItem.configure({ nested: true }),
        Details,
        DetailsContent,
        DetailsSummary,
        SlashCommandExtension,
      ],
      onUpdate: ({ editor: ed }) => {
        onUpdate?.({
          html: ed.getHTML(),
          json: ed.getJSON(),
          text: ed.getText()
        })
      }
    })

    onReady?.({
      getText: () => tipTap.getText(),
      getHTML: () => tipTap.getHTML(),
      getJSON: () => tipTap.getJSON(),
      setContent: (c) => tipTap.commands.setContent(c, false),
      focus: () => tipTap.commands.focus(),
      getEditor: () => tipTap
    })

    return () => tipTap.destroy()
  })
</script>

<div bind:this={el} class="editor"></div>

<style>
  .editor { min-height: 60vh; outline: none; }
  .editor :global(.ProseMirror) {
    outline: none; min-height: 60vh; padding: 1rem 0;
  }
  .editor :global(.ProseMirror p.is-editor-empty:first-child::before) {
    color: var(--placeholder);
    content: attr(data-placeholder);
    float: left; height: 0; pointer-events: none;
  }
  .editor :global(.ProseMirror h1) { font-size: 2em; font-weight: 700; margin: 1.2em 0 0.5em; letter-spacing: -0.02em; }
  .editor :global(.ProseMirror h2) { font-size: 1.5em; font-weight: 600; margin: 1em 0 0.4em; }
  .editor :global(.ProseMirror h3) { font-size: 1.2em; font-weight: 600; margin: 0.8em 0 0.3em; }
  .editor :global(.ProseMirror ul) { padding-left: 1.5em; }
  .editor :global(.ProseMirror ol) { padding-left: 1.5em; }
  .editor :global(.ProseMirror pre) {
    background: var(--code-bg); border-radius: 4px;
    padding: 1em; overflow-x: auto; margin: 0.5em 0;
  }
  .editor :global(.ProseMirror code) { font-size: 0.9em; }
  .editor :global(.ProseMirror hr) { border: none; border-top: 1px solid var(--border); margin: 1.5em 0; }
  .editor :global(.ProseMirror blockquote) {
    border-left: 3px solid var(--accent); padding-left: 1em; margin: 0.5em 0; color: var(--muted);
  }
  .editor :global(.ProseMirror ul[data-type="taskList"]) { list-style: none; padding-left: 0; }
  .editor :global(.ProseMirror ul[data-type="taskList"] li) { display: flex; align-items: flex-start; gap: 0.5em; }
  .editor :global(.ProseMirror ul[data-type="taskList"] li label) { display: flex; align-items: flex-start; gap: 0.5em; cursor: pointer; }
  .editor :global(.ProseMirror details) { margin: 0.5em 0; }
  .editor :global(.ProseMirror details summary) { cursor: pointer; font-weight: 600; }
  .editor :global(.ProseMirror details > div) { padding-left: 1em; }
  :global(.slash-item) {
    display: flex; align-items: center; gap: 8px; width: 100%;
    padding: 6px 8px; border: none; background: none; cursor: pointer;
    border-radius: 4px; color: var(--fg); text-align: left;
  }
  :global(.slash-item:hover), :global(.slash-item.slash-selected) { background: var(--hover); }
  :global(.slash-icon) {
    width: 22px; text-align: center; font-size: 12px; opacity: 0.6;
  }
</style>
