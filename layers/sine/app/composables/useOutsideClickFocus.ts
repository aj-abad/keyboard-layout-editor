/**
 * Where focus goes when a list that is not modal closes on a click outside it.
 *
 * A list of options is not modal: a click outside it closes it and lands where
 * it was aimed, so a click on the next trigger in a filter bar opens that one in
 * the same click. The focus that click gave has to stay where it landed. Reka's
 * select hands focus back to its trigger when the list unmounts, a beat after
 * the next list has taken it, which would pull the operator back and close the
 * list they just opened. So a click that landed on a control keeps its focus,
 * as Reka's non-modal dropdown menu does, and a click on nothing brings focus
 * home to the trigger, where the keyboard left it. So does a click on the
 * list's own trigger, which closes it: Reka keeps a pointer from focusing its
 * trigger, so that click would otherwise leave the focus nowhere.
 *
 * Reka returns that focus when the list's exit ends, not when it closes, and
 * `returning` covers the gap: it is true from the close until the focus is
 * back, for a close that is sending it back. The trigger holds its ring and its
 * name meanwhile, which would otherwise drop out for the length of the exit
 * and come back.
 *
 * `trigger` finds the list's own trigger.
 *
 * ```vue
 * <SelectRoot @update:open="onOpenChange">
 *   <SelectTrigger :focus-returning="returning" />
 *   <SelectContent
 *     :body-lock="false"
 *     :disable-outside-pointer-events="false"
 *     @pointer-down-outside="onPointerDownOutside"
 *     @close-auto-focus="onCloseAutoFocus">
 * ```
 *
 * A popover passes `focusTrigger`, and `UI/Popover.vue` is the one caller that
 * does. Reka's select always hands the focus back unless told not to; its
 * non-modal popover hands it back only when nothing outside was touched, so
 * after a click on nothing the focus stayed on the page's body. With
 * `focusTrigger` this brings it home itself. A popover also closes when Tab
 * carries the focus out of it, and `onFocusOutside` treats the control the Tab
 * reached as a click would: it keeps the focus.
 */

const FOCUSABLE = "button, a[href], input, select, textarea, [tabindex]:not([tabindex='-1'])";

export const useOutsideClickFocus = (
  trigger: () => Element | null | undefined,
  { focusTrigger = false }: { focusTrigger?: boolean } = {},
) => {
  let landedOnControl = false;
  const returning = shallowRef(false);

  const landOn = (target: EventTarget | null) => {
    landedOnControl =
      target instanceof Element &&
      !trigger()?.contains(target) &&
      Boolean(target.closest(FOCUSABLE));
  };

  const onPointerDownOutside = (event: CustomEvent<{ originalEvent: PointerEvent }>) => {
    landOn(event.detail.originalEvent.target);
  };

  const onFocusOutside = (event: CustomEvent<{ originalEvent: FocusEvent }>) => {
    landOn(event.detail.originalEvent.target);
  };

  // Reka dismisses after the outside event, so a close already knows where
  // the click landed. An open starts clean: an outside event that closed
  // nothing says nothing about the next close.
  const onOpenChange = (open: boolean) => {
    if (open) landedOnControl = false;
    returning.value = !open && !landedOnControl;
  };

  // A caller that already placed the focus itself has prevented the event.
  const onCloseAutoFocus = (event: Event) => {
    if (landedOnControl) {
      event.preventDefault();
    } else if (focusTrigger && !event.defaultPrevented) {
      event.preventDefault();
      const home = trigger();
      if (home instanceof HTMLElement) home.focus({ preventScroll: true });
    }
    landedOnControl = false;
    returning.value = false;
  };

  return { returning, onOpenChange, onPointerDownOutside, onFocusOutside, onCloseAutoFocus };
};
