<template>
  <DropdownMenuRoot v-model:open="isOpen" :modal="sheet">
    <!-- The trigger is the slotted element itself, as Reka's own trigger
         would make it: the handlers are merged onto it, so a list's `ul` is
         the trigger and a focused row's Shift+F10 reaches it by bubbling.
         `global` menus have no trigger; they listen on the document instead. -->
    <ContextMenuTrigger
      v-if="!global"
      :data-state="isOpen ? 'open' : 'closed'"
      :style="TRIGGER_STYLE"
      @contextmenu="onContextMenu"
      @keydown="onMenuKey"
      @pointerdown="onPointerDown"
      @pointermove="cancelLongPress"
      @pointerup="cancelLongPress"
      @pointercancel="cancelLongPress">
      <slot name="trigger" />
    </ContextMenuTrigger>
    <slot />
  </DropdownMenuRoot>
</template>

<script lang="ts">
import { cloneVNode, Comment, defineComponent, Fragment, type VNode } from "vue";

const slotElements = (children: VNode[]): VNode[] =>
  children.flatMap((child) =>
    child.type === Fragment ? slotElements(child.children as VNode[]) : [child],
  );

/**
 * Merges the root's attrs and handlers onto the one slotted element — what
 * Reka's `Primitive as-child` does, minus the bug. Reka's `Slot` deletes `ref`
 * from the child's `props` before cloning, and Vue reuses that props object
 * across renders (it is a hoisted constant for an element whose bindings are
 * static), so from the second render on the child arrives with no ref and
 * Vue unsets the template ref the caller put on it: `ChargingStations/List`'s
 * `stationGridRef` and the sidebar's `navList` both went null the first time
 * their menu opened (2026-09-14). `cloneVNode` with `mergeRef` leaves the
 * child's `props` and `ref` untouched.
 */
const ContextMenuTrigger = defineComponent({
  name: "ContextMenuTrigger",
  inheritAttrs: false,
  setup(_, { attrs, slots }) {
    return () => {
      const child = slotElements(slots.default?.() ?? []).find((node) => node.type !== Comment);
      return child ? cloneVNode(child, attrs, true) : null;
    };
  },
});
</script>

<script setup lang="ts">
import { defaultDocument, useEventListener } from "@vueuse/core";
import { DropdownMenuRoot, type ReferenceElement } from "reka-ui";
import { useCompactViewport } from "../../composables/useCompactViewport";
import {
  CONTEXT_MENU_KEY,
  MENU_CONTENT_SELECTOR,
  contextMenuAnchor,
  keepsNativeContextMenu,
  registerOpenContextMenu,
  unregisterOpenContextMenu,
  type ContextMenuOpenRequest,
  type OpenContextMenu,
} from "../../utils/contextMenu";
import { useShortcutBlocker } from "../../composables/useShortcutBlocker";

/**
 * The root of every context menu in the app.
 *
 * Reka's `ContextMenuRoot` is not used, and the reason is the invariant this
 * component exists to keep: **at most one context menu is open, anywhere**,
 * and a right-click always opens the one for what is under the pointer. Reka's
 * root can only be opened by its own trigger and cannot be closed from
 * outside at all, so two of them beside each other — the map's, a location
 * row's, the app's — could not close each other, and three were open at once
 * on 2026-09-14. This root is built on `DropdownMenuRoot` instead, whose
 * `open` is controlled and whose content anchors to any `reference`, and it
 * registers itself with `utils/contextMenu.ts` as it opens, which closes
 * whichever menu was. Everything inside the menu is still Reka's —
 * `DropdownMenuItem`, `DropdownMenuSub`, the roving focus, the typeahead, the
 * dismiss layer that stacks with dialogs and popovers — through
 * `ContextMenuContent`, which is also the one place a different
 * presentation (a sheet on a phone) would go.
 *
 * ## Opening
 *
 * A right-click on the trigger emits `beforeOpen` with the event and a
 * `decline()`. The listener reads its subject off `event.target` there — a
 * list picks the row — and declines when there is nothing to open for, in
 * which case the event carries on unprevented to an enclosing menu (the map's
 * around the location panel) or to the `global` one in `app.vue`. A menu that
 * opens prevents the event, and an enclosing root sees that and stays shut.
 * The whole hand-off is synchronous, which is what lets the app menu decide
 * from a plain document listener.
 *
 * Text keeps the browser's menu everywhere — a field, an editable region, a
 * selection under the pointer, or Shift held — see `keepsNativeContextMenu`.
 *
 * ## `open`
 *
 * Optional `v-model:open`, for a caller that reacts to the menu being up (the
 * locations page pauses the map's gestures). Setting it `false` closes;
 * `useShortcutBlocker` is applied here, so no caller repeats it.
 *
 * ## Popper or sheet
 *
 * On a compact viewport the same menu is a sheet: modal, over the shared
 * backdrop, rising from the bottom edge with rows sized for a thumb. The
 * root decides (`useCompactViewport()`, or the `presentation` prop where a
 * story needs to say) and `ContextMenuContent` draws it; nothing in
 * between knows which it got. A popper is non-modal so that a right-click
 * elsewhere reaches the real element under it; a sheet is modal so that a
 * tap on the scrim is a tap on nothing, as a sheet's is.
 *
 * ## Touch
 *
 * A long press on a touch or pen pointer opens the menu where a right-click
 * would, after the same delay Reka uses; the browser's own `contextmenu` for a
 * long press, where it fires one, wins and cancels the timer.
 */

const {
  global = false,
  disabled = false,
  presentation,
  touchSelector,
} = defineProps<{
  /**
   * The menu for everything no other menu claimed: no trigger, a listener on
   * the document instead, and a right-click on an open menu is inert, as the
   * browser's own menus are.
   */
  global?: boolean;
  disabled?: boolean;
  /** Force one presentation. For stories; the app lets the viewport decide. */
  presentation?: "popper" | "sheet";
  /** Opt selected elements into a global menu's touch long press, without a root per chip. */
  touchSelector?: string;
}>();

const emit = defineEmits<{
  beforeOpen: [request: ContextMenuOpenRequest];
}>();

const isOpen = defineModel<boolean>("open", { default: false });

const compact = useCompactViewport();
const sheet = computed(() => (presentation ? presentation === "sheet" : compact.value));

/** Reka's own trigger styles, so a long press on iOS does not also raise the callout. */
const TRIGGER_STYLE = { WebkitTouchCallout: "none" } as const;
const LONG_PRESS_MS = 700;

const point = shallowRef({ x: 0, y: 0 });

/** A zero-size rect at the point, the shape Reka's own context-menu trigger anchors to. */
const anchor = computed<ReferenceElement>(() => {
  const { x, y } = point.value;
  return {
    getBoundingClientRect: () => ({
      width: 0,
      height: 0,
      x,
      y,
      left: x,
      right: x,
      top: y,
      bottom: y,
    }),
  };
});

// Focus goes back to where it was when the menu closes from the keyboard or a
// choice, and stays where the pointer put it when a click outside closed a
// popper — or when another menu opened in its place, since that menu is about
// to take focus itself. A sheet is modal, so a tap outside it landed on
// nothing and focus goes back as well. `DropdownMenuContent` would do this for
// its trigger if it had one; it always prevents the FocusScope's own restore,
// so this is the only restore there is.
let returnFocusTo: HTMLElement | null = null;
let interactedOutside = false;
let yielded = false;

const noteInteractOutside = () => {
  interactedOutside = true;
};

const restoreFocus = (event: Event) => {
  const prevented = event.defaultPrevented;
  event.preventDefault();
  const clickLanded = interactedOutside && !sheet.value;
  if (!prevented && !clickLanded && !yielded) returnFocusTo?.focus({ preventScroll: true });
  interactedOutside = false;
  yielded = false;
  returnFocusTo = null;
};

const registration: OpenContextMenu = {
  close: () => {
    yielded = true;
    isOpen.value = false;
  },
};

watch(isOpen, (open) => {
  if (open) registerOpenContextMenu(registration);
  else unregisterOpenContextMenu(registration);
});

onUnmounted(() => unregisterOpenContextMenu(registration));

useShortcutBlocker(isOpen);

const openAt = (event: MouseEvent) => {
  // A menu still on its way out may hold focus; it is no place to return to.
  const active = document.activeElement;
  if (active instanceof HTMLElement && !active.closest(MENU_CONTENT_SELECTOR)) {
    returnFocusTo = active;
  }
  interactedOutside = false;
  yielded = false;
  point.value = contextMenuAnchor(event);
  isOpen.value = true;
};

const onContextMenu = (event: MouseEvent) => {
  cancelLongPress();
  if (disabled || event.defaultPrevented) return;
  if (keepsNativeContextMenu(event)) return;
  if (event.target instanceof Element && event.target.closest(MENU_CONTENT_SELECTOR)) {
    // On an open menu: nothing, as the browser's own menus do. Only the
    // global root can meet this — menus are portaled out of every trigger.
    event.preventDefault();
    return;
  }

  let declined = false;
  emit("beforeOpen", {
    event,
    decline: () => {
      declined = true;
    },
  });
  if (declined) return;

  event.preventDefault();
  openAt(event);
};

// macOS browsers do not consistently synthesize a contextmenu event for
// Shift+F10. Send the same event as a pointer would, without Shift (which is
// intentionally the pointer's escape hatch to the browser menu). Only consume
// the key when a menu actually accepts it; text fields keep their native menu.
const onMenuKey = (event: KeyboardEvent) => {
  if (event.defaultPrevented || event.altKey || event.ctrlKey || event.metaKey) return;
  if (event.key !== "ContextMenu" && !(event.shiftKey && event.key === "F10")) return;
  if (!(event.target instanceof Element)) return;
  const accepted = !event.target.dispatchEvent(
    new MouseEvent("contextmenu", { bubbles: true, cancelable: true }),
  );
  if (accepted) event.preventDefault();
};

let longPressTimer = 0;

const cancelLongPress = () => {
  window.clearTimeout(longPressTimer);
};

const onPointerDown = (event: PointerEvent) => {
  if (disabled || event.pointerType === "mouse") return;
  cancelLongPress();
  longPressTimer = window.setTimeout(() => onContextMenu(event), LONG_PRESS_MS);
};

if (global) {
  // Document, bubble phase: after every trigger on the way up has had its
  // synchronous say and prevented the event if it opened.
  useEventListener(defaultDocument, "contextmenu", onContextMenu);
  if (touchSelector) {
    useEventListener(defaultDocument, "pointerdown", (event: PointerEvent) => {
      if (event.target instanceof Element && event.target.closest(touchSelector))
        onPointerDown(event);
    });
    useEventListener(defaultDocument, "pointermove", cancelLongPress);
    useEventListener(defaultDocument, "pointerup", cancelLongPress);
    useEventListener(defaultDocument, "pointercancel", cancelLongPress);
  }
}

onUnmounted(cancelLongPress);

provide(CONTEXT_MENU_KEY, { anchor, sheet, isOpen, restoreFocus, noteInteractOutside });
</script>
