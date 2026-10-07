/**
 * The toast store, and the imperative `toast` every call site reaches for.
 *
 * Toasts are the portal's only transient feedback: 216 calls across 52 files,
 * almost all of them a single line raised from a mutation callback. That shape
 * is why the API is imperative and callable from anywhere — a composable you
 * have to be inside `setup()` to reach would not serve an `onError` handler in
 * `composables/api/*`.
 *
 * ## Why a store rather than a library queue
 *
 * The rendering is `reka-ui`'s `Toast`, which is declarative: it owns the live
 * region, the dismiss timer, the swipe and the focus hotkey, and expects the
 * caller to render the list. So this file is the list. It replaced `vue-sonner`
 * for the feedback toaster on 2026-09-07, for three reasons the old one could
 * not be argued into:
 *
 * - **Severity had nowhere to live.** The pill was painted on sonner's *title*
 *   element with its icon slot hidden, so there was no box to tone and no slot
 *   for a glyph. All 115 `toast.error` calls rendered identically to the 85
 *   `toast.success` ones.
 * - **An action in a toast has an accessibility contract**, and Reka's
 *   `ToastAction` enforces it in the type system: `altText` names another way to
 *   do the same thing, for a reader who cannot reach the button before it goes.
 *   That is `altText` on {@link ToastActionSpec}, and it is required.
 * - **A countdown needs the real timer.** `ToastRoot` hands its own rAF-driven
 *   `remaining` to the default slot and freezes it while the dismiss timer is
 *   paused, so the ring in `UI/Toast.vue` cannot drift from the moment the
 *   toast actually leaves. Anything reimplemented beside it would.
 *
 * ## A toast is one line, and says one of two things
 *
 * It tells the operator that what they just did succeeded or failed. A
 * success that was destructive offers to undo it; a failure offers to retry
 * it. That is the whole vocabulary, which is why there is no description
 * field (removed 2026-09-13): if the intent cannot be said in one line, the
 * toast is the wrong component. The *reason* an action failed — a timeout, a
 * rejected command, a validation — goes where the operator can act on it,
 * the way the command log and the field chin already do; if it is not worth
 * that, it is not worth a second line here either.
 *
 * The inbox notification toaster is still sonner's — see
 * `useInboxNotificationToast.ts`. It renders `Notification` objects rather than
 * feedback and has its own stacking, width and hotkey; porting it is separate.
 */

import type { StatusTone } from "../utils/status";

/**
 * A toast's severity, as a house tone.
 *
 * Four of the five status tones, because `live` (blue — charging, in progress)
 * describes a thing in the world rather than the outcome of a click. `idle` is
 * the neutral one, which is what a bare `toast()` and `toast.info()` get.
 */
export type ToastTone = Extract<StatusTone, "good" | "warn" | "bad" | "idle">;

export interface ToastActionSpec {
  /** The button's label. One or two words — it sits inside a 32px pill. */
  label: string;
  /**
   * A short description of another way to carry out this action, for screen
   * reader users who will not reach the button before the toast leaves. Reka
   * requires it on `ToastAction`; the WAI-ARIA pattern is why.
   *
   * @example "Undo from the location's history"
   * @example "Retry from the station's actions menu"
   */
  altText: string;
  onSelect: () => void;
  /**
   * A chord that fires the action from the keyboard while the toast is on
   * screen, in the registry's syntax (`"mod+z"`). `Shared/Toasters.vue`
   * registers it through `useCommands()` — so it lands in the palette under
   * the action's label and the toast's title — and the button draws it as a
   * `kbd`. When two toasts carry the same chord the newest wins: it is the
   * action the operator took last. `toast.undo` sets `mod+z`.
   */
  shortcut?: string;
}

export interface ToastOptions {
  /** Replaces any toast already showing under this id, rather than stacking. */
  id?: string;
  action?: ToastActionSpec;
  /** Milliseconds, or `null` to stay until dismissed. Defaults per tone. */
  duration?: number | null;
  /** The ring around the close button. Defaults on for an actionable toast. */
  countdown?: boolean;
  /** Whether the close button is drawn. A toast is always Escape-dismissible. */
  dismissible?: boolean;
  /** Called when it leaves, however it leaves. */
  onDismiss?: () => void;
}

/**
 * Where a toast sits in the stack, decided by `Shared/Toasters.vue` from the
 * measured sizes of every open toast and handed to `UI/Toast.vue` to animate
 * to. Distances are from the bottom edge of the viewport, in px.
 */
export interface ToastPlacement {
  /** How far above the edge its bottom sits — applied as a negative `y`. */
  offset: number;
  /** `1` in front; a card behind the front one is scaled down by its depth. */
  scale: number;
  /** The front card's width, while behind it — so the stack reads as one deck. */
  width: number | null;
  /** Behind the front card with its content hidden: only its edge shows. */
  stacked: boolean;
  /**
   * How much of it shows. A card in the deck fades a step per depth — the
   * separation sonner gets from a border and a shadow, which a flat dark pill
   * on the same flat dark pill does not have.
   */
  opacity: number;
  /** Spread out into a list, so a bridge over the gap keeps the hover alive. */
  expanded: boolean;
  /** Nearer the edge paints on top: a new toast rises from behind the ones there. */
  z: number;
  /** The space above it, which a bridge covers while it is spread out. */
  gap: number;
}

export interface ToastRecord {
  id: string;
  tone: ToastTone;
  /** One line: what succeeded or failed. It truncates rather than wrapping. */
  title: string;
  action?: ToastActionSpec;
  /** `null` never auto-dismisses. */
  duration: number | null;
  countdown: boolean;
  dismissible: boolean;
  onDismiss?: () => void;
  /**
   * `false` once it has been told to go. The record stays in the list while
   * `UI/Toast.vue` plays the exit, and leaves it through `remove` — so a
   * dismissal from code collapses the stack the same way a click does, rather
   * than cutting a hole in it.
   */
  open: boolean;
}

/**
 * Dwell times. These are deliberately not `utils/motion.ts` durations — those
 * are transition lengths, and this is reading time.
 */
const DURATION = {
  /** Plain feedback: long enough to read one line, short enough to ignore. */
  feedback: 4000,
  /** A failure takes longer to read, and usually names something to go fix. */
  failure: 6000,
  /** An undo window. The ring is the affordance, so it has to be watchable. */
  undo: 8000,
} as const;

/**
 * Past this the stack is taller than it is readable, and the oldest is the one
 * least likely to still matter. Matches what the previous toaster showed.
 */
const MAX_VISIBLE = 4;

/** Singleton state — see `CLAUDE.md` § Composables Pattern. */
const toasts = ref<ToastRecord[]>([]);

let sequence = 0;

/**
 * A failure the operator can act on must not vanish while they read it: under
 * optimistic updates the write has already been rolled back on screen, and the
 * retry button is the only remaining trace that it was ever attempted.
 */
const resolveDuration = (tone: ToastTone, options: ToastOptions): number | null => {
  if (options.duration !== undefined) return options.duration;
  if (options.action && tone === "bad") return null;
  return tone === "bad" ? DURATION.failure : DURATION.feedback;
};

const push = (tone: ToastTone, title: string, options: ToastOptions = {}): string => {
  // Toasts are drawn in the browser only (Reka's portal), and on the server this
  // stack would be every request's: one raised there would never leave.
  if (import.meta.server) return options.id ?? "";
  const id = options.id ?? `toast-${++sequence}`;
  const duration = resolveDuration(tone, options);

  const record: ToastRecord = {
    id,
    tone,
    title,
    action: options.action,
    duration,
    // An actionable toast on a clock says how long the offer stands. One
    // without an action has nothing to spend that attention on.
    countdown: options.countdown ?? (options.action != null && duration != null),
    dismissible: options.dismissible ?? true,
    onDismiss: options.onDismiss,
    open: true,
  };

  const existing = toasts.value.findIndex((entry) => entry.id === id);
  if (existing !== -1) {
    toasts.value.splice(existing, 1, record);
    return id;
  }

  toasts.value.push(record);
  // The cap counts the toasts still standing: one on its way out is not in
  // the stack for long enough to crowd it, and closing it twice does nothing.
  const standing = toasts.value.filter((entry) => entry.open);
  for (const entry of standing.slice(0, Math.max(0, standing.length - MAX_VISIBLE))) {
    entry.open = false;
  }
  return id;
};

/** Ask a toast to leave. The record goes once `UI/Toast.vue` has played it out. */
const dismiss = (id?: string) => {
  for (const entry of toasts.value) {
    if (id === undefined || entry.id === id) entry.open = false;
  }
};

/** The viewport's side of `dismiss`: the exit has played, so drop the record. */
const remove = (id: string) => {
  const index = toasts.value.findIndex((entry) => entry.id === id);
  if (index === -1) return;
  toasts.value.splice(index, 1);
};

const toned =
  (tone: ToastTone) =>
  (title: string, options?: ToastOptions): string =>
    push(tone, title, options);

/**
 * Raise a toast. Callable directly for a neutral message, or through one of the
 * severities.
 *
 * ```ts
 * toast.success("Station registered");
 * toast.error("Couldn't update the tariff", {
 *   action: {
 *     label: "Retry",
 *     altText: "Retry from the tariff's actions menu",
 *     onSelect: retry,
 *   },
 * });
 * toast.undo("Location deleted", {
 *   altText: "Restore it from the location list's archive filter",
 *   onSelect: restore,
 * });
 * ```
 *
 * Declared and then exported by name rather than written as `export const`, and
 * it has to stay that way. Auto-imports are collected by unimport, which reads a
 * declaration export with a regex (mlly's `EXPORT_DECAL_RE`) instead of parsing:
 * the comma-separated pairs of the object literal below read as further
 * declarators, so `export const toast = Object.assign(…, { … })` published a
 * second, imaginary export of this module — `info`, the last key its walk
 * reached. Nuxt and Storybook build their auto-import tables from that same
 * scanner, and any file mentioning a bare `info` it could not see declared (a
 * function parameter, say) then had `import { info } from "./useToast"` injected
 * into it, which the production bundler rejects as a missing export.
 * `export { … }` is read exactly, whatever the initialiser looks like.
 */
const toast = Object.assign(toned("idle"), {
  success: toned("good"),
  error: toned("bad"),
  warning: toned("warn"),
  info: toned("idle"),
  /** Sonner's name for a toast with no severity. Kept so call sites can stay. */
  message: toned("idle"),

  /**
   * A destructive action the operator can take back, with the ring showing how
   * long they have. Neutral rather than `good` — what just happened is not a
   * success until the window has closed on it.
   *
   * It answers to `mod+z` while it is on screen, which is the chord an undo
   * already means everywhere else. The registry keeps it out of text fields
   * (`NATIVE_EDIT_KEYS`), where the browser's own undo has to win.
   */
  undo: (
    title: string,
    action: ToastActionSpec | Omit<ToastActionSpec, "label">,
    options: Omit<ToastOptions, "action"> = {},
  ): string =>
    push("idle", title, {
      ...options,
      duration: options.duration ?? DURATION.undo,
      action: { label: "Undo", shortcut: "mod+z", ...action },
    }),

  /** Dismiss one toast, or all of them. Each plays out before it goes. */
  dismiss,
});

export { toast };

/** The viewport's side. Nothing else should need this. */
export const useToasts = () => ({ toasts, dismiss, remove });
