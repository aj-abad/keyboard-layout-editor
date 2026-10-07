import type { Component } from "vue";

/** A tool as the dock draws it: its name, its glyph, and its news while it isn’t showing. */
export interface ShellTool {
  readonly id: string;
  readonly name: string;
  /** The tool’s glyph, as on its button. Pass its working spinner while a turn runs. */
  readonly glyph: Component;
  /** A turn is running, for the tab’s name while the tool isn’t forward. */
  readonly working?: boolean;
  /** Replies the operator hasn’t seen, badged on the tab while the tool isn’t forward. */
  readonly unseen?: number;
}
