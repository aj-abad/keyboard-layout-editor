import { useEventListener } from "@vueuse/core";

/** How far a press may travel, in CSS pixels, and still be a click. */
const CLICK_SLOP = 4;

/**
 * Whether text in this element can be selected: the nearest `user-select`
 * that is not `auto`, from the element up. Chrome resolves `auto` into the
 * computed value and answers at the element; Firefox leaves it `auto` and
 * answers at the ancestor that set it.
 */
const isSelectable = (element: Element) => {
  for (let node: Element | null = element; node; node = node.parentElement) {
    const style = getComputedStyle(node);
    const value =
      style.getPropertyValue("user-select") || style.getPropertyValue("-webkit-user-select");
    if (value && value !== "auto") return value !== "none";
  }
  return true;
};

/**
 * What happens to a text selection when a click lands outside selectable text.
 *
 * Text is selectable only where it has to be (Patterns › Text selection and
 * copy), so a highlight is made inside a value, a payload or a help article,
 * and the click that comes next usually lands on something that cannot be
 * selected: a row, a button, the canvas. Chrome keeps the highlight then. A
 * press on unselectable content starts no selection, so it clears none, and
 * only a press on selectable text would. The highlight would stay after the
 * operator has moved on, and a later Copy would copy it. This clears it, as a
 * click outside a native text view does.
 *
 * A drag is not a click: a press that travels, like a scrollbar thumb, a
 * slider or a lasso, keeps the highlight, and so does a click the keyboard
 * made. The app shell calls this once.
 */
export const useOutsideClickSelection = () => {
  let press: { x: number; y: number } | null = null;

  useEventListener(
    "pointerdown",
    (event: PointerEvent) => {
      press = event.isPrimary && event.button === 0 ? { x: event.clientX, y: event.clientY } : null;
    },
    { capture: true, passive: true },
  );

  useEventListener(
    "click",
    (event: MouseEvent) => {
      const from = press;
      press = null;
      // `detail` is 0 for a click the keyboard made.
      if (!from || event.detail === 0) return;
      if (Math.hypot(event.clientX - from.x, event.clientY - from.y) > CLICK_SLOP) return;
      const selection = document.getSelection();
      if (!selection || selection.isCollapsed) return;
      if (!(event.target instanceof Element) || isSelectable(event.target)) return;
      selection.removeAllRanges();
    },
    { capture: true, passive: true },
  );
};
