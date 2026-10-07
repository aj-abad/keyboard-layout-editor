import { isMac } from '#layers/sine/app/utils/platform'

const KEY_NAMES: Record<string, string> = {
  mod: isMac ? 'Meta' : 'Control',
  shift: 'Shift',
  alt: 'Alt',
  option: 'Alt',
  delete: 'Delete',
  backspace: 'Backspace',
  escape: 'Escape',
  enter: 'Enter',
  space: 'Space',
  insert: 'Insert',
  arrowup: 'ArrowUp',
  arrowdown: 'ArrowDown',
  arrowleft: 'ArrowLeft',
  arrowright: 'ArrowRight',
}

/** A registry shortcut (`mod+shift+z`, `g 1`) as `aria-keyshortcuts` spells it. */
export function ariaKeyshortcuts(shortcut: string): string {
  return shortcut
    .trim()
    .split(/\s+/)
    .map(step => step.split('+').map(part => KEY_NAMES[part] ?? (part.length === 1 ? part.toUpperCase() : part)).join('+'))
    .join(' ')
}
