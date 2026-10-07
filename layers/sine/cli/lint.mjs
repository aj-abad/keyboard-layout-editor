/**
 * The design lint, which `sine lint` runs.
 *
 * Sine's pages are the specification; this is the half of them a machine can
 * hold. Every rule here exists because the thing it forbids had already
 * happened, more than once, and neither `typecheck` nor `build` has an opinion
 * about any of it — a literal hex compiles, a `transition-colors` compiles, a
 * `bg-accent` compiles to no CSS at all, and a component class that collides
 * with a Tailwind utility compiles and then silently loses at runtime.
 *
 * It reads one project: the folders a `sine.config.*` names under `lint.include`
 * (an app's `app/` by default), against Sine's own tokens, stylesheet and
 * components. Sine lints itself the same way, from `layers/sine`, whose config
 * names the design system's three folders.
 *
 * Allowlists live in that config, and each entry carries the reason it is one.
 * That is deliberate: an exception nobody can justify in a sentence is a
 * violation waiting to be re-litigated, and an ignore-file with no reasons
 * makes it too cheap to add one. Growing a list should feel like an argument,
 * because it is.
 */
import { readFileSync } from "node:fs";
import path from "node:path";
import { createJiti } from "jiti";
import postcss from "postcss";
import tailwindcss from "tailwindcss";
import { SINE_ROOT, nuxtComponentName, realDir, toPosix, walk, walkIfThere } from "./project.mjs";

// Through jiti rather than `import`: Node strips a TypeScript file's types only
// outside `node_modules`, and an installed package lives inside it.
const jiti = createJiti(import.meta.url);
const { borderColor, colors, iconSize, plugins, theme } = await jiti.import(
  path.join(SINE_ROOT, "tailwind.config.ts"),
);

/* ------------------------------------------------------------------ *
 * Allowlists
 * ------------------------------------------------------------------ */

/**
 * Files the colour, typography and motion rules do not read, in every project.
 * A project adds its own under `lint.unchecked`. Icon imports, weight props and
 * dragging links are checked in every source, including stories
 * (`READ_EVERYWHERE`).
 *
 * Stories and mocks are not app chrome: a story's backdrop exists to put a
 * glass menu on something saturated, and a mock's job is to be data.
 */
const UNCHECKED = [
  { glob: /\.stories\.ts$/, why: "a story backdrop is a test surface, not app chrome" },
  { glob: /\.mock\.ts$/, why: "fixtures are data" },
];

/** The rules that read the `UNCHECKED` files too: what they hold is true of an example as well. */
const READ_EVERYWHERE = new Set(["icon-family", "icon-weight", "link-drag"]);

/**
 * The rule ids a project's `lint.exceptions` can allow a file under, each with
 * what an exception there means. An entry is `{ file, why }` for the whole file,
 * or `{ file, match, why }` for one literal in it.
 */
export const EXCEPTION_RULES = {
  "literal-colour": "a colour literal a file states on purpose",
  "unknown-token":
    "a colour class Tailwind emits nothing for, which a stylesheet the lint doesn't read defines",
  "state-transition": "`transition-colors` on a state change",
  "reduced-motion": "JavaScript motion that does not read the operator's preference",
  squircle: "a filled box at radius >= 12px, or a pill, drawn with `rounded-*`",
  "raw-input": "a raw `<input>` rather than `Input`",
  "raw-table": "a raw `<table>` rather than `Table`",
  "empty-value": "an em dash written as a whole value",
  "layer-number": "an app layer written as a number",
  "icon-size": "a glyph drawn at a size off the ladder",
  "glass-light": "a lighting filter of a component's own",
  "ssr-global": "a browser global read at the top of a module",
};

/* ------------------------------------------------------------------ *
 * Rules
 * ------------------------------------------------------------------ */

const COLOUR_FAMILIES =
  "slate|gray|zinc|neutral|stone|red|orange|amber|yellow|lime|green|emerald|teal|cyan|sky|blue|indigo|violet|purple|fuchsia|pink|rose";
const UTILITY_PREFIXES =
  "text|bg|border|fill|stroke|ring|divide|from|via|to|placeholder|decoration|outline|shadow|accent|caret";

const RULES = [
  {
    id: "literal-colour",
    hint: "use a token — `ink-*`, `fill-*`, `surface-*`, `line*`, or a tone through `utils/status.ts`",
    pattern: new RegExp(`\\b(?:${UTILITY_PREFIXES})-(?:${COLOUR_FAMILIES})-\\d{2,3}\\b`, "g"),
  },
  {
    /*
     * `white/N` was three unrelated problems wearing one spelling, which is why
     * it took a sweep of its own rather than a rename: glass written out by
     * hand, a surface nested on glass, and a light rim on a *dark* surface. Each
     * has its own token now — the glass scale, `fill-*`, and `fill-inverse-*` /
     * `line-inverse` — so the rule can read both alphas.
     */
    id: "literal-colour",
    hint: "`black/N` and `white/N` are not tokens; `ink-*`, `fill-*` and `fill-inverse-*` are the same alphas by name",
    pattern: new RegExp(`\\b(?:${UTILITY_PREFIXES})-(?:black|white)/\\d+`, "g"),
  },
  {
    id: "literal-colour",
    hint: "import the value from the Tailwind config (`tailwind.config.ts`), or name it in `utils/chart.ts` if it is a chart's",
    pattern: /#[0-9a-fA-F]{3}(?:[0-9a-fA-F]{3}(?:[0-9a-fA-F]{2})?)?\b/g,
    /*
     * A hex inside a `mask-image` is an alpha channel, not a colour: the
     * gradient's `#000` means "opaque here", and swapping it for a token would
     * change nothing about the pixel and lose the meaning.
     */
    skip: (text, index) => /mask/i.test(text.slice(text.lastIndexOf(";", index) + 1, index)),
  },
  {
    /*
     * The line tokens are translucent since 2026-09-28, and Tailwind gives an
     * alpha colour a modifier's alpha instead of scaling its own:
     * `border-line/50` compiles to black at 50%, a near-black rule where a
     * fainter hairline was meant. `line-inverse` has always been alpha.
     */
    id: "line-modifier",
    hint: "`line`, `line-strong` and `line-inverse` are already translucent, and an opacity modifier replaces their alpha rather than scaling it (`border-line/50` is black at 50%) — use the token as it is",
    pattern: new RegExp(
      `\\b(?:${UTILITY_PREFIXES})(?:-[xytrblse])?-line(?:-(?:strong|inverse))?\\/[\\w.[\\]]+`,
      "g",
    ),
  },
  {
    /*
     * A `Squircle`'s surface layer is an absolutely-positioned **sibling** of
     * the content, not an ancestor of it, so a bare `hover:` there matches only
     * while the pointer is over the surface itself — which the content is
     * covering. The state silently never arrives.
     *
     * `group-hover:` is the spelling that works, with `group` on the squircle
     * root, and it is what `Overview/AttentionList.vue` and three others use.
     * Four files had the broken one, including both Payments rows, and nothing
     * failed: the class is emitted, the build passes, and the row just does not
     * light up.
     */
    id: "surface-state",
    hint: "a `surfaceClass` state needs `group-hover:`/`group-active:` with `group` on the root — the surface layer is a sibling of the content, so a bare `hover:` never matches",
    pattern:
      /(?::?surface-class|surfaceClass)\s*=\s*(["'])(?:(?!\1)[\s\S])*?(?<![\w-])(?:hover|active|focus|focus-visible):(?:(?!\1)[\s\S])*?\1/g,
  },
  {
    id: "state-transition",
    hint: "state colour lands on the next frame (decision 11) — transition the property that moves, not the colour beside it",
    pattern: /\btransition-(?:colors|all)\b/g,
  },
  {
    id: "literal-motion",
    hint: "durations and easings are tokens — `duration-fast`, `ease-standard` (see `utils/motion.ts`)",
    pattern: /\b(?:duration|ease)-\[[^\]]+\]/g,
  },
  {
    /*
     * A component that animates in JavaScript has to read the preference,
     * because nothing else can read it for it: the global block in
     * `assets/sine.css` reaches every CSS transition and keyframe in the
     * app, and stops dead at `motion-v`. Twenty components were on the wrong
     * side of that line — both station forms, the sidebar indicator, the inbox
     * popover and both layouts among them.
     *
     * `requires` is satisfied by naming any of the house helpers, each of which
     * resolves its own timing through the tokens: `useMotionTokens`,
     * `useMotionSpring` and `useMotionTransition` from `utils/motion.ts`, or
     * `useReducedMotion` itself where a component's motion changes *shape*
     * rather than only timing.
     */
    id: "reduced-motion",
    hint: "JS motion has to honour `prefers-reduced-motion` — take the timing from `useMotionTokens()` / `useMotionSpring()` / `useMotionTransition()` (`utils/motion.ts`), or branch on `useReducedMotion()`",
    pattern:
      /import\s*\{[^}]*\b(?:motion|animate|AnimatePresence|useSpring|useAnimate|stagger)\b[^}]*\}\s*from\s*["']motion-v["']/g,
    requires: /\buse(?:MotionTokens|MotionSpring|MotionTransition|ReducedMotion)\b/,
    files: /^app\//,
  },
  {
    id: "squircle-smoothing",
    hint: "omit the smoothing prop — every design-system squircle inherits the single 0.7 default",
    pattern: /(?::smoothing|v-bind:smoothing|\bsmoothing)(?:\s*=\s*["']|\s*:)/g,
    files: /\.vue$/,
  },
  {
    /*
     * The one light has one lighting filter: the glass rim, which both glass
     * renderers draw from `glassEdge` and `lighting` in `tailwind.config.ts`.
     * A component that lights an edge with numbers of its own has put a second
     * light in the scene, and its highlight falls where no shadow agrees.
     */
    id: "glass-light",
    hint: "the lit rim is `GlassRimFilter`, which a glass `Squircle` and the `.glass-*` classes already draw — never a lighting filter of a component's own",
    pattern:
      /<fe(?:SpecularLighting|DiffuseLighting|DistantLight|PointLight|SpotLight)\b|\bspecularExponent\b/g,
  },
  {
    id: "heading-role",
    hint: "heading level is semantic and its visual role is a `type-*` class — do not size a heading with a raw `text-*` utility",
    pattern:
      /<h[1-6]\b[^>]*\bclass\s*=\s*["'][^"']*\btext-(?:xs|sm|base|lg|xl|[2-9]xl)\b[^"']*["'][^>]*>/g,
    files: /^app\/(?:(?:components|pages|layouts)\/|(?:app|error)\.vue$)/,
  },
  {
    id: "type-weight",
    hint: "two weights only, 400 and 500 — `font-medium`, or a `type-*` role",
    pattern: /\bfont-(?:semibold|bold|extrabold|black)\b/g,
  },
  {
    id: "layer-number",
    hint: "app layers are named — `z-floating`, `z-modal`, `z-palette` (see § Layers)",
    pattern: /\bz-\[\d+\]/g,
  },
  {
    id: "raw-input",
    hint: "form fields go through `Input`, which draws the squircle chrome",
    pattern: /<input\b/g,
    files: /^app\/(components|pages|layouts)\//,
  },
  {
    /*
     * An em dash typed at a call site as the whole value. It was the portal's
     * marker for every kind of absence — not reported, not applicable, not
     * set, never, offline — drawn in the ink and weight of the value it stood
     * in for, and read by a screen reader as "em dash" or not at all.
     * `Value` takes a reason instead and draws the word, or in a table the
     * demoted glyph with the word beside it for the reader.
     */
    id: "empty-value",
    hint: "an empty value goes through `Value` with a reason (`utils/empty.ts`) — a word by default, the demoted glyph in a table; nothing else writes the dash",
    pattern: /(["'`])—\1|>\s*—\s*</g,
    files: /\.(vue|ts)$/,
  },
  {
    id: "raw-table",
    hint: "reading tables go through `Table`; allowlist only spreadsheet or library-owned tables with a stated reason",
    pattern: /<table\b/g,
    files: /^app\/(components|pages|layouts)\//,
  },
  {
    /*
     * A link or an image drags by default. A press that travels a few pixels
     * on one starts the browser's drag, and the click it was meant to be never
     * lands; inside a draggable card, a drag that starts on a link picks up
     * the link rather than the card. So every link and image a template draws
     * says `draggable`: "false", or "true" on the one thing that should drag.
     * Firefox has no CSS for it, so the attribute is the rule, and the portal
     * kept it as a line in its docs that a new image had already missed.
     *
     * The match is the tag's opening; the attributes are read quote-aware, so
     * an arrow function in a binding does not end the tag early. Examples are
     * read too: an example is how a component is shown to be used.
     */
    id: "link-drag",
    hint: 'a link or an image sets `draggable="false"`, or `draggable="true"` on the one thing that should drag (Patterns › Text selection and copy)',
    pattern: new RegExp(
      String.raw`<(?:a|NuxtLink|img)\b(?=((?:\s+[^\s"'<>/=]+(?:\s*=\s*(?:"[^"]*"|'[^']*'|[^\s"'=<>\x60]+))?)*)\s*/?>)`,
      "g",
    ),
    files: /\.(?:vue|stories\.ts)$/,
    filter: (m) => !/(?:^|\s)(?::|v-bind:)?draggable(?=[\s=]|$)/.test(m[1]),
  },
  {
    /*
     * Selection is off at the root, so `select-text` on an element reaches
     * everything inside it, and `select-none` inside that opts back out. An
     * `!important`, a `[&_*]:` variant and an inline `user-select` were how an
     * opt-in fought the portal's old rule, which sat on every element. Against
     * the root rule they only break the opt-out inside: a control in
     * selectable text turns selectable again.
     */
    id: "select-override",
    hint: "`select-text` reaches everything inside the element that carries it, and `select-none` inside opts back out — no `!`, no `[&_*]:`, no inline `user-select`",
    pattern: /!select-(?:none|text|all|auto)\b|\[&_\*\]:!?select-|user-select\s*:/g,
  },
  {
    id: "icon-weight",
    hint: "Nucleo uses an artwork cut, not a weight prop; select the generated glyph or outline component",
    pattern: /<(?:Ph[A-Za-z0-9]+|Icon[A-Za-z0-9]+|Avatar|component)\b[^>]*\s:?weight="[^"]*"/g,
    files: /\.(vue|ts)$/,
  },
  {
    id: "icon-family",
    hint: "Use generated Nucleo artwork; Phosphor and Caustic imports have been retired",
    pattern: /(?:from\s*|import\s*\()["'](?:@phosphor-icons\/vue|@arcon\.mobi\/caustic-icons)["']/g,
    files: /\.(vue|ts)$/,
  },
  {
    /*
     * Icons are drawn at 12, 14, 16, 18, 20, 24, 32 and 48 and no other size —
     * `iconSize` in `tailwind.config.ts`, which nothing in the app read until
     * this rule: 200-odd `:size` literals were on the ladder by convention and
     * one, a 64, was not. The shared size prop is `number | string`, so the
     * type cannot hold a template; `IconSize` holds the tables in script.
     *
     * The tags are local `Icon*` glyphs and a `<component :is>` — every one that carries a numeric size is a
     * runtime-chosen glyph — and `Spinner`, which is drawn in an icon's place
     * and at an icon's size. A size that is not a number is an expression the
     * rule cannot read, and is left to the type.
     */
    id: "icon-size",
    hint: "an icon is drawn at 12, 14, 16, 18, 20, 24, 32 or 48 and no other size — `iconSize` in `tailwind.config.ts`; 18 is Nucleo's grid and the rail's",
    pattern: /<(?:Ph[A-Za-z]+|Icon[A-Za-z]+|component|Spinner)\b[^>]*?\s:?size="([^"]*)"/g,
    files: /\.vue$/,
    filter: (m) => /^\d+(?:\.\d+)?$/.test(m[1]) && !iconSize.includes(Number(m[1])),
  },
  {
    /*
     * The same number in another spelling. A glyph's size is its `:size`
     * attribute; the one place a class sizes a glyph is on the *control* that
     * owns it — `Button`'s `[&_svg]:size-4` — where it deliberately beats
     * the attributes so a call site passes the icon and nothing else. A
     * `size-4` on the glyph itself is a size the ladder check cannot read and
     * a second owner for the one number.
     */
    id: "icon-size",
    hint: "size a glyph with `:size`, not a class; a control that owns the size sets `[&_svg]:size-*` on itself, as `Button` does",
    pattern: /<(?:Ph[A-Za-z]+|Icon[A-Za-z]+)\b[^>]*?\sclass="[^"]*(?<![\w-])(?:size|h|w)-[\d.]/g,
    files: /\.vue$/,
  },
  {
    /*
     * A page is rendered on the server before the browser has it, and the
     * server has no window. Nuxt's server build compiles `window`, `document`
     * and `navigator` to `undefined`, so `window.addEventListener(…)` is a
     * TypeError there and every other browser global a ReferenceError: one
     * `MutationObserver` made at the top of `UI/Chart.vue` took down every page
     * holding a chart. Browser work belongs in `onMounted`, a handler, or a
     * watcher that doesn't run on the server, and module state is written in
     * the browser only.
     *
     * This reads the one place a pattern can: a statement at the top of a
     * module or of `<script setup>`, which is column 0 here. A global read
     * deeper down, in a function a server render calls, needs runtime SSR
     * validation; `UI/Popover.vue`'s `instanceof HTMLElement` in a computed
     * was one.
     */
    id: "ssr-global",
    hint: "the server has no window — read a browser global in `onMounted`, a handler, or a watcher that doesn't run on the server, and write module state only when `!import.meta.server`",
    pattern:
      /^(?:(?:export\s+)?(?:const|let|var)\s+[^=\n]+=\s*(?!(?:async\s*)?(?:\([^)\n]*\)|[\w$]+)\s*(?::[^=\n]+)?=>|function\b)[^\n]*?\b(?:window|document|navigator|localStorage|sessionStorage|matchMedia|getComputedStyle|requestAnimationFrame|new\s+(?:Mutation|Resize|Intersection)Observer)\b|(?:window|document|navigator|localStorage|sessionStorage)\s*\.|(?:requestAnimationFrame|matchMedia|getComputedStyle)\s*\()/gm,
  },
  {
    /*
     * VueUse's helpers are safe on the server only when they have nothing to
     * resolve there. Left out, `useEventListener("keydown", …)`'s target is
     * VueUse's own `defaultWindow`, undefined on the server; `window` passed by
     * name works only because Nuxt compiles it away, and under any other
     * server renderer the argument itself throws. `UI/Select.vue`,
     * `UI/ContextMenu.vue` and `UI/SidePanel.vue` all passed it.
     */
    id: "ssr-listener-target",
    hint: 'leave the target out — `useEventListener("keydown", …)` listens on the window — or pass VueUse\'s `defaultWindow`/`defaultDocument`, which are undefined on the server',
    pattern:
      /\buse(?:EventListener|ResizeObserver|MutationObserver|IntersectionObserver)\(\s*(?:window|document)\b/g,
  },
  {
    /*
     * A native `<Teleport>` renders on the server into the page's `<body>`,
     * and hydrates by walking the body from its first node, so anything ahead
     * of its first anchor misaligns it. `UI/Tooltip.vue` put a pair of anchors
     * in the page for every icon button. Reka's portals wait for mount; a
     * native one waits inside `<ClientOnly>`, with an empty `#fallback` so the
     * server writes no placeholder element in its place.
     */
    id: "ssr-teleport",
    hint: "a native `<Teleport>` goes inside `<ClientOnly>`, with an empty `#fallback` — Reka's portals already wait for mount",
    pattern: /<Teleport\b/g,
    requires: /<ClientOnly\b/,
    files: /\.vue$/,
  },
];

/**
 * The squircle rule reads class *strings* rather than whole lines: a
 * `rounded-3xl` and a `bg-*` on two different elements of one line is not a
 * finding, and a `bg-*` handed to `surfaceClass` is the correct shape rather
 * than a violation of it.
 *
 * `SQUIRCLE_SHAPES` are the three exceptions from rule 2 that a class string
 * states about itself, so they need no per-file entry: a box that scrolls or
 * clips (a `Squircle`'s surface is a sibling of its content, so the fill
 * scrolls out from under it), a box positioned over something else (its
 * geometry is the layout's), and a `peer-checked` selection card (the border
 * *is* the state, and CSS drives it off a sibling input).
 */
const SQUIRCLE_RADII = /\brounded-(?:2xl|3xl|full)\b/;
const SQUIRCLE_PILL = /\brounded-full\b/;
const CSS_CIRCLE = /\bsize-[^\s]+/;
const SQUIRCLE_FILL = /\bbg-(?!transparent|clip|origin|gradient|none\b)[a-z]/;
const SQUIRCLE_SHAPES =
  /\b(?:overflow-(?:auto|scroll|hidden|x-auto|y-auto|x-scroll|y-scroll)|absolute|fixed|peer-checked:)/;

/**
 * A fill on a `Squircle`'s *root*. The root is the one unclipped box — the
 * surface layer is clipped to the path, the content can be, the root never is
 * — so a background on the element itself paints a plain rectangle behind the
 * smoothed corners. `Locations/ListItem.vue` had one as a selected row: the
 * `fill-3` it drew through `.list-row--glass[aria-selected]` squared off at the
 * corners, under the same `fill-3` correctly clipped on `surfaceClass`.
 *
 * Neither rule above can see it. `squircle` keys on a `rounded-*` beside a
 * `bg-*` literal, and a component class carries its fill without either;
 * `surface-state` reads only `surfaceClass`. So this one reads the *tag*: on
 * `Squircle`, and on every component whose template root is one (derived —
 * see `squircleRootedTags`), the `class` attribute may carry no fill of any
 * spelling — not a `bg-*` utility, and not a plugin or stylesheet class that
 * declares a background, which is asked of the config and the stylesheet
 * rather than kept as a list. A gradient counts: it is a background image.
 */
const ROOT_FILL_UTILITY =
  /\bbg-(?!transparent\b|clip-|origin-|none\b|repeat|no-repeat\b|cover\b|contain\b|auto\b|fixed\b|local\b|scroll\b|center\b|top\b|bottom\b|left\b|right\b|blend-)[a-z[]/;
const ROOT_FILL_HINT =
  "a fill on a `Squircle` root paints a rectangle behind the smoothed corners — put it on `surfaceClass`, and give a row its states there with `group-*` rather than `.list-row`";
const PAINT_PROPERTY = /^background(?:-?(?:color|image))?$/i;

/**
 * A clip on a `Squircle`'s *root*. The cast shadow is an SVG drawn past the
 * root's box, so an `overflow-hidden` there cuts it off at the box: no shadow
 * falls below the surface, and what survives in each corner, between the curve
 * and the box, is a hard-edged wedge. The clip it reaches for is the rectangle,
 * too, so a fill still shows past the smoothed corner. The site's search
 * palette had one on its glass, and four of the portal's cards had one — the
 * connector table, the pricing simulation, the onboarding command menu and the
 * settings rail — each to keep a table or a scroller inside the corner.
 *
 * `clipContent` is that clip, kept in flow; a scroller goes inside the surface
 * as a `ScrollArea`. It reads the same tags as the fill rule, and
 * `overflow-visible` is not a clip.
 */
const ROOT_CLIP_UTILITY = /^!?(?:[\w-]+:)*!?overflow-(?:[xy]-)?(?:hidden|clip|auto|scroll)$/;
const ROOT_CLIP_HINT =
  "a `Squircle` root never clips or scrolls: `overflow-*` cuts the shadow drawn past its box and clips to the rectangle, not the shape — clip with `clipContent` (padding and layout on `contentClass`), and scroll inside it with `ScrollArea`";

/**
 * A rounded box whose CSS `border` is translucent. A border's sides are painted
 * one beside the next, and at a rounded corner they overlap: opaque, nothing
 * shows; translucent, the joint comes out 5–8 levels darker at every zoom, and
 * 11 on the checkbox (measured 2026-09-28). The line tokens and the default
 * border colour have been translucent since that day, so a bare
 * `rounded-md border` is one. An inset ring, an inset outline and a `Squircle`
 * stroke are single shapes, and measure within a level of an opaque line.
 *
 * It reads class *strings*, as the squircle rule does: a rounding and a border
 * on every side in one string, and a translucent border colour in it, or none,
 * which is `borderColor.DEFAULT`. A colour set in another string can't be seen
 * from this one, so a string that names none is read as the default.
 */
const ROUNDED = /(?:^|\s)!?(?:[\w-]+:)*!?rounded(?:-(?!none(?:\s|$))\S+)?(?=\s|$)/;
const FULL_BORDER = /(?:^|\s)!?(?:[\w-]+:)*!?border(?:-(?:2|4|8|\[[^\]\s]+\]))?(?=\s|$)/;
const BORDER_COLOUR =
  /(?:^|\s)!?(?:[\w-]+:)*!?border-(?!(?:[xytrblse]|0|2|4|8|solid|dashed|dotted|double|hidden|none|collapse|separate|spacing)(?:-|\s|$))([\w-]+)(?=\s|$)/g;
const COLOUR_VALUES = (() => {
  const out = new Map();
  const add = (name, value) => {
    if (typeof value === "string") out.set(name, value);
    else
      for (const [key, next] of Object.entries(value))
        add(key === "DEFAULT" ? name : name ? `${name}-${key}` : key, next);
  };
  add("", colors);
  return out;
})();
const alphaOf = (value) => {
  const slash = value.match(/\/\s*([\d.]+)(%?)\s*\)\s*$/);
  if (slash) return Number(slash[1]) / (slash[2] ? 100 : 1);
  const rgba = value.match(/^rgba\([^)]*,\s*([\d.]+)\s*\)$/);
  if (rgba) return Number(rgba[1]);
  const hex = value.match(/^#[0-9a-f]{6}([0-9a-f]{2})$/i);
  return hex ? Number.parseInt(hex[1], 16) / 255 : 1;
};
const isTranslucent = (value) => {
  const alpha = alphaOf(value);
  return alpha > 0 && alpha < 1;
};
const roundedTranslucentBorder = (value) => {
  if (!ROUNDED.test(value) || !FULL_BORDER.test(value)) return false;
  const named = [...value.matchAll(BORDER_COLOUR)].map((m) => COLOUR_VALUES.get(m[1]));
  if (named.every((colour) => colour === undefined)) return isTranslucent(borderColor.DEFAULT);
  return named.some((colour) => colour !== undefined && isTranslucent(colour));
};
const ROUNDED_BORDER_HINT =
  "a rounded keyline in a translucent colour is an inset ring (`ring-1 ring-inset`), an inset outline (`outline outline-1 -outline-offset-1`) or a `Squircle` stroke — a CSS border's sides overlap at a rounded corner and darken it there";

/* ------------------------------------------------------------------ *
 * Sources
 * ------------------------------------------------------------------ */

/**
 * Comments are stripped before any rule reads a file. Nearly every rule here
 * describes the thing it forbids, and the components that replaced those
 * patterns say so in their own doc comments — `UI/Callout.vue` names the
 * `bg-amber-50` boxes it replaced. Linting prose would make documenting a
 * migration impossible.
 *
 * A `/*` opens a comment only where one can start — not inside `image/*` or
 * `endsWith("/*")`, which used to open a block comment that ran to the end of
 * `UI/ImagePicker.vue` and hid its whole script from every rule.
 */
const stripComments = (source) =>
  source
    .replace(/<!--[\s\S]*?-->/g, (m) => m.replace(/[^\n]/g, " "))
    .replace(/(?<![\w"'/])\/\*[\s\S]*?\*\//g, (m) => m.replace(/[^\n]/g, " "))
    .replace(/(^|[^:\w])\/\/[^\n]*/g, (m, lead) => lead + " ".repeat(m.length - lead.length));

const lineOf = (text, index) => text.slice(0, index).split("\n").length;

/**
 * The class strings in a file: every `class="…"` attribute, plus every single-
 * quoted and backtick run anywhere.
 *
 * Bare double-quoted runs are deliberately *not* collected. In a template they
 * are attribute values, and a regex matching `"…"` pairs across a tag reads
 * the gap *between* two attributes as a string — which is how a `rounded-3xl`
 * in one element and a `bg-*` in the next were read as one class list. A
 * `:class` expression's own strings are single-quoted, so nothing is lost.
 */
const QUOTED = /(["'`])((?:\\.|(?!\1)[\s\S])*)\1/g;

const blank = (m) => m.replace(/[^\n]/g, " ");
const templateOf = (text) => text.replace(/<script[^>]*>[\s\S]*?<\/script>/g, blank);

const classStrings = function* (text, isVue) {
  if (!isVue) {
    for (const q of text.matchAll(QUOTED)) yield { value: q[2], index: q.index };
    return;
  }

  // A template's single quotes belong to attribute *expressions*, so pairing
  // them across the whole file joins `'taken'` in one tag to a quote three
  // elements later. Read the two regions with the rules each one actually has.
  const template = templateOf(text);

  for (const m of template.matchAll(/\sclass="([^"]*)"/g)) yield { value: m[1], index: m.index };
  for (const m of template.matchAll(/\s:class="([^"]*)"/g)) {
    const at = m.index + m[0].indexOf(m[1]);
    for (const q of m[1].matchAll(QUOTED)) yield { value: q[2], index: at + q.index };
  }
  for (const block of text.matchAll(/<script[^>]*>([\s\S]*?)<\/script>/g)) {
    const at = block.index + block[0].indexOf(block[1]);
    for (const q of block[1].matchAll(QUOTED)) yield { value: q[2], index: at + q.index };
  }
};

/* ------------------------------------------------------------------ *
 * Copy
 * ------------------------------------------------------------------ */

/**
 * The strings a person reads, and nothing else: a template's text nodes, the
 * attribute values that are copy (`placeholder`, `title`, `aria-label`, a
 * field's `label`/`description`/`error`, a dialog's `heading`), the literals
 * inside a mustache or a bound attribute, and the string literals in a
 * script. Comments are already gone. Keys, paths, class lists, selectors and
 * identifiers are told apart by shape — a string with no space and a hyphen,
 * dot, slash or underscore in it is one of those, not a sentence — and a
 * string on a `console.` line is a developer's, not an operator's.
 *
 * This is the reader the six `copy-*` rules share. The copy audit of
 * 2026-09-16 that wrote § Copy read 4,325 strings this way; the shapes it
 * filtered on are the ones here.
 */
const COPY_ATTRS =
  /^(?:placeholder|title|label|description|alt|text|heading|caption|subtitle|hint|help|empty|error|summary|detail|action-label|alt-text|all-label|item-noun|cancel-label|confirm-label|alternative-label|aria-label|aria-description|aria-roledescription|aria-placeholder|aria-valuetext)$/i;

const COPY_ENTITIES = [
  [/&middot;|&#183;/gi, "·"],
  [/&mdash;|&#8212;/gi, "—"],
  [/&ndash;|&#8211;/gi, "–"],
  [/&hellip;/gi, "…"],
  [/&bull;|&#8226;/gi, "•"],
  [/&nbsp;/gi, " "],
  [/&amp;/gi, "&"],
  [/&quot;/gi, '"'],
];
const decodeEntities = (s) => COPY_ENTITIES.reduce((acc, [re, to]) => acc.replace(re, to), s);

/** Not copy: a key, a path, a class list, a colour, a selector, a format string. */
const notCopy = (s) => {
  const t = s.trim();
  // A glyph-only literal beside an interpolation — `` ` · ${description}` `` — is
  // a separator, which is the one thing `copy-glyph` exists to find; it carried
  // a status to its qualifier in `PulseDigests/Card.vue` without a letter for
  // the check below to keep it.
  if (/[·•—|]/.test(t) && /\$\{\}/.test(t)) return false;
  if (!/[A-Za-z]/.test(t)) return true;
  if (/^(?:https?:|mailto:|wss?:|\/|~|\.\.?\/|#)/.test(t)) return true;
  if (/^\[[\w-]+\]/.test(t)) return true; // a developer's tag: "[useStationActions] …"
  if (/^[:?}]/.test(t)) return true; // code left between two nested template literals
  if (!/\s/.test(t) && /[-_:/.[\]@$]/.test(t)) return true;
  if (/^[a-z][\w-]*$/.test(t) || /^[A-Z_][A-Z0-9_]+$/.test(t)) return true;
  if (/^[\w./:-]+(?:\s+[\w./:-]+)*$/.test(t) && /[-_:/.[\]]/.test(t) && !/[.!?]$/.test(t))
    return true;
  if (/^\d+(?:\.\d+)?(?:px|rem|em|%|ms|s|deg)?$/.test(t)) return true;
  if (/^[a-z]+(?:\s[a-z]+)?$/.test(t)) return true; // `space-x`, `start end`, a lowercase key pair
  return false;
};

const copyStrings = function* (text, isVue) {
  const lit = (code, at) => {
    const out = [];
    for (const q of code.matchAll(QUOTED)) {
      // What a template literal interpolates is code: a spread or a ternary
      // inside `${…}` is not the copy around it.
      const value = q[2].replace(/\$\{[^}]*\}/g, "${}");
      if (notCopy(value)) continue;
      const lineStart = code.lastIndexOf("\n", q.index) + 1;
      const lineEnd = code.indexOf("\n", q.index);
      const line = code.slice(lineStart, lineEnd === -1 ? undefined : lineEnd);
      // A developer's string: a console line, or an error built from a
      // template literal ("Failed to load audio cue: 404"). A thrown message
      // in plain quotes is one the login form or an error page shows, and is read.
      if (/console\.\w+\(|new Error\(`/.test(line)) continue;
      out.push({ value, index: at + q.index + 1, kind: "literal" });
    }
    return out;
  };
  if (!isVue) {
    yield* lit(text, 0);
    return;
  }
  for (const block of text.matchAll(/<script[^>]*>([\s\S]*?)<\/script>/g)) {
    yield* lit(block[1], block.index + block[0].indexOf(block[1]));
  }
  // A `<style>` block is not prose either.
  const template = templateOf(text).replace(/<style[^>]*>[\s\S]*?<\/style>/g, blank);
  // Attributes: a plain copy-bearing one is copy whole; a bound one holds literals.
  for (const m of template.matchAll(/(?<=\s)([:@#]?[\w.:-]+)="([^"]*)"/g)) {
    const name = m[1];
    const at = m.index + m[0].indexOf('"') + 1;
    if (name.startsWith("@") || name.startsWith("#")) continue;
    if (name.startsWith(":") || name.startsWith("v-")) {
      const bare = name.replace(/^(?::|v-bind:|v-)/, "");
      if (
        /^(?:class|style|key|ref|for|if|else|else-if|show|model|slot)$/.test(bare) ||
        /class$/i.test(bare)
      )
        continue;
      for (const l of lit(m[2], at)) yield { ...l, kind: "attr" };
      continue;
    }
    if (!COPY_ATTRS.test(name)) continue;
    const value = decodeEntities(m[2]);
    if (notCopy(value)) continue;
    yield { value, index: at, kind: "attr" };
  }
  // Text nodes and mustaches. Tags are blanked to their brackets, so their
  // attribute text cannot read as prose and a run of text ends where the
  // markup does; a mustache contributes only its own string literals.
  const blanked = template.replace(
    new RegExp(`<\\/?[\\w.-]+${TAG_ATTRIBUTES}|<\\/[\\w.-]+\\s*>`, "g"),
    (m) => "<" + " ".repeat(Math.max(m.length - 2, 0)) + ">",
  );
  for (const m of blanked.matchAll(/\{\{([\s\S]*?)\}\}/g)) {
    for (const l of lit(m[1], m.index + 2)) yield { ...l, kind: "mustache" };
  }
  const prose = blanked.replace(/\{\{[\s\S]*?\}\}/g, blank);
  for (const m of prose.matchAll(/[^\s<>][^<>]*/g)) {
    const value = decodeEntities(m[0].replace(/\s+/g, " ").trim());
    if (!value || notCopy(value)) continue;
    yield { value, index: m.index, kind: "text" };
  }
};

/**
 * Words that are capitalised because they are names, so a label made of them
 * is not Title Case. Anything else capitalised after the first word is. A
 * project adds its own under `lint.properNouns`; `lint()` sets the run's set.
 */
const BASE_PROPER_NOUNS = new Set(
  "Arcon Google Maps Places Slack Web Audio Microsoft Teams MapLibre OpenMapTiles OpenStreetMap Basic Auth TLS Metro Manila Quezon City Makati BGC Touch Face ID Harbour Harbor Point Riverside Mall North District Operations Motorway Service Area Parking Garage Lot Underground Philippine Peso PHP Xero QuickBooks Online Viber EV Vinfast Acme CPO Zapier Hubject Workflows Privacy Policy Operator Terms MacBook Windows Hello Chrome Safari Firefox Edge Linear Railway OCPP OCPI CSMS EVSE RFID QR PEM CA CDR CDRs URL JSON Wh kWh kW Type".split(
    " ",
  ),
);

const UK_SPELLINGS =
  /\b(?:colours?|coloured|organis(?:e|ed|es|ing|ation|ations)|cancelled|cancelling|favourites?|authoris(?:e|ed|es|ing|ation)|licences?|behaviours?|centres?|centred|grey|enrol|enrols|enrolment|catalogues?|analys(?:e|ed|es|ing)|customis(?:e|ed|es|ing|ation)|optimis(?:e|ed|es|ing|ation)|recognis(?:e|ed|es|ing)|initialis(?:e|ed|es|ing)|synchronis(?:e|ed|es|ing)|summaris(?:e|ed|es|ing)|finalis(?:e|ed|es|ing)|prioritis(?:e|ed|es|ing)|minimis(?:e|ed|es|ing)|maximis(?:e|ed|es|ing)|realis(?:e|ed|es|ing)|labelled|labelling|travelled|travelling|modelled|modelling|fulfil|fulfilment|metres?|litres?|defence|offence|judgement|acknowledgement|ageing|favours?|honours?|humour|labour|neighbours?|neighbouring|flavours?|programmes?|whilst|amongst|towards|unrecognised)\b/i;

/**
 * Every rule reads one copy string and returns the offending substring, or
 * nothing. `docs/design-system.md` § Copy is the prose each one enforces.
 */
const COPY_RULES = [
  {
    id: "copy-glyph",
    hint: "facts are separated by space (`gap-3`) or a comma, a clause after a dash is its own sentence, a range is an en dash — no `·`, `•`, `—` or `...` in copy",
    // A spaced en dash is a range whose endpoints carry a date ("Mar 3, 12:00 –
    // Mar 4, 13:00"); with no digit or interpolation in the string it is an aside.
    test: (s) =>
      /[·•]|—|\.\.\./.exec(s)?.[0] ?? (/ – /.test(s) && !/\d|\$\{/.test(s) ? "–" : undefined),
  },
  {
    id: "copy-idiom",
    hint: "a failure says `Couldn’t <verb> the <thing>` and offers Retry; validation says what to enter; nothing says please, succeeded successfully, or went wrong",
    test: (s) =>
      /^(?:Failed to|Unable to|Could not)\b|\b(?:[Pp]lease\b|try again later|[Ss]omething went wrong|[Aa]n error occurred|[Ss]uccessful(?:ly)?|is required\b|phase two)/.exec(
        s,
      )?.[0],
  },
  {
    id: "copy-case",
    hint: "sentence case everywhere — menus, palette commands, dialog titles and section headings included; a capital after the first word is a name",
    test: (s) => {
      if (!/^[A-Z][a-z’]+(?: [A-Za-z’]+){1,4}…?$/.test(s)) return undefined;
      const words = s.replace(/…$/, "").split(" ");
      const capitalised = words
        .slice(1)
        .filter((w) => /^[A-Z][a-z’]+$/.test(w) && !run.properNouns.has(w.replace(/’s$/, "")));
      return capitalised.length ? s : undefined;
    },
  },
  {
    id: "copy-spelling",
    hint: "US spelling in copy (color, organization, canceled, center, enroll, recognize)",
    test: (s) => UK_SPELLINGS.exec(s)?.[0],
  },
  {
    id: "copy-quotes",
    hint: "copy takes the typographer’s marks — ’ in a contraction or possessive, “ ” around a quoted name; straight quotes are for code",
    // Double quotes are only read in a plain string: what is left of a template
    // literal after its expressions are cut can carry a nested literal's quotes.
    test: (s) =>
      /[A-Za-z]'[A-Za-z]/.exec(s)?.[0] ??
      (s.includes("${") ? undefined : /(?:^|\s)"[^"]{2,}"(?=\s|[.,;:!?]|$)/.exec(s)?.[0]),
  },
];

/**
 * A button whose label swaps for a progress word while its request runs.
 * `Button`'s `loading` is the busy state and keeps the label; the swap
 * changes the button's width mid-click and says nothing the spinner does
 * not. Read off the template's mustaches, since it is a shape, not a string.
 * Both branches ending in an ellipsis is a menu row that opens a dialog either
 * way ("Register again…"), not a swap, and is left alone.
 */
const BUSY_SWAP = /\?\s*(["'`])([^"'`\n]*…)\1\s*:\s*(["'`])([^"'`\n]*)\3/g;

/**
 * Files the copy rules do not read, each with its reason, in every project. A
 * project adds its own under `lint.copyUnchecked`.
 */
const COPY_UNCHECKED = [{ glob: /\.test\.ts$/, why: "a test's fixtures are data" }];

/** What one run reads that the rules above need: set by `lint()`. */
const run = { properNouns: BASE_PROPER_NOUNS };

/* ------------------------------------------------------------------ *
 * Squircle roots
 * ------------------------------------------------------------------ */

/**
 * The tags whose `class` lands on a `Squircle` root: `Squircle` itself, and
 * every component whose template root is one of those — a `class` on
 * `<Card>` or `<SettingsCard>` falls through to that root the same way.
 *
 * Derived rather than listed. The sweep that wrote the rule found thirty-one,
 * most of them cards nobody would have thought to name, and a list would be
 * stale the first time a row was rebuilt on a `Squircle`. Names follow Nuxt's
 * own resolution (`nuxtComponentName`). Sine's components are read for their
 * roots too, so a class on `<Card>` in an app is caught. `--list` prints the
 * set, which is how a drift in either would show.
 */

/** The first element of the SFC's template, looking through transition wrappers. */
const templateRootTag = (text) => {
  const open = text.search(/<template\b/);
  if (open < 0) return null;
  for (const [, tag] of text.slice(open).matchAll(/<([A-Za-z][\w-]*)\b/g)) {
    if (!/^(?:template|Transition|TransitionGroup|KeepAlive)$/.test(tag)) return tag;
  }
  return null;
};

/** `sources` holds `[name, text, { sine }]`: Sine's components and the project's. */
const squircleRootedTags = (sources) => {
  const roots = new Map();
  for (const [name, text, origin] of sources) {
    if (/^app\/components\/.*\.vue$/.test(name))
      roots.set(nuxtComponentName(name, origin), templateRootTag(text));
  }
  // Button is polymorphic: pills use Pill while joined dialog actions use
  // a plain cell root. Its default remains a squircle, so seed it explicitly;
  // every other wrapper is derived from its first template root.
  const rooted = new Set(["Squircle", "Button"]);
  for (let grew = true; grew;) {
    grew = false;
    for (const [tag, root] of roots) {
      if (rooted.has(tag) || !rooted.has(root)) continue;
      rooted.add(tag);
      grew = true;
    }
  }
  return [...rooted];
};

/**
 * Every opening tag of one of those components, with its attributes read as
 * attributes — a quoted value may hold a `>` (`:ref="(el) => …"` does), so a
 * `[^>]*` would end the tag early and lose the `class` after it.
 */
const TAG_ATTRIBUTES = String.raw`((?:\s+[^\s"'<>/=]+(?:\s*=\s*(?:"[^"]*"|'[^']*'|[^\s"'=<>\`]+))?)*)\s*/?>`;
const escapeRegExp = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

const rootClassTokens = function* (text, tags) {
  const tagPattern = new RegExp(`<(${tags.join("|")})\\b${TAG_ATTRIBUTES}`, "g");

  for (const m of templateOf(text).matchAll(tagPattern)) {
    const [, tag, attrs] = m;
    const literals = [...attrs.matchAll(/\sclass="([^"]*)"/g)].map((c) => c[1]);
    for (const c of attrs.matchAll(/\s:class="([^"]*)"/g)) {
      for (const q of c[1].matchAll(QUOTED)) literals.push(q[2]);
    }
    yield { tag, tokens: literals.flatMap((l) => l.split(/\s+/)), index: m.index };
  }
};

const rootFills = function* (text, tags, paintingClasses) {
  const paintingClass = new RegExp(
    `(?<![\\w-])(?:${paintingClasses.map(escapeRegExp).join("|")})(?![\\w-])`,
  );
  const isFill = (token) => ROOT_FILL_UTILITY.test(token) || paintingClass.test(token);

  for (const { tag, tokens, index } of rootClassTokens(text, tags)) {
    const fills = tokens.filter(isFill);
    if (fills.length) yield { tag, fills, index };
  }
};

const rootClips = function* (text, tags) {
  for (const { tag, tokens, index } of rootClassTokens(text, tags)) {
    const clips = tokens.filter((token) => ROOT_CLIP_UTILITY.test(token));
    if (clips.length) yield { tag, clips, index };
  }
};

/**
 * Tailwind's own motion scales. The theme extends Tailwind's durations and
 * easings rather than replacing them, so `duration-75` to `duration-1000` and
 * `ease-linear`, `ease-in`, `ease-out` and `ease-in-out` all still compile; a
 * duration on Tailwind's scale is as much a number typed at the call site as an
 * arbitrary `duration-[…]` is, which the pattern rule above already rejects.
 */
const TAILWIND_MOTION =
  /(?<![\w-])(?:duration-(?:0|75|100|150|200|300|500|700|1000)|ease-(?:linear|in|out|in-out))(?![\w-])/g;

/**
 * Class lists for that rule, read as class lists. Every `*-class` attribute
 * counts, since a `<Transition>`'s `enter-active-class` is where a duration
 * usually sits. A script's strings count only when they hold more than one word,
 * which is what a class list is and what an easing keyword handed to
 * `animate()` is not; a style block is CSS, where `ease-in-out` is a keyword
 * rather than a class, and is not read.
 */
const motionClassStrings = function* (text, isVue) {
  const isList = (value) => /\s/.test(value.trim());
  if (!isVue) {
    for (const q of text.matchAll(QUOTED)) if (isList(q[2])) yield { value: q[2], index: q.index };
    return;
  }
  const template = templateOf(text);
  for (const m of template.matchAll(/\s(?:[\w-]+-)?class="([^"]*)"/g)) {
    yield { value: m[1], index: m.index };
  }
  for (const m of template.matchAll(/\s:(?:[\w-]+-)?class="([^"]*)"/g)) {
    const at = m.index + m[0].indexOf(m[1]);
    for (const q of m[1].matchAll(QUOTED)) yield { value: q[2], index: at + q.index };
  }
  for (const block of text.matchAll(/<script[^>]*>([\s\S]*?)<\/script>/g)) {
    const at = block.index + block[0].indexOf(block[1]);
    for (const q of block[1].matchAll(QUOTED)) {
      if (isList(q[2])) yield { value: q[2], index: at + q.index };
    }
  }
};

/**
 * A focus stroke switches on the frame focus arrives and never fades (decision
 * 11). The stroke is whatever carries `data-focus-border`, which every ring
 * drawn as a second squircle sets. A transition on one is the fade
 * `state-transition` exists to stop, whatever property it names: the rings fade
 * through `opacity`, which the colour pattern above cannot see.
 */
const focusStrokeTransitions = function* (text) {
  const tagPattern = new RegExp(`<([A-Za-z][\\w.-]*)${TAG_ATTRIBUTES}`, "g");
  for (const m of templateOf(text).matchAll(tagPattern)) {
    const attrs = m[2];
    if (!/\sdata-focus-border(?![\w-])/.test(attrs)) continue;
    const literals = [...attrs.matchAll(/\sclass="([^"]*)"/g)].map((c) => c[1]);
    for (const c of attrs.matchAll(/\s:class="([^"]*)"/g)) {
      for (const q of c[1].matchAll(QUOTED)) literals.push(q[2]);
    }
    const moving = literals
      .flatMap((l) => l.split(/\s+/))
      .filter((token) => /^(?:transition(?:-\S+)?|duration-\S+)$/.test(token))
      .filter((token) => token !== "transition-none");
    if (moving.length) yield { tag: m[1], moving, index: m.index };
  }
};

/** A `full` squircle on an explicitly square box is a squircle, not a circle. */
const squareFullSquircles = function* (text) {
  const tagPattern = new RegExp(`<(Pill|Squircle)\b${TAG_ATTRIBUTES}`, "g");

  for (const m of templateOf(text).matchAll(tagPattern)) {
    const [, tag, attrs] = m;
    const full =
      tag === "Pill" ||
      /\sradius\s*=\s*["']full["']/.test(attrs) ||
      /\s:radius\s*=\s*["'](?:'full'|"full")["']/.test(attrs);
    if (!full) continue;

    const literals = [...attrs.matchAll(/\sclass="([^"]*)"/g)].map((c) => c[1]);
    for (const c of attrs.matchAll(/\s:class="([^"]*)"/g)) {
      for (const q of c[1].matchAll(QUOTED)) literals.push(q[2]);
    }
    const square = literals
      .flatMap((value) => value.split(/\s+/))
      .find((token) =>
        /^(?:[\w-]+:)*size-(?!auto\b|full\b)[^\s]+$|^(?:[\w-]+:)*aspect-square$/.test(token),
      );
    if (square) yield { tag, square, index: m.index };
  }
};

/* ------------------------------------------------------------------ *
 * The collision check
 * ------------------------------------------------------------------ */

/**
 * A component class registered in the config's plugin lands in the components
 * layer, which is emitted *before* utilities. Both are a bare class, so they
 * tie on specificity and source order decides — meaning a Tailwind utility of
 * the same name silently wins. `.list-item` was one: Tailwind's own
 * `display: list-item` overrode the component's `flex` on every selectable row
 * in the portal, and nothing failed.
 *
 * So rather than matching against a list of names somebody maintains by hand,
 * ask Tailwind: hand it each plugin class name as content and see whether it
 * generates a utility for it.
 */
const paints = (body) =>
  Object.entries(body).some(
    ([key, value]) =>
      PAINT_PROPERTY.test(key) || (value && typeof value === "object" && paints(value)),
  );

/**
 * Every class the plugin registers, and the subset that declares a background
 * at any depth — `.list-row--glass` only through its `&[aria-selected]`, which
 * is exactly the one the root-fill rule needs to know about.
 */
const pluginClasses = () => {
  const names = new Set();
  const painting = new Set();
  const record = (rules) => {
    for (const [selector, body] of Object.entries(rules)) {
      for (const one of selector.split(",")) {
        const m = one.trim().match(/^\.([A-Za-z0-9_-]+)/);
        if (!m) continue;
        names.add(m[1]);
        if (paints(body)) painting.add(m[1]);
      }
    }
  };
  const noop = () => {};
  const api = {
    addComponents: record,
    addUtilities: record,
    addBase: noop,
    addVariant: noop,
    matchUtilities: noop,
    matchComponents: noop,
    theme: () => undefined,
    config: () => undefined,
    corePlugins: () => true,
    e: (s) => s,
    prefix: (s) => s,
  };
  for (const p of plugins) p.handler?.(api);
  return { names: [...names], painting: [...painting] };
};

/**
 * The stylesheet's own painting classes — `.glass-*`, which a squircle takes
 * as the `glass` prop instead. Read the same way: a rule paints if any
 * declaration under it is a background, or an `@apply` hands it a `bg-*`.
 */
const stylesheetPaintingClassNames = () => {
  const sheet = postcss.parse(readFileSync(path.join(SINE_ROOT, "app/assets/sine.css"), "utf8"));
  const names = new Set();
  sheet.walkRules((rule) => {
    let painting = false;
    rule.walkDecls((decl) => {
      if (PAINT_PROPERTY.test(decl.prop)) painting = true;
    });
    rule.walkAtRules("apply", (at) => {
      if (ROOT_FILL_UTILITY.test(at.params)) painting = true;
    });
    if (!painting) return;
    for (const one of rule.selector.split(",")) {
      const m = one.trim().match(/^\.([A-Za-z0-9_-]+)$/);
      if (m) names.add(m[1]);
    }
  });
  return [...names];
};

/**
 * The class names Tailwind generates for `candidates` under Sine's theme, each
 * handed to it as content; a candidate it has no rule for is simply absent.
 * One build for all of them, since every run is a full build. The collision
 * check passes no plugins, because a plugin class is what it is looking for a
 * utility *behind*; the token check passes Sine's, so a component class the
 * config registers counts as generated.
 */
const generatedClassNames = async (candidates, { plugins: withPlugins = [] } = {}) => {
  const result = await postcss([
    tailwindcss({
      theme,
      plugins: withPlugins,
      corePlugins: { preflight: false },
      // `block` is a utility on purpose: with none at all, Tailwind warns that
      // the content found nothing, which is the answer the lint hopes for.
      content: [{ raw: [...candidates, "block"].join(" "), extension: "html" }],
    }),
  ]).process("@tailwind components;\n@tailwind utilities;", { from: undefined });

  const generated = new Set();
  result.root.walkRules((rule) => {
    for (const selector of rule.selector.split(",")) {
      // The leading class, before any pseudo-element or combinator:
      // `.placeholder-ink-4::placeholder` and `.divide-line > :not([hidden]) ~
      // :not([hidden])` are both their utility's rule.
      const m = selector.trim().match(/^\.((?:\\.|[^\\.:\s>+~[,])+)/);
      if (m) generated.add(m[1].replace(/\\(.)/g, "$1"));
    }
  });
  return generated;
};

const collidingClassNames = async (names) => {
  const generated = await generatedClassNames(names);
  return names.filter((name) => generated.has(name));
};

/* ------------------------------------------------------------------ *
 * The token check
 * ------------------------------------------------------------------ */

/**
 * A colour class whose token Tailwind doesn't have. `bg-accent` was one: the
 * lime became `ampere` on 2026-10-01, and the portal's registration form kept
 * a card on `surface-class="bg-accent"`. Tailwind emits nothing for a stem it
 * doesn't know, so the class compiled to no CSS, the build passed, `typecheck`
 * caught only the `colors.accent` read beside it in script, and the card lost
 * its fill. `literal-colour` reads the other half of the same mistake, a colour
 * that is not a token, and can't see this one, a token name that is not a
 * colour.
 *
 * It asks Tailwind rather than a list. Every class a file writes under one of
 * the colour utilities (`UTILITY_PREFIXES`), its variants and `!` stripped, is
 * handed to Tailwind with Sine's theme and plugins, and one that comes back
 * with no rule is a finding, unless a stylesheet defines it: Sine's own, a
 * `.css` under the project's linted folders, or a `<style>` block. An
 * arbitrary value (`bg-[…]`) names no token and is `literal-colour`'s. Only
 * Sine's theme is known here; a project that extended it with tokens of its
 * own would need its Tailwind config read too, and none does yet.
 *
 * What it reads: a template's `class` and `*-class` attributes, the strings in
 * a `:class` or `:*-class` binding, and in script every string that is a class
 * list — more than one word, each shaped like a class. A one-word string in
 * script is read too, but is only reported when it is plainly a class: the
 * value of a `class`/`*Class` key or variable, or a stem that claims a family
 * Sine has (`ink`, `fill`, `surface`…) or had (`accent`, `primary`, `danger`).
 * `"stroke-width"` and `"text-anchor"` are SVG attribute names and
 * `"border-box"` is a CSS value; none claims a family, and none is reported.
 */
const UNKNOWN_TOKEN_HINT =
  "a colour class names a token Tailwind has, or it compiles to nothing and the element silently loses its colour — the token is misspelt, renamed or gone (Foundations › Color names every token)";

/** The stem of a colour utility: `ink-2` in `text-ink-2`, `border-t-ink-2` and `ring-offset-ink-2`. */
const UTILITY_STEM = new RegExp(`^(?:${UTILITY_PREFIXES})(?:-(?:[xytrblse]|offset))?-(.+)$`);

/** One variant off the front of a class: `hover:`, `group-hover/nav:`, `data-[state=open]:`, `[&_svg]:`, `*:`. */
const VARIANT = /^(?:\[[^\]]*\]|[\w*-]+(?:\[[^\]]*\])?(?:\/[\w-]+)?):/;

/**
 * One class in a list, as the script reader tells a class list from a sentence
 * or a selector: variants, then `!` or `-`, then a lowercase word and whatever
 * follows a `-`, `.` or `/`, as long as it doesn't end in a colon. A capital, a
 * digit or a bracket at the front fails it, so `"Switch to-do list"`,
 * `"stroke-width 2"` and `"svg [stroke-width]"` are not lists, and a
 * declaration's `box-sizing:` fails it on its colon.
 */
const CLASS_SHAPED = /^!?(?:[^\s:]+:)*-?[a-z][a-z0-9]*(?:[-./][^\s]*)?(?<!:)$/;

/** A string that is the value of a class key or variable: `surfaceClass: "…"`, `class: "…"`, `const barClass = "…"`. */
const CLASS_KEYED = /(?:\bclass|Class)["']?\s*[:=]\s*$/;

/** The files, besides sources, whose classes a project defines. */
const STYLESHEET = /\.(?:css|pcss|postcss|scss)$/;

/**
 * Tokens the system has retired, and what each became: a class written before
 * the change still carries the old name. The dates are the config's own.
 */
const RETIRED_TOKENS = {
  accent:
    "`accent` was retired on 2026-10-01: the lime is `ampere`, and it is never a fill — it sits on ink, in Ampere's mark and its working spinner",
  primary:
    "`primary` was retired on 2026-09-25: a link and a chart series take ink, a positive state takes `good`, and `brand` is the mark's and the text selection's",
  danger: "`danger` was retired on 2026-09-25: a destructive action and a form error take `bad`",
};

/**
 * Every token name by its family: `ink` → `ink`, `ink-2`, … `ink-inverse-3`.
 * The family's own name leads; JavaScript would list the numbered steps first.
 */
const COLOUR_FAMILIES_BY_NAME = (() => {
  const out = new Map();
  for (const name of COLOUR_VALUES.keys()) {
    const family = name.split("-")[0];
    if (!out.has(family)) out.set(family, []);
    out.get(family).push(name);
  }
  for (const [family, names] of out) {
    names.sort((a, b) => Number(b === family) - Number(a === family));
  }
  return out;
})();

/** The utility with its variants and `!` stripped: what Tailwind is asked about. */
const bareUtility = (token) => {
  let bare = token;
  for (let m; (m = VARIANT.exec(bare));) bare = bare.slice(m[0].length);
  return bare.replace(/^!/, "");
};

/** The token a bare colour utility names, modifier dropped: `ink-2` in `text-ink-2/80`. */
const tokenOf = (bare) => (UTILITY_STEM.exec(bare)?.[1] ?? "").replace(/\/.*$/, "");

/** Whether a one-word script string can be read as a class on its stem alone. */
const claimsFamily = (bare) => {
  const family = tokenOf(bare).split("-")[0];
  return Object.hasOwn(RETIRED_TOKENS, family) || COLOUR_FAMILIES_BY_NAME.has(family);
};

/** What the finding says beside the class: the retired name's story, or the family's real names. */
const tokenNote = (bare) => {
  const stem = tokenOf(bare);
  const family = stem.split("-")[0];
  if (Object.hasOwn(RETIRED_TOKENS, family)) return RETIRED_TOKENS[family];
  const names = COLOUR_FAMILIES_BY_NAME.get(family);
  if (!names) return undefined;
  const step = stem.slice(family.length + 1);
  const has = step ? `\`${family}\` has no \`${step}\`` : `\`${family}\` alone is not a token`;
  return `${has}; its names are ${names.map((n) => `\`${n}\``).join(", ")}`;
};

/**
 * Every class a stylesheet's selectors name. PostCSS reads the selectors; a
 * sheet it can't parse (a preprocessor's syntax) is read for anything shaped
 * like a class instead, which can only over-collect.
 */
const classNamesInCss = (css) => {
  const names = new Set();
  const add = (name) => names.add(name.replace(/\\(.)/g, "$1"));
  try {
    postcss.parse(css).walkRules((rule) => {
      for (const m of rule.selector.matchAll(/\.((?:\\.|[A-Za-z0-9_-])+)/g)) add(m[1]);
    });
  } catch {
    for (const m of css.matchAll(/(?<![\w)\]"'.-])\.(?!\d)((?:\\.|[A-Za-z0-9_-])+)/g)) add(m[1]);
  }
  return names;
};

/**
 * The colour utilities a file writes, as `{ token, bare, index, sure }`: the
 * class as written, what Tailwind is asked about, where it is, and whether it
 * is plainly a class (see above) or a one-word script string that may be one.
 */
const colourUtilityTokens = function* (text, isVue) {
  const tokens = function* (value, at, sure) {
    for (const t of value.matchAll(/\S+/g)) {
      // What a template literal interpolates is code, not a token.
      if (t[0].includes("${")) continue;
      const bare = bareUtility(t[0]);
      const stem = UTILITY_STEM.exec(bare)?.[1];
      if (!stem || stem.startsWith("[")) continue;
      yield { token: t[0], bare, index: at + t.index, sure };
    }
  };
  const script = function* (code, at) {
    for (const q of code.matchAll(QUOTED)) {
      const value = q[2].replace(/\$\{[^}]*\}/g, "${}");
      const start = at + q.index + 1;
      if (/\s/.test(value.trim())) {
        const words = value.trim().split(/\s+/);
        if (words.every((w) => w.includes("${}") || CLASS_SHAPED.test(w))) {
          yield* tokens(value, start, true);
        }
        continue;
      }
      const lineStart = code.lastIndexOf("\n", q.index) + 1;
      yield* tokens(value, start, CLASS_KEYED.test(code.slice(lineStart, q.index)));
    }
  };
  if (!isVue) {
    yield* script(text, 0);
    return;
  }
  const template = templateOf(text);
  for (const m of template.matchAll(/\s(?:[\w-]+-)?class="([^"]*)"/g)) {
    yield* tokens(m[1], m.index + m[0].length - 1 - m[1].length, true);
  }
  for (const m of template.matchAll(/\s:(?:[\w-]+-)?class="([^"]*)"/g)) {
    const at = m.index + m[0].length - 1 - m[1].length;
    for (const q of m[1].matchAll(QUOTED)) yield* tokens(q[2], at + q.index + 1, true);
  }
  for (const block of text.matchAll(/<script[^>]*>([\s\S]*?)<\/script>/g)) {
    yield* script(block[1], block.index + block[0].length - "</script>".length - block[1].length);
  }
};

/* ------------------------------------------------------------------ *
 * Run
 * ------------------------------------------------------------------ */

/**
 * A config's file pattern: a RegExp, or a path relative to the project, where
 * a path ending in `/` covers everything under it.
 */
const matcher = (glob) => {
  if (glob instanceof RegExp) return (name) => glob.test(name);
  const text = String(glob);
  return text.endsWith("/") ? (name) => name.startsWith(text) : (name) => name === text;
};

/** The order rules are reported in, so related findings sit together. */
const RULE_ORDER = [
  "class-collision",
  "literal-colour",
  "unknown-token",
  "line-modifier",
  "rounded-border",
  "surface-state",
  "state-transition",
  "literal-motion",
  "reduced-motion",
  "squircle-smoothing",
  "squircle",
  "squircle-root-fill",
  "squircle-root-clip",
  "glass-light",
  "raw-input",
  "raw-table",
  "link-drag",
  "select-override",
  "empty-value",
  "layer-number",
  "heading-role",
  "type-weight",
  "icon-weight",
  "icon-family",
  "icon-size",
  "ssr-global",
  "ssr-listener-target",
  "ssr-teleport",
  "copy-glyph",
  "copy-idiom",
  "copy-case",
  "copy-spelling",
  "copy-quotes",
  "copy-busy",
];

/**
 * Lints one project.
 *
 * `root` is the project's directory, and every path is reported relative to
 * it. `config` is its `lint` settings:
 *
 * - `include`: the folders to read, default `["app"]`.
 * - `ssr`: `false` for a client-only app, which skips the server-rendering
 *   rules.
 * - `unchecked`, `copyUnchecked`: files most rules, or the copy rules, don't
 *   read, as `{ glob, why }`.
 * - `properNouns`: words a label may capitalise.
 * - `exceptions`: by rule id, `{ file, match?, why }`.
 *
 * Resolves to the findings, the counts, warnings about the config, and the
 * allowlists in force.
 */
export const lint = async ({ root, config = {} }) => {
  const rel = (file) => toPosix(path.relative(root, file));
  const include = config.include ?? ["app"];
  const ssr = config.ssr !== false;
  const exceptions = config.exceptions ?? {};
  const exceptionsFor = (id) => exceptions[id] ?? [];
  const unchecked = [...UNCHECKED, ...(config.unchecked ?? [])].map((entry) => ({
    ...entry,
    test: matcher(entry.glob),
  }));
  const copyUnchecked = [...COPY_UNCHECKED, ...(config.copyUnchecked ?? [])].map((entry) => ({
    ...entry,
    test: matcher(entry.glob),
  }));
  run.properNouns = new Set([...BASE_PROPER_NOUNS, ...(config.properNouns ?? [])]);
  const rules = RULES.filter((rule) => ssr || !rule.id.startsWith("ssr-"));

  // Sine lints itself from its own root. Anywhere else, its components are
  // read only to learn which of them have a `Squircle` root.
  const self = realDir(root) === realDir(SINE_ROOT);

  const files = (await Promise.all(include.map((dir) => walkIfThere(path.join(root, dir)))))
    .flat()
    .sort();
  const sources = new Map(
    files.map((file) => [rel(file), stripComments(readFileSync(file, "utf8"))]),
  );
  const sineSources = self
    ? []
    : (await walk(path.join(SINE_ROOT, "app/components")))
        .filter((file) => file.endsWith(".vue"))
        .map((file) => [
          toPosix(path.relative(SINE_ROOT, file)),
          stripComments(readFileSync(file, "utf8")),
          { sine: true },
        ]);

  const warnings = [];
  for (const id of Object.keys(exceptions)) {
    if (!(id in EXCEPTION_RULES)) {
      warnings.push(`\`lint.exceptions\` names \`${id}\`, which no rule allows exceptions to`);
      continue;
    }
    for (const entry of exceptions[id]) {
      if (!sources.has(entry.file)) {
        warnings.push(`\`lint.exceptions["${id}"]\` names \`${entry.file}\`, which isn't linted`);
      }
    }
  }

  const findings = [];
  let allowed = 0;

  const registered = pluginClasses();
  const rootedTags = squircleRootedTags([
    ...sineSources,
    ...[...sources].map(([name, text]) => [name, text, { sine: self }]),
  ]);
  const paintingClasses = [...registered.painting, ...stylesheetPaintingClassNames()];

  // The token check's two inputs, gathered as the files are read and settled
  // after them in one Tailwind build: the colour classes every file writes, and
  // the classes the stylesheets define, which Tailwind can't know about.
  const written = [];
  const defined = classNamesInCss(
    readFileSync(path.join(SINE_ROOT, "app/assets/sine.css"), "utf8"),
  );
  for (const dir of include) {
    for (const file of await walkIfThere(path.join(root, dir), STYLESHEET)) {
      for (const className of classNamesInCss(readFileSync(file, "utf8"))) defined.add(className);
    }
  }

  for (const [name, text] of sources) {
    const isUnchecked = unchecked.some((entry) => entry.test(name));

    for (const rule of rules) {
      if (isUnchecked && !READ_EVERYWHERE.has(rule.id)) continue;
      if (rule.files && !rule.files.test(name)) continue;
      // A `requires` rule reads the opposite way round from the others: the match
      // is what the file has to *justify*, and naming the required helper anywhere
      // in the file is the justification.
      if (rule.requires && rule.requires.test(text)) continue;
      const fileExceptions = exceptionsFor(rule.id).filter((e) => e.file === name);

      for (const m of text.matchAll(rule.pattern)) {
        if (rule.skip?.(text, m.index)) continue;
        // Filter captured values against the shared token scales.
        if (rule.filter && !rule.filter(m)) continue;
        // An exception naming no `match` covers the whole file; one naming a
        // literal covers only that literal, so the rest of the file stays read.
        if (fileExceptions.some((e) => !e.match || e.match === m[0])) {
          allowed++;
          continue;
        }
        findings.push({
          rule: rule.id,
          file: name,
          line: lineOf(text, m.index),
          match: m[0],
          hint: rule.hint,
        });
      }
    }

    for (const block of text.matchAll(/<style[^>]*>([\s\S]*?)<\/style>/g)) {
      for (const className of classNamesInCss(block[1])) defined.add(className);
    }

    if (isUnchecked) continue;

    for (const c of colourUtilityTokens(text, name.endsWith(".vue"))) {
      written.push({ file: name, ...c });
    }

    if (!copyUnchecked.some((entry) => entry.test(name))) {
      const isVue = name.endsWith(".vue");
      for (const s of copyStrings(text, isVue)) {
        for (const rule of COPY_RULES) {
          const hit = rule.test(s.value);
          if (!hit) continue;
          findings.push({
            rule: rule.id,
            file: name,
            line: lineOf(text, s.index),
            match: s.value.replace(/\s+/g, " ").slice(0, 72),
            hint: rule.hint,
          });
        }
      }
      if (isVue) {
        for (const m of templateOf(text).matchAll(BUSY_SWAP)) {
          if (m[4].endsWith("…")) continue;
          findings.push({
            rule: "copy-busy",
            file: name,
            line: lineOf(text, m.index),
            match: m[0].slice(0, 72),
            hint: '`Button loading` is the busy state and keeps the label; a label that swaps for "Saving…" moves the button mid-click and says nothing the spinner does not',
          });
        }
      }
    }

    const squircleExceptions = exceptionsFor("squircle").filter((e) => e.file === name);
    for (const literal of classStrings(text, name.endsWith(".vue"))) {
      if (!SQUIRCLE_RADII.test(literal.value)) continue;
      const pill = SQUIRCLE_PILL.test(literal.value);
      if (
        (!pill && !SQUIRCLE_FILL.test(literal.value)) ||
        (pill && CSS_CIRCLE.test(literal.value))
      ) {
        continue;
      }
      if (
        (!pill && SQUIRCLE_SHAPES.test(literal.value)) ||
        squircleExceptions.some((e) => !e.match || literal.value.includes(e.match))
      ) {
        allowed++;
        continue;
      }
      findings.push({
        rule: "squircle",
        file: name,
        line: lineOf(text, literal.index),
        match: literal.value.replace(/\s+/g, " ").trim().slice(0, 72),
        hint: "a filled box at radius >= 12px is a squircle; a non-circular `rounded-full` shape is a `Pill`, and fills go on `surfaceClass`",
      });
    }

    for (const { tag, square, index } of squareFullSquircles(text)) {
      findings.push({
        rule: "squircle",
        file: name,
        line: lineOf(text, index),
        match: `<${tag} class="… ${square} …">`,
        hint: "a true equal-size circle stays `rounded-full`; `Pill`/`radius=full` deliberately preserves 0.7 smoothing",
      });
    }

    for (const literal of classStrings(text, name.endsWith(".vue"))) {
      if (!roundedTranslucentBorder(literal.value)) continue;
      findings.push({
        rule: "rounded-border",
        file: name,
        line: lineOf(text, literal.index),
        match: literal.value.replace(/\s+/g, " ").trim().slice(0, 72),
        hint: ROUNDED_BORDER_HINT,
      });
    }

    for (const literal of motionClassStrings(text, name.endsWith(".vue"))) {
      for (const m of literal.value.matchAll(TAILWIND_MOTION)) {
        findings.push({
          rule: "literal-motion",
          file: name,
          line: lineOf(text, literal.index),
          match: m[0],
          hint: "Tailwind's own duration and easing scales are numbers and curves the system does not have — `duration-fast`, `duration-base`, `ease-standard`, `ease-exit` (see `utils/motion.ts`)",
        });
      }
    }

    for (const { tag, moving, index } of focusStrokeTransitions(text)) {
      findings.push({
        rule: "state-transition",
        file: name,
        line: lineOf(text, index),
        match: `<${tag} data-focus-border class="… ${moving.join(" ")} …">`,
        hint: "a focus stroke lands on the next frame and never fades (decision 11) — no transition on an element carrying `data-focus-border`, whatever property it names",
      });
    }

    if (!name.endsWith(".vue")) continue;
    for (const { tag, fills, index } of rootFills(text, rootedTags, paintingClasses)) {
      findings.push({
        rule: "squircle-root-fill",
        file: name,
        line: lineOf(text, index),
        match: `<${tag} class="… ${fills.join(" ")} …">`,
        hint: ROOT_FILL_HINT,
      });
    }
    for (const { tag, clips, index } of rootClips(text, rootedTags)) {
      findings.push({
        rule: "squircle-root-clip",
        file: name,
        line: lineOf(text, index),
        match: `<${tag} class="… ${clips.join(" ")} …">`,
        hint: ROOT_CLIP_HINT,
      });
    }
  }

  // The token check, now that every file has been read: one Tailwind build over
  // every colour class written, and a finding for each that comes back with no
  // rule and that no stylesheet defines. An exception names the class as
  // written or its bare utility.
  if (written.length) {
    const generated = await generatedClassNames([...new Set(written.map((c) => c.bare))], {
      plugins,
    });
    const tokenExceptions = exceptionsFor("unknown-token");
    for (const c of written) {
      if (generated.has(c.bare) || defined.has(c.bare)) continue;
      if (!c.sure && !claimsFamily(c.bare)) continue;
      if (
        tokenExceptions.some(
          (e) => e.file === c.file && (!e.match || e.match === c.token || e.match === c.bare),
        )
      ) {
        allowed++;
        continue;
      }
      findings.push({
        rule: "unknown-token",
        file: c.file,
        line: lineOf(sources.get(c.file), c.index),
        match: c.token,
        note: tokenNote(c.bare),
        hint: UNKNOWN_TOKEN_HINT,
      });
    }
  }

  // A plugin class Tailwind also generates is a fault in Sine's config, not in
  // the project, so only Sine's own run asks.
  if (self) {
    for (const name of await collidingClassNames(registered.names)) {
      findings.push({
        rule: "class-collision",
        file: "tailwind.config.ts",
        line: 0,
        match: `.${name}`,
        hint: `Tailwind generates a \`${name}\` utility, which is emitted after the components layer and wins on source order — rename the component class`,
      });
    }
  }

  findings.sort(
    (a, b) =>
      RULE_ORDER.indexOf(a.rule) - RULE_ORDER.indexOf(b.rule) ||
      a.file.localeCompare(b.file) ||
      a.line - b.line,
  );

  // Distinct rule ids, not `RULES` entries: some rules carry several patterns.
  const ruleIds = new Set([
    ...rules.map((r) => r.id),
    ...COPY_RULES.map((r) => r.id),
    "copy-busy",
    "squircle",
    "squircle-root-fill",
    "squircle-root-clip",
    "rounded-border",
    "unknown-token",
    ...(self ? ["class-collision"] : []),
  ]);

  return {
    root,
    files: files.length,
    rules: ruleIds.size,
    allowed,
    findings,
    warnings,
    allowlists: [
      ["not read at all", unchecked.map((u) => ({ file: String(u.glob), why: u.why }))],
      ...Object.keys(EXCEPTION_RULES).map((id) => [id, exceptionsFor(id)]),
      [
        "copy-* (not read at all)",
        copyUnchecked.map((u) => ({ file: String(u.glob), why: u.why })),
      ],
    ],
    rootedTags,
    paintingClasses,
  };
};

/** The run as text: what `sine lint` prints. */
export const formatLint = (result, { list = false } = {}) => {
  const out = [];
  if (list) {
    for (const [label, entries] of result.allowlists) {
      if (!entries.length) continue;
      out.push("", label);
      for (const e of entries) {
        out.push(`  ${e.file}${e.match ? `  (${e.match})` : ""}`, `    ${e.why}`);
      }
    }
    out.push(
      "",
      "squircle-root-fill and squircle-root-clip read the class on these tags (derived)",
      `  ${result.rootedTags.join(", ")}`,
      "",
      "…for these fills, besides any `bg-*`",
      `  ${result.paintingClasses.map((c) => `.${c}`).join(", ")}`,
      "",
    );
  }
  for (const warning of result.warnings) out.push(`sine lint: warning — ${warning}`);
  if (!result.findings.length) {
    out.push(
      `sine lint: clean — ${result.files} files, ${result.rules} rules, ${result.allowed} allowlisted exceptions`,
    );
    return out.join("\n");
  }
  let current = null;
  for (const f of result.findings) {
    if (f.rule !== current) {
      current = f.rule;
      out.push("", f.rule, `  ${f.hint}`);
    }
    // A note is the one finding's own, where the hint is the rule's.
    out.push(
      `    ${f.file}${f.line ? `:${f.line}` : ""}  ${f.match}${f.note ? `  — ${f.note}` : ""}`,
    );
  }
  out.push(
    "",
    `sine lint: ${result.findings.length} findings across ${new Set(result.findings.map((f) => f.file)).size} files`,
  );
  return out.join("\n");
};
