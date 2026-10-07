/** A file the config names: a pattern over its path from the project's root, or that path. */
export interface SineFiles {
  /** A RegExp over the path, or the path itself; a path ending in `/` covers what is under it. */
  glob: RegExp | string;
  why: string;
}

/** One allowed case of a rule: a whole file, or one literal in it. */
export interface SineException {
  /** The path from the project's root, with forward slashes. */
  file: string;
  /** The literal allowed. Without it, the whole file is. */
  match?: string;
  why: string;
}

/** The rules a project can allow a file under. */
export type SineExceptionRule =
  | "literal-colour"
  | "unknown-token"
  | "state-transition"
  | "reduced-motion"
  | "squircle"
  | "raw-input"
  | "raw-table"
  | "empty-value"
  | "layer-number"
  | "icon-size"
  | "glass-light"
  | "ssr-global";

/** The checks `sine doctor` runs that a project can accept as they are. */
export type SineDoctorCheck =
  | "layer"
  | "peers"
  | "stylesheet"
  // Deprecated: accepted for hosts also using Sine <0.6. No longer checked.
  | "help-alias"
  | "connection-alias"
  | "dialog-backdrop"
  | "toasters"
  | "glass-filters"
  | "outside-click"
  | "shadowed"
  | "ui-prefix";

export interface SineConfig {
  lint?: {
    /** The folders to read, from the project's root. Default `["app"]`. */
    include?: string[];
    /** `false` for an app that never renders on the server: the `ssr-*` rules are skipped. */
    ssr?: boolean;
    /** Files the colour, typography and motion rules do not read. */
    unchecked?: SineFiles[];
    /** Files the copy rules do not read. */
    copyUnchecked?: SineFiles[];
    /** Words a label may capitalise, because they are names. */
    properNouns?: string[];
    exceptions?: Partial<Record<SineExceptionRule, SineException[]>>;
  };
  doctor?: {
    /** A check the project passes as it is, with the reason. */
    accept?: Partial<Record<SineDoctorCheck, string>>;
  };
}

export declare const CONFIG_FILES: string[];
export declare const defineConfig: (config: SineConfig) => SineConfig;
export declare const loadConfig: (
  root: string,
) => Promise<{ file: string | undefined; config: SineConfig }>;
