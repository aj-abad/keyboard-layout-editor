import type { PointerDownOutsideEvent } from "reka-ui";
import { zIndex } from "../../tailwind.config";

const DIALOG_BASE_Z_INDEX = Number(zIndex.modal);
const BACKDROP_SELECTOR = ".dialog-backdrop";

const activeDialogs = shallowRef<symbol[]>([]);
const isDialogBackdropOpen = computed(() => activeDialogs.value.length > 0);

const removeDialog = (dialogId: symbol) => {
  activeDialogs.value = activeDialogs.value.filter((id) => id !== dialogId);
};

/**
 * Whether a Reka `pointerDownOutside` landed on the backdrop itself rather than
 * on some other surface portalled above it.
 *
 * Dismissal hangs off `DialogContent`'s own `pointer-down-outside` rather than a
 * `pointerdown` listener on the backdrop element, because Reka's is layer-aware
 * and a bare listener is not. A select, menu or popover portalled out of a
 * dialog is a `[data-dismissable-layer]` above it, and Reka reports the outside
 * pointerdown only to the highest such layer — but it never stops the native
 * event, so the one gesture that closed an open select used to reach the
 * backdrop and close the dialog under it as well.
 *
 * The backdrop check is what keeps the old reach: everything else portalled
 * above the dialog (a toast, the command palette) is "outside" this layer too,
 * and none of it should dismiss the surface underneath.
 *
 * A list, menu or popover open over the sheet closes first. None of them is
 * modal — a click outside one closes it and lands where it was aimed — so Reka
 * reports that pointerdown to every layer under it, the sheet's included, and
 * the click meant to close a select would close the dialog with it. While one
 * is open, the backdrop gesture belongs to it, as Escape does, and a second
 * click closes the sheet. A popover is marked `data-popover` by `UI/Popover.vue`
 * rather than matched by its role, since the sheet is a `dialog` too; a date
 * picker's calendar closed the sheet under it until it was listed here.
 */
const OPEN_LIST = [
  '[role="listbox"][data-state="open"]',
  '[role="menu"][data-state="open"]',
  '[data-popover][data-state="open"]',
].join(", ");

export const isBackdropInteraction = (event: PointerDownOutsideEvent) => {
  if (event.detail.originalEvent.button !== 0 || event.detail.originalEvent.ctrlKey) return false;
  const target = event.detail.originalEvent.target;
  if (!(target instanceof Element) || !target.closest(BACKDROP_SELECTOR)) return false;
  return !target.ownerDocument.querySelector(OPEN_LIST);
};

/**
 * Registers a modal surface with the one backdrop mounted at the app root.
 * The stack keeps dialogs and side panels from multiplying the blur, orders
 * their z-indexes, and leaves it visible until the last one closes.
 */
export const useDialogBackdrop = (isOpen?: () => boolean) => {
  const dialogId = Symbol("dialog");
  const dialogZIndex = computed(() => {
    const stackIndex = activeDialogs.value.indexOf(dialogId);
    return DIALOG_BASE_Z_INDEX + Math.max(0, stackIndex);
  });

  // The stack is the browser's. On the server this module serves every request
  // and nothing unmounts, so a dialog open during one render would hold the
  // backdrop over every page rendered after it.
  if (isOpen && !import.meta.server) {
    watch(
      isOpen,
      (open) => {
        removeDialog(dialogId);
        if (open) activeDialogs.value = [...activeDialogs.value, dialogId];
      },
      { immediate: true },
    );

    onScopeDispose(() => removeDialog(dialogId));
  }

  return { dialogZIndex, isDialogBackdropOpen };
};
