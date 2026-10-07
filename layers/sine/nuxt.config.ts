import { fileURLToPath } from "node:url";

const here = (path: string) => fileURLToPath(new URL(path, import.meta.url));

/**
 * Arcon Sine, the design system, as a local Nuxt layer: the part of
 * `@arcon.mobi/sine` 0.6.6 this editor uses (see README.md beside this file).
 * Nuxt registers every layer in `layers/` on its own, so the editor extends it
 * without naming it.
 *
 * Inside the layer, every file imports what it uses, by relative path, and
 * leans on no auto-import: the app switches Sine's off (`sine: { autoImports:
 * false }`, `module.ts`), and reaches a file by path through `#layers/sine/…`.
 * Vite would read `~/` there as the layer's own `app/`, but Vue's compiler
 * resolves a prop's imported type through the app's tsconfig, where `~/` is the
 * app's.
 *
 * The packages the layer imports are the editor's own dependencies, so Vite
 * pre-bundles them by their plain names.
 */
export default defineNuxtConfig({
  // Names the layer, which gives the app the `#layers/sine/…` alias.
  $meta: { name: "sine" },
  components: [
    // The primitives go by their own names: `UI/Button.vue` is `<Button>`. Nuxt
    // scans the deeper directory first, so these files never reach the entry
    // below.
    { path: "components/UI", extensions: ["vue"] },
    // The other groups keep their folder: `Shared/ConfirmDialog.vue` is
    // `<SharedConfirmDialog>`. Only `.vue` files are components; the geometry
    // helpers beside them are modules.
    { path: "components", extensions: ["vue"] },
  ],
  app: {
    head: {
      link: [
        { rel: "stylesheet", href: "/css/font.css" },
        {
          rel: "preload",
          as: "font",
          href: "/fonts/PPNeueMontreal-Variable.woff2",
          type: "font/woff2",
          crossorigin: "anonymous",
        },
      ],
    },
  },
  modules: [here("./module"), "@nuxtjs/tailwindcss"],
  tailwindcss: {
    // The system's stylesheet, by absolute path: a relative or `~/` path here
    // would resolve against the app that extends the layer. The theme and the
    // plugins come from `tailwind.config.ts` beside this file, which the
    // module loads once for the layer.
    cssPath: here("./app/assets/sine.css"),
    viewer: false,
    exposeConfig: false,
    quiet: true,
  },
  vite: {
    optimizeDeps: {
      include: [
        "@vueuse/core",
        "class-variance-authority",
        "motion-v",
        "reka-ui",
        "tailwind-merge",
        // The tokens import Tailwind's plugin helper, and components import the tokens.
        "tailwindcss/plugin.js",
      ],
    },
  },
});
