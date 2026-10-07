import { computed, shallowRef, type ShallowRef } from "vue";
import {
  SHELL_TOOLS_AT_REST,
  closePopover,
  closeTab,
  collapseDock,
  floatTool,
  isDockUp,
  isToolShowing,
  pinTool,
  placeOfTool,
  pressTool,
  rememberShellTools,
  restoreShellTools,
  selectTab,
  showTool,
  type ShellToolsMemory,
  type ShellToolsState,
} from "../utils/shellTools";

/**
 * The shell’s tools for a component tree: the state and the moves on it, as
 * `utils/shellTools` defines them (Patterns › Shell). Keep one instance for
 * the shell, at module scope or provided from the layout, so the top bar’s
 * buttons, the popover and the dock read the same state.
 *
 * Persistence is the host’s: write `remember()` where it keeps preferences,
 * and `restore()` it on load with the tools it has.
 */
export const useShellTools = (initial: ShellToolsState = SHELL_TOOLS_AT_REST) => {
  const state: ShallowRef<ShellToolsState> = shallowRef(initial);
  const apply = (next: ShellToolsState) => {
    if (next !== state.value) state.value = next;
  };

  return {
    state,
    /** The dock is up: something is pinned and it isn’t collapsed. */
    dockUp: computed(() => isDockUp(state.value)),
    placeOf: (id: string) => placeOfTool(state.value, id),
    showing: (id: string) => isToolShowing(state.value, id),
    /** A tool’s button. */
    press: (id: string) => apply(pressTool(state.value, id)),
    /** The palette, a chord or a handoff. */
    show: (id: string) => apply(showTool(state.value, id)),
    closePopover: () => apply(closePopover(state.value)),
    pin: () => apply(pinTool(state.value)),
    float: () => apply(floatTool(state.value)),
    closeTab: (id: string) => apply(closeTab(state.value, id)),
    select: (id: string) => apply(selectTab(state.value, id)),
    collapse: () => apply(collapseDock(state.value)),
    remember: () => rememberShellTools(state.value),
    restore: (memory: Partial<ShellToolsMemory> | null | undefined, known: readonly string[]) =>
      apply(restoreShellTools(memory, known)),
  };
};

export type ShellTools = ReturnType<typeof useShellTools>;
