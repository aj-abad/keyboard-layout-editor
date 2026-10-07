# Keyboard Layout Editor

A personal, local editor built with Nuxt 4, Vite, Tailwind CSS 4, and Reka UI.
System fonts and solid backgrounds; no accounts or external services.

Requires a supported Node.js release: 22.22.3+ (22.x), 24.15+ (24.x), or 26+.

```sh
npm ci
npm run dev
```

Open the URL shown in the terminal. Edit keys, load a preset, or open KLE JSON.
The current layout autosaves in this browser. Export JSON for a portable backup;
SVG and PNG exports are also available. Imported legends are displayed as plain
text; custom CSS, embedded HTML, and texture/font assets are not rendered.

`npm run build` creates the static app in `.output/public`.
`npm run preview` previews it. `npm run typecheck` and `npm test` verify the source.

Based on Ian Prest's Keyboard Layout Editor. Original [license](LICENSE.md) retained.
