<template>
  <!-- Mounted inside an `<svg>`'s `<defs>`, and applied to a black copy of the
       shape: the light reads the shape's alpha, never its colour. -->
  <filter :id color-interpolation-filters="sRGB">
    <!-- The outline, blurred: a height field whose slope is steepest at the
         edge and flat inside it, where the shape's distance field would be. -->
    <feGaussianBlur in="SourceAlpha" :stdDeviation="width / 2" result="height" />
    <!-- A normal at every pixel of that field, lit with a Phong term by the
         one distant light. -->
    <feSpecularLighting
      in="height"
      :surfaceScale="width * rim.steepness"
      specularConstant="1"
      :specularExponent="rim.exponent"
      :lighting-color="ink.inverse"
      result="light">
      <feDistantLight :azimuth="lighting.azimuth" :elevation="lighting.elevation" />
    </feSpecularLighting>
    <!-- The flat face, the rim's width in from the outline and softened, cut
         out of the light: a light that high lifts a flat face too, as a sheen.
         Drawn, it is the source's red channel. -->
    <template v-if="face === 'drawn'">
      <feColorMatrix
        in="SourceGraphic"
        type="matrix"
        values="0 0 0 0 0  0 0 0 0 0  0 0 0 0 0  1 0 0 0 0"
        result="face" />
      <feGaussianBlur in="face" :stdDeviation="width / 2" result="faceSoft" />
    </template>
    <template v-else>
      <!-- Derived, it is how deep a pixel sits in the shape: its alpha blurred
           by the rim's width, read through the ramp that gives the drawn
           face's soft edge along a straight one. -->
      <feGaussianBlur in="SourceAlpha" :stdDeviation="width" result="depth" />
      <feComponentTransfer in="depth" result="faceSoft">
        <feFuncA type="table" :tableValues="FACE_RAMP" />
      </feComponentTransfer>
    </template>
    <feComposite in="light" in2="faceSoft" operator="out" result="band" />
    <!-- And the shape's own alpha, so nothing lights outside it. -->
    <feComposite in="band" in2="SourceAlpha" operator="in" />
  </filter>
</template>

<script lang="ts">
/** The standard normal CDF, by Abramowitz and Stegun's 7.1.26 (error under 2e-7). */
const normal = (x: number) => {
  const z = Math.abs(x) / Math.SQRT2;
  const t = 1 / (1 + 0.3275911 * z);
  const erf =
    1 -
    ((((1.061405429 * t - 1.453152027) * t + 1.421413741) * t - 0.284496736) * t + 0.254829592) *
      t *
      Math.exp(-z * z);
  return 0.5 * (1 + Math.sign(x) * erf);
};
const inverseNormal = (p: number) => {
  let low = -8;
  let high = 8;
  for (let step = 0; step < 50; step++) {
    const mid = (low + high) / 2;
    if (normal(mid) < p) low = mid;
    else high = mid;
  }
  return (low + high) / 2;
};

/**
 * The derived face's ramp. Blurred by the rim's width `w`, the shape's alpha
 * reads `Φ(d / w)` at a depth `d` in from a straight edge; the drawn face,
 * `w` in and softened by `w / 2`, reads `Φ((d − w) / (w / 2))` there. The
 * table maps one to the other, so the two agree along an edge.
 */
const FACE_RAMP = Array.from({ length: 65 }, (_, index) => {
  const blurred = index / 64;
  if (blurred <= 0 || blurred >= 1) return blurred;
  return normal(2 * inverseNormal(blurred) - 2);
})
  .map((value) => value.toFixed(4))
  .join(" ");
</script>

<script setup lang="ts">
import { glassEdge, ink, lighting } from "../../../tailwind.config";

/**
 * The lit rim of glass, as an SVG filter: `glassEdge` in `tailwind.config.ts`
 * has what each step is for, and the numbers. Both renderers draw with this
 * one definition — a glass `Squircle` inside its own chrome, and the
 * `.glass-*` classes through the document's `#glass-rim-sm`, `-md` and `-lg`
 * (`GlassFilters`) — so neither can light its edge differently.
 *
 * `width` is the level's `rim` from `glass`: how far in from the outline the
 * rim lights. Everything else scales from it, so a wider rim is the same bevel
 * at a larger size, as bright and lit from the same side.
 *
 * `face` is where the flat face comes from. `drawn`: the source paints it in
 * red over the black shape, the outline moved `width` in, and a squircle does,
 * on the concentric corner its strokes take, so the rim is exactly as wide
 * through a corner as along an edge. `derived` finds it from the shape's alpha,
 * for the classes, whose pseudo-element has to stay black: drawn unfiltered,
 * when the document's filters are missing, black under `plus-lighter` adds
 * nothing. It is never an erosion, which SVG does with a square: that cuts a
 * corner's diagonal √2 as deep as an edge.
 *
 * The region is the filter's default, 10% past the shape's box on every side,
 * in the shape's own units, so one definition fits a pill and a sheet alike.
 * The result is light to be added to the surface: the layer that draws it
 * carries `mix-blend-mode: plus-lighter`.
 */
withDefaults(defineProps<{ id: string; width: number; face?: "drawn" | "derived" }>(), {
  face: "derived",
});

const rim = glassEdge.rim;
</script>
