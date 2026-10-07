/** A native element or a component exposing focus(), such as Input. */
export type SheetFocusTarget = string | { focus: (options?: FocusOptions) => void } | null;

/**
 * Reka owns the focus trap and restoration. Sheets choose the entry point and
 * forward both cancelable events, so callers never need an autofocus timer.
 */
export const useSheetFocus = (
  initialFocus: () => SheetFocusTarget | undefined,
  emitOpenAutoFocus: (event: Event) => void,
) => {
  const handleOpenAutoFocus = async (event: Event) => {
    emitOpenAutoFocus(event);
    if (event.defaultPrevented) return;
    event.preventDefault();

    const content = event.target;
    if (!(content instanceof HTMLElement)) return;
    await nextTick();
    if (!content.isConnected || content.dataset.state !== "open") return;

    const target = initialFocus();
    if (target === "none") return;
    const fallback = content.querySelector<HTMLElement>("[data-sheet-body]") ?? content;
    let resolved: Exclude<SheetFocusTarget, string | null> | null = null;
    if (typeof target === "string") {
      // A stale or invalid selector should still leave focus inside the sheet.
      try {
        resolved = content.querySelector<HTMLElement>(target);
      } catch {
        resolved = null;
      }
    } else {
      resolved = target ?? null;
    }
    (resolved ?? fallback).focus({ preventScroll: true });
    if (!content.contains(content.ownerDocument.activeElement))
      fallback.focus({ preventScroll: true });
  };

  return { handleOpenAutoFocus };
};
