import { pushShortcutBlocker, popShortcutBlocker } from "./commandRegistry";

/**
 * Blocks keyboard shortcuts while the given ref is true.
 * Use when dropdowns, context menus, or other overlays are open
 * so that shortcut keys (including sequential ones) don't fire.
 */
export function useShortcutBlocker(isOpen: MaybeRef<boolean>) {
  const openRef = isRef(isOpen) ? isOpen : ref(isOpen);

  // Only a blocker that was pushed is popped: one that starts closed must not
  // take away the block of an overlay that is already open.
  watch(
    openRef,
    (open, wasOpen) => {
      if (open) pushShortcutBlocker();
      else if (wasOpen) popShortcutBlocker();
    },
    { immediate: true },
  );

  onUnmounted(() => {
    if (openRef.value) popShortcutBlocker();
  });
}
