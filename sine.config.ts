import { defineConfig } from "./layers/sine/cli/config.mjs";

/**
 * The editor's run of Arcon Sine's checks (`pnpm lint:design`, `pnpm doctor:sine`).
 * An entry here is something the editor states on purpose, with its reason;
 * code that disagrees with Sine changes instead.
 */
export default defineConfig({
  lint: {
    // A client-only app: nothing renders on the server.
    ssr: false,

    // Names a label may capitalize.
    properNouns: ["KLE", "JSON", "SVG", "PNG", "ISO", "ANSI", "Ian", "Prest"],

    unchecked: [
      {
        glob: "app/utils/svg.ts",
        why: "the keycap renderer: plate, keycap and legend colors are the layout's own data, drawn the same in the editor and in every export",
      },
      {
        glob: "app/utils/layout.ts",
        why: "KLE's own defaults for a layout's colors, in KLE's format: document data, not this app's chrome",
      },
    ],

    copyUnchecked: [
      {
        glob: "app/utils/svg.ts",
        why: "SVG markup and the legends' font stack, not prose",
      },
    ],

    exceptions: {
      "raw-input": [
        {
          file: "app/components/ColorField.vue",
          why: "a transparent `type=color` laid over the swatch that opens it: the swatch is its chrome, and the picker is the platform's",
        },
        {
          file: "app/components/FilePicker.vue",
          why: "a hidden `type=file` behind Open… and the window-wide drop zone, which are its chrome",
        },
        {
          file: "app/components/LegendEditor.vue",
          why: "a legend typed where it is drawn on its keycap, in the legend's own type and color: HeadlineInput's idea at a keycap's scale, where a field's shell would cover the cap",
        },
      ],
    },
  },
});
