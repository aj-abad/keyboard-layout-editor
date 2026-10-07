/**
 * What the CLI's commands share: where Sine is, how a project's files are
 * found and named, and how Nuxt names a component.
 */
import { realpathSync } from "node:fs";
import { readdir } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import path from "node:path";

/** The package's root: its tokens, stylesheet and components. */
export const SINE_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

/** Rules and allowlists use forward-slash paths on every host, Windows included. */
export const toPosix = (file) => file.split(path.sep).join("/");

/**
 * A path as the file system has it, with links followed: an installed Sine is
 * reached through `node_modules`, and pnpm links that into its store.
 */
export const realDir = (dir) => {
  try {
    return realpathSync.native(dir);
  } catch {
    return path.resolve(dir);
  }
};

/** Whether `file` is `dir` or inside it, links followed. */
export const isWithin = (file, dir) => {
  const relative = path.relative(realDir(dir), realDir(file));
  return relative === "" || (!relative.startsWith("..") && !path.isAbsolute(relative));
};

/** Folders no project lints: installed packages, build output and dot-folders. */
const SKIPPED_DIRS = /^(?:node_modules|\.nuxt|\.output|\..+)$/;

/** The sources every rule reads. */
const SOURCE = /\.(vue|ts)$/;

/** Every `.vue` and `.ts` file under `dir`, or every file whose name matches `pattern`. */
export const walk = async (dir, pattern = SOURCE) => {
  const out = [];
  for (const entry of await readdir(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      if (!SKIPPED_DIRS.test(entry.name)) out.push(...(await walk(full, pattern)));
    } else if (pattern.test(entry.name)) out.push(full);
  }
  return out;
};

/** A folder a project names that it doesn't have is no files, not an error. */
export const walkIfThere = async (dir, pattern) => {
  try {
    return await walk(dir, pattern);
  } catch (error) {
    if (error?.code === "ENOENT") return [];
    throw error;
  }
};

const splitByCase = (s) =>
  s.split(/[-_/.]|(?<=[a-z0-9])(?=[A-Z])|(?<=[A-Z])(?=[A-Z][a-z])/).filter(Boolean);

/**
 * The name Nuxt gives a component file: the path's segments, with a file name
 * that repeats the directory's tail collapsed, so `<LocationsMapPrototype>`
 * and `<ChargingStationsRegisterStationSheet>` both resolve. Sine registers
 * `UI/` as a directory of its own, so its `UI/Card.vue` is `<Card>`; an app's
 * own `UI/Card.vue` is `<UICard>`, as Nuxt names it by default.
 */
export const nuxtComponentName = (name, { sine = false } = {}) => {
  const segments = name
    .replace(sine ? /^app\/components\/(?:UI\/)?/ : /^app\/components\//, "")
    .replace(/\.vue$/, "")
    .split("/");
  let file = segments.pop();
  if (file.toLowerCase() === "index") file = "";
  const prefix = splitByCase(segments.join("/"));
  const fileParts = splitByCase(file);
  const content = fileParts.join("/").toLowerCase();
  const nameParts = [...prefix];
  const suffix = [];
  for (let i = prefix.length - 1; i >= 0; i--) {
    suffix.unshift(prefix[i].toLowerCase());
    const joined = suffix.join("/");
    if (content === joined || content.startsWith(`${joined}/`)) nameParts.length = i;
  }
  return [...nameParts, ...fileParts].map((p) => p[0].toUpperCase() + p.slice(1)).join("");
};

/** Sine's components by the name an app uses: `[name, path from SINE_ROOT]`. */
export const sineComponents = async () =>
  (await walk(path.join(SINE_ROOT, "app/components")))
    .filter((file) => file.endsWith(".vue"))
    .map((file) => toPosix(path.relative(SINE_ROOT, file)))
    .map((file) => [nuxtComponentName(file, { sine: true }), file]);
