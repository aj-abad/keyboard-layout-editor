/**
 * When a control's tooltip opens and closes. `UI/IconButton` and a collapsed
 * `Sidebar/NavItem` both mount the house tooltip on themselves, and this is the
 * one answer they give a pointer or a key, so the top bar and the rail keep the
 * same beat.
 *
 * - **A dwell, then a handoff.** The first tooltip waits `TOOLTIP_DELAY_MS`.
 *   Once one has shown, the next control reached within `HANDOFF_MS` shows its
 *   own at once and without the entrance, so a pointer reading along a toolbar
 *   gets each name as it arrives rather than waiting half a second per button.
 * - **A click closes it.** The label has done its job, and what the click opens
 *   should not wear it. It stays closed until the pointer leaves and returns,
 *   with one exception: a label the click changed, "Copied", is the answer to
 *   the click, so it shows, to the pointer still over the control or the
 *   keyboard still on it.
 * - **An open control shows none.** While the control is expanded its menu or
 *   popover is on screen, and the name would sit over it.
 * - **The keyboard opens it too.** Focus that arrives by Tab or an arrow key
 *   opens the tooltip on the same dwell, since the glyph is all a sighted
 *   keyboard user has. Focus that a click, a closing menu or a returning window
 *   put there does not: that reader already knows where they are. The key is
 *   read on `keyup`, which fires on the control focus landed on, so a held Tab
 *   opens one tooltip, where it stops.
 * - **Touch never opens it.** A tap has no hover to end, so a tooltip it opened
 *   would stay until the next tap.
 * - **Escape closes it**, from wherever the focus is, and takes nothing else
 *   with it: the event carries on to the dialog or the menu it was meant for.
 */
export const TOOLTIP_DELAY_MS = 500;

/** How long after one tooltip closes the next opens without the dwell. */
const HANDOFF_MS = 300;

const ARRIVAL_KEYS = new Set([
  "Tab",
  "ArrowLeft",
  "ArrowRight",
  "ArrowUp",
  "ArrowDown",
  "Home",
  "End",
]);
const MODIFIER_KEYS = new Set(["Shift", "Control", "Alt", "Meta"]);

/** When the last tooltip on the page closed, on the `performance.now()` clock. */
let lastClosedAt = Number.NEGATIVE_INFINITY;

interface TooltipTriggerOptions {
  /** The tooltip's text. A change under a pointer that just clicked reopens it. */
  label: () => string;
  /** Whether the control has a tooltip to show right now. Read whenever one would open. */
  enabled: () => boolean;
  /** Milliseconds of hover or focus before the first tooltip. */
  delay?: () => number;
}

export const useTooltipTrigger = ({ label, enabled, delay }: TooltipTriggerOptions) => {
  const open = shallowRef(false);
  /** Opened in the wake of another tooltip: it appears with no entrance. */
  const instant = shallowRef(false);
  /**
   * Opened by the pointer. A screen reader has read the name of a control the
   * keyboard focused, so only a pointer's tooltip has anything to announce.
   */
  const fromPointer = shallowRef(true);

  let timer: ReturnType<typeof setTimeout> | undefined;
  let hovered = false;
  /** Clicked since the pointer arrived, or since focus did. */
  let clicked = false;
  /** Focus has landed and no key has come up since: the next `keyup` says how it got here. */
  let arriving = false;
  /** Focus arrived by key, and has not left. */
  let keyboardFocused = false;
  let shownLabel = label();

  const cancel = () => {
    clearTimeout(timer);
    timer = undefined;
  };

  const close = () => {
    cancel();
    if (!open.value) return;
    lastClosedAt = performance.now();
    open.value = false;
  };

  const show = (pointer: boolean, wait = delay?.() ?? TOOLTIP_DELAY_MS) => {
    cancel();
    if (open.value || !enabled()) return;

    const handoff = performance.now() - lastClosedAt < HANDOFF_MS;
    const reveal = () => {
      timer = undefined;
      if (!enabled()) return;
      fromPointer.value = pointer;
      instant.value = handoff;
      open.value = true;
    };

    if (handoff || wait <= 0) reveal();
    else timer = setTimeout(reveal, wait);
  };

  const onPointerenter = (event: PointerEvent) => {
    if (event.pointerType === "touch") return;
    hovered = true;
    clicked = false;
    show(true);
  };

  const onPointerleave = () => {
    hovered = false;
    clicked = false;
    if (keyboardFocused) cancel();
    else close();
  };

  const onClick = () => {
    clicked = true;
    arriving = false;
    close();
  };

  const onFocus = () => {
    arriving = true;
  };

  const onKeyup = (event: KeyboardEvent) => {
    if (!arriving || MODIFIER_KEYS.has(event.key)) return;
    arriving = false;
    if (!ARRIVAL_KEYS.has(event.key)) return;
    keyboardFocused = true;
    show(false);
  };

  const onBlur = () => {
    arriving = false;
    keyboardFocused = false;
    if (!hovered || clicked) close();
    if (!hovered) clicked = false;
  };

  const onEscape = (event: KeyboardEvent) => {
    if (event.key === "Escape") close();
  };

  watch(open, (isOpen) => {
    if (isOpen) window.addEventListener("keydown", onEscape);
    else window.removeEventListener("keydown", onEscape);
  });

  // The control's attributes are not reactive on their own, so its state is
  // read after each render: a control that has just become expanded, disabled
  // or unnamed drops its tooltip, and a label changed by a click shows.
  onUpdated(() => {
    const next = label();
    const relabeled = next !== shownLabel;
    shownLabel = next;

    if (!enabled()) {
      close();
    } else if (relabeled && clicked && (hovered || keyboardFocused)) {
      clicked = false;
      show(hovered, 0);
    }
  });

  onBeforeUnmount(() => {
    cancel();
    if (open.value) window.removeEventListener("keydown", onEscape);
  });

  return {
    open,
    instant,
    fromPointer,
    close,
    /** The listeners the control binds: `v-on="tooltip.on"`. */
    on: {
      pointerenter: onPointerenter,
      pointerleave: onPointerleave,
      click: onClick,
      focus: onFocus,
      keyup: onKeyup,
      blur: onBlur,
    },
  };
};
