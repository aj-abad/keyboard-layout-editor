import { realpathSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { defineNuxtModule } from "nuxt/kit";

export interface SineOptions {
  /**
   * Whether the app reaches Sine's components, composables and utilities by
   * name, with no import: `<Button>`, `cn()`. Off, the app imports each one
   * by path through `#layers/sine/…`, as Sine's own files import each other,
   * and nothing of Sine's enters the app's global names. Either way Sine's
   * files run the same: none of them leans on an auto-import.
   */
  autoImports: boolean;
}

/** A path as one spelling: forward slashes, links followed, case folded on Windows. */
const canonical = (dir: string) => {
  let real = dir;
  try {
    real = realpathSync(dir);
  } catch {
    // A folder Nuxt lists but nobody created yet keeps its spelling.
  }
  const posix = real.replace(/\\/g, "/").replace(/\/$/, "");
  return process.platform === "win32" ? posix.toLowerCase() : posix;
};

const SINE_APP = canonical(fileURLToPath(new URL("./app", import.meta.url)));
const inSine = (dir: string) => {
  const path = canonical(dir);
  return path === SINE_APP || path.startsWith(`${SINE_APP}/`);
};

/**
 * Sine's options, under `sine` in the app's nuxt.config. Nuxt scans every
 * layer's components, composables and utilities into the app's names; with
 * `autoImports: false` this takes Sine's folders out of both scans before
 * they run, through the hooks Nuxt calls once every module is set up.
 */
export default defineNuxtModule<SineOptions>({
  meta: { name: "sine", configKey: "sine" },
  defaults: { autoImports: true },
  setup(options, nuxt) {
    if (options.autoImports) return;
    nuxt.hook("components:dirs", (dirs) => {
      const kept = dirs.filter((dir) => !inSine(typeof dir === "string" ? dir : dir.path));
      dirs.splice(0, dirs.length, ...kept);
    });
    nuxt.hook("imports:dirs", (dirs) => {
      const kept = dirs.filter((dir) => !inSine(dir));
      dirs.splice(0, dirs.length, ...kept);
    });
  },
});
