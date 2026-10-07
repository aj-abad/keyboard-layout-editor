import { computed, reactive } from "vue";
import { isMac } from "../utils/platform";

export interface Command {
  id: string;
  name: string;
  /**
   * Extra words the palette matches on: the sidebar's label for the page and
   * any name the feature used to go by. Not displayed — this is what keeps a
   * command findable when `name` is not the word the operator reaches for, and
   * a match here ranks with a match on `name`. See `searchCommands`.
   */
  keywords?: string[];
  /**
   * The words of the route a navigation command opens — each path segment's
   * slug and its spaced form, filled in by the app's navigation commands.
   * Matched like `keywords` but ranked below them: every page under a segment
   * shares its slug, so a match here says where a page lives, not which page it
   * is.
   */
  routeKeywords?: string[];
  group?: string;
  shortcut?: string;
  action: () => void;
  priority?: number;
  hidden?: boolean; // register the command only as a keyboard shortcut hidden from the command palette
}

interface ParsedShortcut {
  mod: boolean;
  shift: boolean;
  alt: boolean;
  key: string;
}

interface ParsedSequence {
  steps: ParsedShortcut[];
}

const registry = reactive(new Map<string, Command>());
let listenerAttached = false;

/** Count of active shortcut blockers (menus, dropdowns, etc.). When > 0, shortcuts are ignored. */
let shortcutBlockerCount = 0;

// Shortcuts belong to the browser's keyboard. On the server this module is one
// instance for every request and nothing is ever unmounted, so the registry
// and the blocker count are only ever written in the browser.

export function pushShortcutBlocker() {
  if (import.meta.server) return;
  shortcutBlockerCount++;
  if (sequenceState.active) cancelSequence();
}

export function popShortcutBlocker() {
  if (import.meta.server) return;
  shortcutBlockerCount = Math.max(0, shortcutBlockerCount - 1);
}

export const commands = computed(() =>
  [...registry.values()].sort((a, b) => (b.priority ?? 0) - (a.priority ?? 0)),
);

export function registerCommand(cmd: Command) {
  if (import.meta.server) return;
  registry.set(cmd.id, cmd);
  ensureListener();
}

export function unregisterCommand(id: string) {
  registry.delete(id);
}

/**
 * The palette's results for a query, best first: what an app hands
 * `CommandPalette` as its items.
 *
 * `name` alone is not enough to match on: the sidebar and the palette do not
 * always call a page the same thing ("Overview" vs "Go to dashboard"), and
 * neither of them spells the route ("/pricing-rules" behind "Go to pricing").
 * Matching keywords and route words as well means a label mismatch is a
 * ranking question rather than a hard zero-result — searching either surface's
 * name finds the page.
 *
 * Two tiers, then. A match on the name or a keyword — words someone chose for
 * the command — comes before a match on route words alone, because every page
 * under a segment shares its slug: ranked as equals, "pricing rules" put the
 * Pricing overview (`/pricing-rules`) above the page named Pricing rules
 * (`/pricing-rules/presets`), and Enter opened the overview. Within a tier the
 * commands keep the order they came in.
 */
export function searchCommands(commands: readonly Command[], query: string): Command[] {
  const needle = query.trim().toLowerCase();
  if (!needle) return [...commands];
  const matches = (words: readonly string[]) =>
    words.some((word) => word.toLowerCase().includes(needle));

  const named: Command[] = [];
  const routed: Command[] = [];
  for (const command of commands) {
    if (matches([command.name, ...(command.keywords ?? [])])) named.push(command);
    else if (matches(command.routeKeywords ?? [])) routed.push(command);
  }
  return [...named, ...routed];
}

/** Whether `query` finds `command` at all, whichever tier it lands in. */
export function commandMatchesQuery(command: Command, query: string): boolean {
  return searchCommands([command], query).length > 0;
}

// ---------------------------------------------------------------------------
// Sequence state (exported for SequenceIndicator & ARIA announcements)
// ---------------------------------------------------------------------------

export const sequenceState = reactive({
  /** Canonical shortcut steps pressed so far (e.g. ["g"] or ["mod+k"]) */
  pressedKeys: [] as string[],
  /** Whether a multi-step sequence is in progress */
  active: false,
  /** The active step's monotonic deadline, used by the visual countdown */
  expiresAt: null as number | null,
  /** Text for the aria-live region */
  announcement: "",
});

let sequenceTimeout: ReturnType<typeof setTimeout> | null = null;
let announcementTimeout: ReturnType<typeof setTimeout> | null = null;

export const SEQUENCE_TIMEOUT_MS = 1500;
const ANNOUNCEMENT_CLEAR_MS = 1000;

export function resetSequence() {
  sequenceState.pressedKeys = [];
  sequenceState.active = false;
  sequenceState.expiresAt = null;
  sequenceState.announcement = "";
  if (sequenceTimeout) {
    clearTimeout(sequenceTimeout);
    sequenceTimeout = null;
  }
  if (announcementTimeout) {
    clearTimeout(announcementTimeout);
    announcementTimeout = null;
  }
}

function cancelSequence(reason: "cancelled" | "timed-out" = "cancelled") {
  if (!sequenceState.active) return;
  const announcement = reason === "timed-out" ? "Shortcut timed out" : "Shortcut canceled";
  sequenceState.announcement = announcement;
  sequenceState.pressedKeys = [];
  sequenceState.active = false;
  sequenceState.expiresAt = null;
  if (sequenceTimeout) {
    clearTimeout(sequenceTimeout);
    sequenceTimeout = null;
  }
  if (announcementTimeout) clearTimeout(announcementTimeout);
  // Clear the terminal announcement after a brief moment so the live
  // region is ready for the next announcement.
  announcementTimeout = setTimeout(() => {
    if (sequenceState.announcement === announcement) {
      sequenceState.announcement = "";
    }
    announcementTimeout = null;
  }, ANNOUNCEMENT_CLEAR_MS);
}

// ---------------------------------------------------------------------------
// Shortcut parsing
// ---------------------------------------------------------------------------

const parseStep = (token: string): ParsedShortcut => {
  const parts = token.toLowerCase().split("+");
  return {
    mod: parts.includes("mod") || parts.includes("cmd") || parts.includes("ctrl"),
    shift: parts.includes("shift"),
    alt: parts.includes("alt") || parts.includes("option"),
    key:
      parts.filter((p) => !["mod", "cmd", "ctrl", "shift", "alt", "option"].includes(p))[0] || "",
  };
};

const parseSequence = (shortcut: string): ParsedSequence => {
  const tokens = shortcut.trim().split(/\s+/);
  return { steps: tokens.map(parseStep) };
};

const normalizeEventKey = (key: string): string => (key === " " ? "space" : key.toLowerCase());

const matchesStep = (e: KeyboardEvent, step: ParsedShortcut): boolean => {
  const modPressed = e.metaKey || e.ctrlKey;
  if (step.mod && !modPressed) return false;
  if (step.shift && !e.shiftKey) return false;
  if (step.alt && !e.altKey) return false;
  if (!step.mod && (e.metaKey || e.ctrlKey)) return false;
  if (!step.shift && e.shiftKey) return false;
  if (!step.alt && e.altKey) return false;
  return normalizeEventKey(e.key) === step.key;
};

/** Preserve a step in the syntax accepted by `KeyboardShortcut`. */
const stepToken = (step: ParsedShortcut): string => {
  const parts: string[] = [];
  if (step.mod) parts.push("mod");
  if (step.shift) parts.push("shift");
  if (step.alt) parts.push("alt");
  parts.push(step.key);
  return parts.join("+");
};

/** Spell a step out for the live region instead of announcing symbol names. */
const announcementStep = (token: string): string => {
  const step = parseStep(token);
  const parts: string[] = [];
  if (step.mod) parts.push(isMac ? "Command" : "Control");
  if (step.shift) parts.push("Shift");
  if (step.alt) parts.push(isMac ? "Option" : "Alt");
  parts.push(step.key.length === 1 ? step.key.toUpperCase() : step.key);
  return parts.join(" + ");
};

// ---------------------------------------------------------------------------
// Keydown handler with sequence support
// ---------------------------------------------------------------------------

/**
 * Keys the browser reserves for editing text inside a field. A registered
 * shortcut must never shadow these while the caret is in an input, however
 * badly it wants the chord: `mod+a` is registered as "select all stations", so
 * without this, Cmd+A in the stations search box selected the entire fleet —
 * and raised a bulk action bar offering Hard Reset — instead of selecting the
 * text the operator was trying to replace.
 */
const NATIVE_EDIT_KEYS = new Set(["a", "c", "v", "x", "z", "y"]);

/**
 * The step of the last press that was a shortcut's, whether the registry ran it
 * or a control took it first. A held key repeats its keydown until it is let
 * go; this is how a repeat is known to still be that shortcut's, so its default
 * stays prevented and the browser's own binding for the chord (its help on F1,
 * its search on Ctrl+K) doesn't run partway through the hold.
 */
let heldStep: string | null = null;

const handleKeyDown = (e: KeyboardEvent) => {
  // IME composition emits synthetic-looking key events that must not start or
  // advance a shortcut.
  if (e.isComposing || e.key === "Process") return;

  // A held key does its work once. A repeat never runs, continues or cancels a
  // shortcut: held a moment too long, `mod+z` would undo the next toast's action
  // as well, and a sequence prefix would cancel itself.
  const step = buildStepToken(e);
  if (e.repeat) {
    if (step === heldStep) e.preventDefault();
    return;
  }
  heldStep = null;

  // Skip if user is typing in an input (unless it's a mod+key shortcut). A
  // function key types nothing, so a field has no claim on it: F1 opens a
  // page's help from a cell of the enrolment sheet as it does anywhere else.
  const target = e.target as HTMLElement;
  const isInput =
    target.tagName === "INPUT" || target.tagName === "TEXTAREA" || target.isContentEditable;
  const isFunctionKey = /^F([1-9]|1[0-2])$/.test(e.key);
  if (isInput && !isFunctionKey) {
    if (!(e.metaKey || e.ctrlKey)) return;
    // Alt is not part of any native editing chord, so alt+mod+key is still ours.
    if (!e.altKey && NATIVE_EDIT_KEYS.has(e.key.toLowerCase())) return;
  }

  // Ignore bare modifier keypresses
  if (["Control", "Meta", "Alt", "Shift"].includes(e.key)) return;

  // Handle Escape: cancel any active sequence
  if (e.key === "Escape" && sequenceState.active) {
    cancelSequence();
    e.preventDefault();
    return;
  }

  const sorted = [...registry.values()].sort((a, b) => (b.priority ?? 0) - (a.priority ?? 0));
  const currentStepIndex = sequenceState.pressedKeys.length;

  // Collect exact matches and partial (prefix) matches
  let exactMatch: Command | null = null;
  let hasPartialMatch = false;

  for (const cmd of sorted) {
    if (!cmd.shortcut) continue;
    const seq = parseSequence(cmd.shortcut);

    // Must have enough steps for what we've already pressed + this keypress
    if (seq.steps.length < currentStepIndex + 1) continue;

    // Verify all previously pressed keys still match
    let prefixOk = true;
    for (let i = 0; i < currentStepIndex; i++) {
      if (sequenceState.pressedKeys[i] !== stepToken(seq.steps[i]!)) {
        prefixOk = false;
        break;
      }
    }
    if (!prefixOk) continue;

    // Check whether the current keypress matches the next step
    if (!matchesStep(e, seq.steps[currentStepIndex]!)) continue;

    if (seq.steps.length === currentStepIndex + 1) {
      // All steps matched — this is an exact match
      if (!exactMatch) exactMatch = cmd;
    } else {
      // More steps remain — partial match
      hasPartialMatch = true;
    }
  }

  // If nothing matched at all
  if (!exactMatch && !hasPartialMatch) {
    // If we were in a sequence, cancel it (the key didn't continue any sequence)
    if (sequenceState.active) {
      cancelSequence();
    }
    return;
  }

  // A key a control has already handled is the control's, and it doesn't
  // continue a sequence either. The palette's field closes the palette on
  // `mod+k`, and a trusted keydown flushes Vue's queue between listeners, so the
  // palette's shortcut blocker has come off by the time the key bubbles here:
  // without this, the same keypress opened the palette again. Its repeats are
  // still kept from the browser.
  if (e.defaultPrevented) {
    heldStep = step;
    cancelSequence();
    return;
  }

  // Skip when a blocking overlay (dropdown, context menu, etc.) is open
  if (shortcutBlockerCount > 0) return;

  e.preventDefault();
  heldStep = step;

  // Preserve the shortcut structure so modifiers remain a single visual chord.
  const currentStep = parseStep(step);
  const token = stepToken(currentStep);

  if (exactMatch && !hasPartialMatch) {
    // Unambiguous exact match — execute immediately
    resetSequence();
    exactMatch.action();
    return;
  }

  if (exactMatch && hasPartialMatch) {
    // Exact match exists but there are also longer sequences that could match.
    // Prefer the exact match (same as Linear's behavior).
    resetSequence();
    exactMatch.action();
    return;
  }

  // Partial match only — enter/continue sequence
  sequenceState.pressedKeys = [...sequenceState.pressedKeys, token];
  sequenceState.active = true;
  sequenceState.announcement = `${sequenceState.pressedKeys
    .map(announcementStep)
    .join(", then ")} pressed; waiting for next key`;
  if (announcementTimeout) {
    clearTimeout(announcementTimeout);
    announcementTimeout = null;
  }

  // One deadline drives both the command timeout and the visual countdown.
  if (sequenceTimeout) clearTimeout(sequenceTimeout);
  sequenceState.expiresAt = performance.now() + SEQUENCE_TIMEOUT_MS;
  sequenceTimeout = setTimeout(() => cancelSequence("timed-out"), SEQUENCE_TIMEOUT_MS);
};

/** Reconstruct a step token from a KeyboardEvent for parsing. */
const buildStepToken = (e: KeyboardEvent): string => {
  const parts: string[] = [];
  if (e.metaKey || e.ctrlKey) parts.push("mod");
  if (e.shiftKey) parts.push("shift");
  if (e.altKey) parts.push("alt");
  parts.push(normalizeEventKey(e.key));
  return parts.join("+");
};

// ---------------------------------------------------------------------------
// Cancellation listeners
// ---------------------------------------------------------------------------

function onWindowBlur() {
  cancelSequence();
}

function onDocumentMouseDown() {
  cancelSequence();
}

function onDocumentFocusIn() {
  cancelSequence();
}

// ---------------------------------------------------------------------------
// Listener management
// ---------------------------------------------------------------------------

function ensureListener() {
  if (listenerAttached) return;
  window.addEventListener("keydown", handleKeyDown);
  window.addEventListener("blur", onWindowBlur);
  document.addEventListener("mousedown", onDocumentMouseDown);
  document.addEventListener("focusin", onDocumentFocusIn);
  listenerAttached = true;
}

export function destroyListener() {
  window.removeEventListener("keydown", handleKeyDown);
  window.removeEventListener("blur", onWindowBlur);
  document.removeEventListener("mousedown", onDocumentMouseDown);
  document.removeEventListener("focusin", onDocumentFocusIn);
  listenerAttached = false;
  shortcutBlockerCount = 0;
  heldStep = null;
  resetSequence();
}
