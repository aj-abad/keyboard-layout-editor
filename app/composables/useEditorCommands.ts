import { computed, watch } from 'vue'
import { useCommands, type CommandInput } from '#layers/sine/app/composables/useCommands'
import { nameOf, type LayoutApp } from './useLayoutApp'
import { TEMPLATES } from '../utils/documents'
import { stepZoom } from '../utils/zoom'

/**
 * Every operation the editor has, as a command: under its keys, and in the
 * command palette (⌘K or Ctrl+K) by name (Sine: Patterns › Commands). The
 * selection's verbs are registered only while there is a selection, so the
 * palette lists what can be done now and a key with nothing to act on is left
 * to the browser. Other layouts open in tabs of their own, which the browser
 * moves between and closes with its own keys.
 */
export function useEditorCommands(app: LayoutApp) {
  const editor = () => app.editor.value
  const setZoom = (zoom: number | 'fit') => { app.document.zoom.value = zoom }
  // The palette lists the layouts this browser keeps as it opens.
  watch(app.paletteOpen, (open) => { if (open) app.refreshRecent() })

  const commands = computed<CommandInput[]>(() => {
    const selected = editor().selectedIds.value.length > 0
    const nudges: CommandInput[] = selected
      ? ([
          ['arrowleft', -1, 0], ['arrowright', 1, 0], ['arrowup', 0, -1], ['arrowdown', 0, 1],
        ] as const).flatMap(([key, dx, dy]) => [
          { id: `nudge-${key}`, name: 'Nudge selection', shortcut: key, hidden: true, action: () => editor().moveSelected(dx * .25, dy * .25) },
          { id: `move-${key}`, name: 'Move selection a unit', shortcut: `shift+${key}`, hidden: true, action: () => editor().moveSelected(dx, dy) },
        ])
      : []

    return [
      // The layout, as a document.
      { id: 'layout-new', name: 'New layout', group: 'Layout', shortcut: 'mod+alt+n', action: app.newLayout },
      { id: 'layout-duplicate', name: 'Duplicate layout', keywords: ['copy'], group: 'Layout', action: app.duplicateLayout },
      { id: 'layout-open', name: 'Open…', keywords: ['import', 'file'], group: 'Layout', shortcut: 'mod+o', action: app.pickFiles },
      { id: 'layout-rename', name: 'Rename layout', group: 'Layout', shortcut: 'f2', action: () => { app.renaming.value = true } },
      { id: 'layout-export-json', name: 'Export KLE JSON', keywords: ['save', 'download'], group: 'Layout', shortcut: 'mod+s', action: () => app.exportAs('json') },
      { id: 'layout-export-svg', name: 'Export SVG image', keywords: ['download', 'picture'], group: 'Layout', action: () => app.exportAs('svg') },
      { id: 'layout-export-png', name: 'Export PNG image', keywords: ['download', 'picture'], group: 'Layout', action: () => app.exportAs('png') },
      { id: 'layout-json', name: 'Edit JSON', keywords: ['raw', 'code', 'source'], group: 'Layout', shortcut: 'mod+j', action: app.showJson },
      // The keys.
      { id: 'edit-undo', name: 'Undo', group: 'Edit', shortcut: 'mod+z', action: () => editor().undo() },
      { id: 'edit-redo', name: 'Redo', group: 'Edit', shortcut: 'mod+shift+z', action: () => editor().redo() },
      { id: 'edit-redo-y', name: 'Redo', shortcut: 'mod+y', hidden: true, action: () => editor().redo() },
      { id: 'edit-add', name: 'Add key', group: 'Edit', shortcut: 'n', action: () => editor().addKey() },
      { id: 'edit-add-insert', name: 'Add key', shortcut: 'insert', hidden: true, action: () => editor().addKey() },
      ...(editor().layout.value.keys.length
        ? [{ id: 'edit-select-all', name: 'Select all keys', group: 'Edit', shortcut: 'mod+a', action: () => editor().selectAll() }]
        : []),
      ...(editor().canPaste.value
        ? [{ id: 'edit-paste', name: 'Paste keys', group: 'Edit', shortcut: 'mod+v', action: () => editor().paste() }]
        : []),
      ...(selected
        ? [
            { id: 'edit-cut', name: 'Cut keys', group: 'Edit', shortcut: 'mod+x', action: () => app.copyKeys(true) },
            { id: 'edit-copy', name: 'Copy keys', group: 'Edit', shortcut: 'mod+c', action: () => app.copyKeys() },
            { id: 'edit-duplicate', name: 'Duplicate keys', group: 'Edit', shortcut: 'mod+d', action: () => editor().duplicateSelected() },
            { id: 'edit-delete', name: 'Delete keys', group: 'Edit', shortcut: 'delete', action: () => editor().deleteSelected() },
            { id: 'edit-delete-backspace', name: 'Delete keys', shortcut: 'backspace', hidden: true, action: () => editor().deleteSelected() },
            { id: 'edit-rotate', name: 'Rotate keys clockwise', group: 'Edit', shortcut: 'r', action: () => editor().rotateSelected(15) },
            { id: 'edit-rotate-back', name: 'Rotate keys counterclockwise', group: 'Edit', shortcut: 'shift+r', action: () => editor().rotateSelected(-15) },
            { id: 'edit-deselect', name: 'Deselect keys', group: 'Edit', shortcut: 'escape', action: () => editor().clearSelection() },
          ]
        : []),
      ...nudges,

      // The window.
      { id: 'view-zoom-in', name: 'Zoom in', group: 'View', shortcut: 'mod+=', action: () => setZoom(stepZoom(app.stageScale.value, 1)) },
      { id: 'view-zoom-out', name: 'Zoom out', group: 'View', shortcut: 'mod+-', action: () => setZoom(stepZoom(app.stageScale.value, -1)) },
      { id: 'view-zoom-fit', name: 'Zoom to fit', group: 'View', shortcut: 'mod+0', action: () => setZoom('fit') },
      { id: 'view-zoom-actual', name: 'Zoom to 100%', keywords: ['actual size'], group: 'View', action: () => setZoom(1) },
      {
        id: 'view-inspector', name: app.inspectorHidden.value ? 'Show inspector' : 'Hide inspector', group: 'View', shortcut: 'mod+alt+i',
        action: () => { app.inspectorHidden.value = !app.inspectorHidden.value },
      },
      { id: 'view-palette', name: 'Search commands', shortcut: 'mod+k', hidden: true, action: () => { app.paletteOpen.value = true } },
      ...TEMPLATES.map((template, index) => ({
        id: `template-${index}`, name: `New layout from ${template.name}`, keywords: ['template', 'preset'], group: 'Templates',
        action: () => app.openTemplate(template),
      })),
      ...app.recent.value.map(({ id, record }) => ({
        id: `recent-${id}`, name: `Open “${nameOf(record.layout)}”`, keywords: ['recent'], group: 'Open recent',
        action: () => app.openRecent(id),
      })),
      { id: 'help-shortcuts', name: 'Keyboard shortcuts', keywords: ['help', 'keys'], group: 'Help', shortcut: 'f1', action: () => { app.helpOpen.value = true } },
      { id: 'help-shortcuts-question', name: 'Keyboard shortcuts', shortcut: 'shift+?', hidden: true, action: () => { app.helpOpen.value = true } },
    ]
  })

  useCommands(commands)
}
