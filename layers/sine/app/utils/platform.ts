/**
 * Whether the browser reports a Mac — which decides how a shortcut is drawn
 * (`⌘` against `Ctrl`, `⌥` against `Alt`), how it is announced, and which
 * chord the browser itself binds to Back and Forward. One check, so the three
 * cannot disagree about the operator's keyboard.
 */
export const isMac = typeof navigator !== "undefined" && /mac/i.test(navigator.platform);
