/**
 * The doctor, which `sine doctor` runs: whether an app is wired to Sine the way
 * the system needs.
 *
 * The lint reads how an app uses Sine's parts; this reads whether the parts are
 * there at all: the layer and its peers, the stylesheet Tailwind builds,
 * and what the shell mounts once. It also
 * finds what in the app quietly replaces part of Sine, which no build reports.
 * Nuxt gives an app's own component or auto-import the name over a layer's,
 * so the app's code that means Sine's runs the app's copy. Sine's own files
 * import what they use, so they keep Sine's either way; and an app that sets
 * `sine: { autoImports: false }` imports Sine by path, so no name stands in.
 *
 * It reads the app's resolved Nuxt config, and the component and auto-import
 * maps Nuxt writes into the build folder. It loads the config as `nuxt prepare`
 * (which an install runs) loads it, so the build folder is the one the maps
 * are in: once `.nuxt` exists, Nuxt sends a production build to a folder of
 * its own, which only `nuxt build` writes.
 */
import { existsSync, readFileSync } from "node:fs";
import { createRequire } from "node:module";
import path from "node:path";
import { SINE_ROOT, isWithin, realDir, sineComponents, toPosix, walkIfThere } from "./project.mjs";

const SINE_CSS = path.join(SINE_ROOT, "app/assets/sine.css");

/** Every check, in the order it runs and prints. */
export const CHECKS = {
  layer: "Sine is a layer of the app",
  peers: "Sine's peer dependencies are installed, in range",
  stylesheet: "Tailwind builds Sine's stylesheet",
  "dialog-backdrop": "the shell mounts `<DialogBackdrop>`",
  toasters: "the shell mounts `<SharedToasters>`",
  "glass-filters": "the shell mounts `<GlassFilters>`",
  "outside-click": "the shell calls `useOutsideClickSelection()`",
  shadowed: "nothing in the app replaces a Sine component or auto-import",
  "ui-prefix": "no tag names a Sine primitive by its old `UI` prefix",
};

/** Thrown for a project the doctor can't read at all: `sine` exits 2. */
export class DoctorError extends Error {}

/** HTML and script comments blanked, so a comment that names a tag isn't the tag. */
const stripComments = (source) =>
  source
    .replace(/<!--[\s\S]*?-->/g, (m) => m.replace(/[^\n]/g, " "))
    .replace(/(?<![\w"'/])\/\*[\s\S]*?\*\//g, (m) => m.replace(/[^\n]/g, " "))
    .replace(/(^|[^:\w])\/\/[^\n]*/g, (m, lead) => lead + " ".repeat(m.length - lead.length));

const lineOf = (text, index) => text.slice(0, index).split("\n").length;

/** A module path as Node finds it: as given, with an extension, or as a folder's index. */
const resolveModule = (file) =>
  ["", ".ts", ".mts", ".js", ".mjs", "/index.ts", "/index.js", "/index.mjs"]
    .map((ending) => file + ending)
    .find((candidate) => existsSync(candidate));

const samePath = (a, b) => realDir(a) === realDir(b);

/** The installed version of a package, found from `root` the way Node looks it up. */
const installedVersion = (name, root) => {
  const require = createRequire(path.join(root, "package.json"));
  for (const dir of require.resolve.paths(name) ?? []) {
    const file = path.join(dir, name, "package.json");
    if (existsSync(file)) return JSON.parse(readFileSync(file, "utf8")).version;
  }
  return undefined;
};

/**
 * Whether `version` is in `range`, for the ranges Sine states: `^x.y.z`,
 * `>=x.y.z` and an exact version, joined by `||`. Any other range passes.
 */
export const satisfies = (version, range) => {
  const parse = (v) =>
    v
      .replace(/^[=v\s]+/, "")
      .split(/[.+-]/)
      .slice(0, 3)
      .map(Number);
  const [major, minor, patch] = parse(version);
  const atLeast = ([a, b, c]) => (major !== a ? major > a : minor !== b ? minor > b : patch >= c);
  return range.split("||").some((part) => {
    const r = part.trim();
    if (r.startsWith("^")) {
      const floor = parse(r.slice(1));
      if (!atLeast(floor)) return false;
      if (floor[0] > 0) return major === floor[0];
      if (floor[1] > 0) return major === 0 && minor === floor[1];
      return major === 0 && minor === 0 && patch === floor[2];
    }
    if (r.startsWith(">=")) return atLeast(parse(r.slice(2)));
    if (/^\d+\.\d+\.\d+$/.test(r)) {
      const exact = parse(r);
      return major === exact[0] && minor === exact[1] && patch === exact[2];
    }
    return true;
  });
};

/** The names a folder of auto-imports exports, as Nuxt scans it: its files and each folder's index. */
const exportedNames = async (dir) => {
  const files = (await walkIfThere(dir)).filter((file) => {
    const relative = toPosix(path.relative(dir, file));
    if (/\.(?:test|stories|mock|d)\.ts$/.test(relative) || !relative.endsWith(".ts")) return false;
    return !relative.includes("/") || /^[^/]+\/index\.ts$/.test(relative);
  });
  const names = new Map();
  for (const file of files) {
    const text = stripComments(readFileSync(file, "utf8"));
    for (const m of text.matchAll(
      /^export\s+(?:async\s+)?(?:const|let|var|function\*?|class)\s+([A-Za-z_$][\w$]*)/gm,
    )) {
      names.set(m[1], file);
    }
    for (const m of text.matchAll(/^export\s*\{([^}]*)\}/gm)) {
      for (const part of m[1].split(",")) {
        const name = part
          .trim()
          .split(/\s+as\s+/)
          .pop()
          ?.trim();
        if (name && !/^type\b/.test(part.trim()) && name !== "default") names.set(name, file);
      }
    }
  }
  return names;
};

/** `name → file` from the auto-import map Nuxt writes, for imports from a file. */
const autoImportMap = (buildDir) => {
  const file = path.join(buildDir, "imports.d.ts");
  if (!existsSync(file)) return undefined;
  const map = new Map();
  for (const m of readFileSync(file, "utf8").matchAll(/^export \{([^}]*)\} from '([^']+)'/gm)) {
    const source = m[2];
    if (!source.startsWith(".") && !path.isAbsolute(source)) continue;
    for (const part of m[1].split(",")) {
      const name = part
        .trim()
        .split(/\s+as\s+/)
        .pop()
        ?.trim();
      if (name) map.set(name, path.resolve(buildDir, source));
    }
  }
  return map;
};

/** `name → file` from the component map Nuxt writes. */
const componentMap = (buildDir) => {
  const file = path.join(buildDir, "components.d.ts");
  if (!existsSync(file)) return undefined;
  const map = new Map();
  for (const m of readFileSync(file, "utf8").matchAll(
    /^export const (\w+): typeof import\("([^"]+)"\)/gm,
  )) {
    map.set(m[1], path.resolve(buildDir, m[2]));
  }
  return map;
};

/**
 * The maps Nuxt writes, from the build folder as the config resolves it, or
 * from the app's `.nuxt` when that folder has none: `nuxt prepare`, `nuxt dev`
 * and `nuxt typecheck` write there whichever folder a production build takes.
 * `components` and `imports` are unset when no folder searched has both.
 */
export const nuxtMaps = (root, buildDir) => {
  const searched = [
    ...new Set(
      [buildDir, path.join(root, ".nuxt")].filter(Boolean).map((dir) => path.resolve(dir)),
    ),
  ];
  for (const dir of searched) {
    const components = componentMap(dir);
    const imports = autoImportMap(dir);
    if (components && imports) return { dir, components, imports, searched };
  }
  return { searched };
};

/**
 * The app's Nuxt config, resolved as `nuxt prepare` resolves it. Without the
 * flag, an app whose `.nuxt` exists resolves its build folder to the one a
 * production build takes (`node_modules/.cache/nuxt/.nuxt`), which has no
 * maps until `nuxt build` runs, and stale ones after.
 */
export const loadAppConfig = async (root) => {
  let loadNuxtConfig;
  try {
    ({ loadNuxtConfig } = await import("nuxt/kit"));
  } catch (error) {
    throw new DoctorError(`couldn't load \`nuxt/kit\` (${error.message}): is \`nuxt\` installed?`);
  }
  return loadNuxtConfig({ cwd: root, overrides: { _prepare: true } });
};

/** An alias's target, or a path through one, resolved against the app's aliases. */
const throughAliases = (target, options) => {
  const aliases = Object.entries(options.alias ?? {}).sort(([a], [b]) => b.length - a.length);
  for (const [key, to] of aliases) {
    if (target === key) return to;
    if (target.startsWith(`${key}/`)) return path.join(to, target.slice(key.length + 1));
  }
  return path.resolve(options.rootDir, target);
};

/**
 * Checks the app at `root`. `accept` maps a check's id to the reason the
 * project passes it as it is. Resolves to each check with its status (`pass`,
 * `fail`, `accepted` or `skipped`) and what it found.
 */
export const doctor = async ({ root, accept = {} }) => {
  if (samePath(root, SINE_ROOT)) {
    throw new DoctorError(
      "this is Sine itself; `sine doctor` checks an app that uses it (run it there, or pass --root)",
    );
  }
  if (
    !["nuxt.config.ts", "nuxt.config.mjs", "nuxt.config.js"].some((f) =>
      existsSync(path.join(root, f)),
    )
  ) {
    throw new DoctorError(`no nuxt.config at ${root}: \`sine doctor\` checks a Nuxt app`);
  }

  const options = await loadAppConfig(root);
  const sinePackage = JSON.parse(readFileSync(path.join(SINE_ROOT, "package.json"), "utf8"));
  // A file as the app knows it: by its path in the app, or, for an installed
  // Sine, by the package's name rather than the store it is linked from.
  const inApp = (file) => {
    const relative = toPosix(path.relative(root, file));
    const outside =
      relative === ".." ||
      relative.startsWith("../") ||
      path.isAbsolute(relative) ||
      /(?:^|\/)node_modules\//.test(relative);
    return outside ? undefined : relative;
  };
  const rel = (file) =>
    inApp(file) ??
    (isWithin(file, SINE_ROOT)
      ? `${sinePackage.name}/${toPosix(path.relative(realDir(SINE_ROOT), realDir(file)))}`
      : toPosix(file));

  const warnings = Object.keys(accept)
    .filter((id) => !(id in CHECKS))
    .map((id) => `\`doctor.accept\` names \`${id}\`, which isn't a check`);
  const results = new Map();
  const report = (id, status, details = []) => {
    if (status === "pass" && accept[id]) {
      warnings.push(`\`doctor.accept\` lists \`${id}\`, which passes: the entry can go`);
    }
    results.set(id, {
      id,
      title: CHECKS[id],
      status: status === "fail" && accept[id] ? "accepted" : status,
      details,
      ...(status === "fail" && accept[id] ? { why: accept[id] } : {}),
    });
  };
  const done = () => ({ root, checks: [...results.values()], warnings });

  // The layer.
  const layer = (options._layers ?? []).find((l) => {
    const dir = l.cwd ?? l.config?.rootDir;
    return dir && samePath(dir, SINE_ROOT);
  });
  if (layer) {
    const layerDir = layer.cwd ?? layer.config.rootDir;
    report("layer", "pass", [
      `${sinePackage.name} ${sinePackage.version}${inApp(layerDir) ? ` (${inApp(layerDir)})` : ""}`,
    ]);
  } else {
    report("layer", "fail", [
      'the app doesn\'t extend Sine: add `extends: ["@arcon.mobi/sine"]` to its nuxt.config',
    ]);
  }

  // The peers, found from the app, where the app's build resolves them. An app
  // that doesn't extend Sine yet learns here whether its versions can.
  const { peerDependencies = {} } = sinePackage;
  const peerProblems = [];
  const peerVersions = [];
  for (const [name, range] of Object.entries(peerDependencies)) {
    const version = installedVersion(name, root);
    if (!version) peerProblems.push(`\`${name}\` isn't installed: Sine needs it at ${range}`);
    else if (!satisfies(version, range))
      peerProblems.push(`\`${name}\` is ${version}, outside Sine's ${range}`);
    else peerVersions.push(`${name} ${version}`);
  }
  report(
    "peers",
    peerProblems.length ? "fail" : "pass",
    peerProblems.length ? peerProblems : [peerVersions.join(", ")],
  );

  // Everything after this reads what the layer sets.
  if (!layer) {
    for (const id of Object.keys(CHECKS).slice(2)) report(id, "skipped", ["needs Sine as a layer"]);
    return done();
  }

  // The stylesheet. Sine's `cssPath` holds unless the app sets its own, and then
  // Tailwind builds the app's sheet in place of Sine's.
  const cssPath = options.tailwindcss?.cssPath;
  const sheet = Array.isArray(cssPath) ? cssPath[0] : cssPath;
  if (typeof sheet !== "string") {
    report("stylesheet", "fail", [
      "`tailwindcss.cssPath` is off, so no stylesheet is built: leave it unset, and Sine's applies",
    ]);
  } else {
    const file = throughAliases(sheet, options);
    if (samePath(file, SINE_CSS)) report("stylesheet", "pass", [rel(file)]);
    else if (
      existsSync(file) &&
      /@arcon\.mobi\/sine\/css|\bsine\.css\b/.test(readFileSync(file, "utf8"))
    )
      report("stylesheet", "pass", [`${rel(file)}, which imports Sine's`]);
    else
      report("stylesheet", "fail", [
        `Tailwind builds the app's ${rel(file)}, not Sine's stylesheet: leave \`tailwindcss.cssPath\` unset, and add the app's own CSS through \`css\``,
      ]);
  }

  // The shell: `app.vue` and the layouts.
  const srcDir = options.srcDir ?? path.join(root, "app");
  const shellFiles = [
    path.join(srcDir, "app.vue"),
    ...(await walkIfThere(path.join(srcDir, "layouts"))).filter((f) => f.endsWith(".vue")),
  ].filter((file) => existsSync(file));
  const shell = shellFiles.map((file) => stripComments(readFileSync(file, "utf8"))).join("\n");
  const shellNames = shellFiles.map(rel).join(", ") || "no `app.vue` or layout";
  const shellCheck = (id, pattern, consequence) =>
    pattern.test(shell)
      ? report(id, "pass")
      : report(id, "fail", [`not in ${shellNames}: ${consequence}`]);
  shellCheck(
    "dialog-backdrop",
    /<(?:Lazy)?DialogBackdrop\b|<(?:lazy-)?dialog-backdrop\b/,
    "a dialog or side panel opens with no scrim behind it (Components › Dialog)",
  );
  shellCheck(
    "toasters",
    /<(?:Lazy)?SharedToasters\b|<(?:lazy-)?shared-toasters\b/,
    "`useToast()` raises toasts nothing draws (Components › Toast)",
  );
  shellCheck(
    "glass-filters",
    /<(?:Lazy)?GlassFilters\b|<(?:lazy-)?glass-filters\b/,
    "a `.glass-*` surface keeps its keyline and draws no rim (Foundations › Glass)",
  );
  shellCheck(
    "outside-click",
    /\buseOutsideClickSelection\s*\(/,
    "a selection stays lit after a click elsewhere (Patterns › Text selection and copy)",
  );

  // What replaces Sine. Read from the maps Nuxt writes, which name the file
  // each component and auto-import resolved to.
  const { components, imports, searched } = nuxtMaps(root, options.buildDir);
  const sine = await sineComponents();
  if (!components || !imports) {
    const why = `no component or auto-import map in ${searched.map(rel).join(" or ")}: run \`nuxt prepare\` first`;
    report("shadowed", "skipped", [why]);
    report("ui-prefix", "skipped", [why]);
    return done();
  }

  // With Sine's auto-imports off, the app reaches Sine by path, and no name of
  // its own can stand in for one of Sine's.
  if (options.sine?.autoImports === false) {
    report("shadowed", "pass", ["Sine's auto-imports are off: the app imports Sine by path"]);
  } else {
    const shadowed = [];
    for (const [name, file] of sine) {
      const winner = components.get(name);
      if (winner && existsSync(winner) && !isWithin(winner, SINE_ROOT)) {
        shadowed.push(`<${name}> is the app's ${rel(winner)}, not Sine's ${file}`);
      }
    }
    const sineImports = new Map([
      ...(await exportedNames(path.join(SINE_ROOT, "app/composables"))),
      ...(await exportedNames(path.join(SINE_ROOT, "app/utils"))),
    ]);
    for (const [name, file] of sineImports) {
      const winner = imports.get(name);
      const winnerFile = winner && resolveModule(winner);
      if (winnerFile && !isWithin(winnerFile, SINE_ROOT)) {
        shadowed.push(
          `\`${name}\` is the app's ${rel(winnerFile)}, not Sine's ${toPosix(path.relative(SINE_ROOT, file))}`,
        );
      }
    }
    report(
      "shadowed",
      shadowed.length ? "fail" : "pass",
      shadowed.length
        ? [
            ...shadowed,
            "the app's code that names one of these gets the app's copy, not Sine's: delete the app's copy, rename it, or set `sine: { autoImports: false }` and import Sine's by path",
          ]
        : [],
    );
  }

  // A tag still named the old way: it resolves to nothing, unless the app
  // keeps a `UI/` component of its own by that name.
  const sineNames = new Set(sine.map(([name]) => name));
  const leftovers = [];
  for (const file of (await walkIfThere(srcDir)).filter((f) => f.endsWith(".vue"))) {
    const text = stripComments(readFileSync(file, "utf8"));
    for (const m of text.matchAll(/<UI([A-Z]\w*)\b/g)) {
      if (components.has(`UI${m[1]}`) || !sineNames.has(m[1])) continue;
      leftovers.push(`${rel(file)}:${lineOf(text, m.index)}  <UI${m[1]}> is <${m[1]}>`);
    }
  }
  report("ui-prefix", leftovers.length ? "fail" : "pass", leftovers);

  return done();
};

/** The checks as text: what `sine doctor` prints. */
export const formatDoctor = (result) => {
  const label = { pass: "ok", fail: "FAIL", accepted: "accepted", skipped: "skipped" };
  const out = [`sine doctor: ${toPosix(result.root)}`, ""];
  for (const check of result.checks) {
    out.push(`  ${label[check.status].padEnd(9)} ${check.id.padEnd(17)} ${check.title}`);
    const notes =
      check.status === "accepted" ? [`accepted: ${check.why}`, ...check.details] : check.details;
    for (const note of notes) out.push(`  ${" ".repeat(9)} ${" ".repeat(17)}   ${note}`);
  }
  if (result.warnings.length) out.push("");
  for (const warning of result.warnings) out.push(`sine doctor: warning — ${warning}`);
  const failed = result.checks.filter((c) => c.status === "fail").length;
  const accepted = result.checks.filter((c) => c.status === "accepted").length;
  const skipped = result.checks.filter((c) => c.status === "skipped").length;
  const tail = [accepted && `${accepted} accepted`, skipped && `${skipped} skipped`].filter(
    Boolean,
  );
  out.push(
    "",
    failed
      ? `sine doctor: ${failed} of ${result.checks.length} checks failed`
      : `sine doctor: clean — ${result.checks.length} checks${tail.length ? `, ${tail.join(", ")}` : ""}`,
  );
  return out.join("\n");
};
