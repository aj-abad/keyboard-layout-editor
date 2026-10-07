/**
 * The shell’s tools, and where each one is (Patterns › Shell).
 *
 * A tool opens from its button in the top bar as a popover over the page, one
 * at a time. Pinned, it moves into the dock, the card on the canvas that
 * pinned tools share, and from then on every tool opens there: one pinned
 * tool keeps the popover’s head, a second brings the tab strip. The dock
 * collapses with its pins kept, and any pinned tool’s button brings it back.
 *
 * Pure functions over a plain state, so a host can keep the state where it
 * likes, remember the pins between loads, and test what a press does without
 * a component. `useShellTools` wraps them for a component tree.
 */
export interface ShellToolsState {
  /** The tool open as a popover. Never set while anything is pinned. */
  readonly popover: string | null;
  /** The pinned tools, in the dock’s order. */
  readonly pinned: readonly string[];
  /** The pinned tool whose tab is forward. */
  readonly forward: string | null;
  /** The dock is hidden, with its pins kept. */
  readonly collapsed: boolean;
}

export const SHELL_TOOLS_AT_REST: ShellToolsState = {
  popover: null,
  pinned: [],
  forward: null,
  collapsed: false,
};

/**
 * Where a tool is: open as the popover, forward in the dock, pinned behind
 * another tab or a collapsed dock, or shut.
 */
export type ShellToolPlace = "popover" | "forward" | "pinned" | "shut";

export const placeOfTool = (state: ShellToolsState, id: string): ShellToolPlace => {
  if (state.popover === id) return "popover";
  if (!state.pinned.includes(id)) return "shut";
  return state.forward === id && !state.collapsed ? "forward" : "pinned";
};

/** The tool is on screen: its popover is open, or its tab is forward in a dock that is up. */
export const isToolShowing = (state: ShellToolsState, id: string): boolean => {
  const place = placeOfTool(state, id);
  return place === "popover" || place === "forward";
};

/** Something is pinned, and the dock isn’t collapsed. */
export const isDockUp = (state: ShellToolsState): boolean =>
  state.pinned.length > 0 && !state.collapsed;

/** The tool comes forward in the dock, joining it if it wasn’t pinned; a collapsed dock comes back. */
const bringForward = (state: ShellToolsState, id: string): ShellToolsState => ({
  popover: null,
  pinned: state.pinned.includes(id) ? state.pinned : [...state.pinned, id],
  forward: id,
  collapsed: false,
});

/**
 * A press on a tool’s button: show me this. With nothing pinned the popover is
 * a disclosure, so the open tool’s button shuts it and another tool’s button
 * swaps it in. With something pinned the tool comes forward in the dock, and
 * no press on a button shuts the dock.
 */
export const pressTool = (state: ShellToolsState, id: string): ShellToolsState => {
  if (state.pinned.length > 0) return bringForward(state, id);
  return { ...state, popover: state.popover === id ? null : id };
};

/** Show a tool without a toggle: from the palette, its chord or a handoff. */
export const showTool = (state: ShellToolsState, id: string): ShellToolsState =>
  state.pinned.length > 0 ? bringForward(state, id) : { ...state, popover: id };

export const closePopover = (state: ShellToolsState): ShellToolsState =>
  state.popover === null ? state : { ...state, popover: null };

/** The popover’s pin: its tool moves into the dock. */
export const pinTool = (state: ShellToolsState): ShellToolsState =>
  state.popover === null
    ? state
    : { popover: null, pinned: [state.popover], forward: state.popover, collapsed: false };

/** The one pinned tool’s pin, pressed again: it floats back as the popover. */
export const floatTool = (state: ShellToolsState): ShellToolsState => {
  const [only] = state.pinned;
  if (only === undefined || state.pinned.length !== 1) return state;
  return { popover: only, pinned: [], forward: null, collapsed: false };
};

/**
 * A tab’s close: the tool is unpinned and shut. The tab after it comes
 * forward, or the one before it, and the dock goes with its last tab.
 */
export const closeTab = (state: ShellToolsState, id: string): ShellToolsState => {
  const index = state.pinned.indexOf(id);
  if (index < 0) return state;
  const pinned = state.pinned.filter((tool) => tool !== id);
  const forward =
    state.forward === id ? (pinned[index] ?? pinned[index - 1] ?? null) : state.forward;
  return { ...state, pinned, forward, collapsed: pinned.length > 0 && state.collapsed };
};

/** A tab, pressed: it comes forward. */
export const selectTab = (state: ShellToolsState, id: string): ShellToolsState =>
  state.pinned.includes(id) ? { ...state, forward: id, collapsed: false } : state;

/** The dock’s collapse: hidden, pins kept. */
export const collapseDock = (state: ShellToolsState): ShellToolsState =>
  state.pinned.length === 0 ? state : { ...state, collapsed: true };

/** What a host remembers between loads: the pins and the collapse, never a popover. */
export interface ShellToolsMemory {
  readonly pinned: readonly string[];
  readonly forward: string | null;
  readonly collapsed: boolean;
}

export const rememberShellTools = (state: ShellToolsState): ShellToolsMemory => ({
  pinned: state.pinned,
  forward: state.forward,
  collapsed: state.collapsed,
});

/**
 * A remembered state, checked against the tools the host has: a pin on a tool
 * that is gone is dropped, a forward tab that isn’t pinned falls back to the
 * first, and a popover never comes back.
 */
export const restoreShellTools = (
  memory: Partial<ShellToolsMemory> | null | undefined,
  known: readonly string[],
): ShellToolsState => {
  const pinned = (memory?.pinned ?? []).filter(
    (id, index, all) => known.includes(id) && all.indexOf(id) === index,
  );
  const remembered = memory?.forward ?? null;
  const forward =
    remembered !== null && pinned.includes(remembered) ? remembered : (pinned[0] ?? null);
  return {
    popover: null,
    pinned,
    forward,
    collapsed: pinned.length > 0 && memory?.collapsed === true,
  };
};
