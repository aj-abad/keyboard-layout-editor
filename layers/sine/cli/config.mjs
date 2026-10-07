/**
 * A project's Sine config: `sine.config.ts`, `.mjs`, `.js` or `.json` at its
 * root, which `sine lint` and `sine doctor` read. Every allowlist in it carries
 * its reason, as the lint's own do.
 *
 *   // sine.config.ts
 *   import { defineConfig } from "@arcon.mobi/sine/config";
 *
 *   export default defineConfig({
 *     lint: {
 *       exceptions: {
 *         "raw-table": [{ file: "app/components/Sheet.vue", why: "a spreadsheet grid" }],
 *       },
 *     },
 *   });
 */
import { existsSync } from "node:fs";
import path from "node:path";
import { createJiti } from "jiti";

export const CONFIG_FILES = [
  "sine.config.ts",
  "sine.config.mts",
  "sine.config.mjs",
  "sine.config.js",
  "sine.config.json",
];

/** Types a config in an editor, and returns it as it is. */
export const defineConfig = (config) => config;

/** The first config file at `root`, read; none is an empty config. */
export const loadConfig = async (root) => {
  for (const name of CONFIG_FILES) {
    const file = path.join(root, name);
    if (!existsSync(file)) continue;
    // Through jiti, so a TypeScript config loads inside `node_modules` too.
    const jiti = createJiti(import.meta.url, { moduleCache: false });
    const config = await jiti.import(file, { default: true });
    return { file, config: config ?? {} };
  }
  return { file: undefined, config: {} };
};
