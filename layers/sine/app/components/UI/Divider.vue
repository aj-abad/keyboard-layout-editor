<template>
  <hr
    :class="
      cn(
        'list-hairline flow-root h-0 overflow-visible border-0',
        INSET[inset],
        $attrs.class as string,
      )
    " />
</template>

<script setup lang="ts">
import { cn } from "../../utils/cn";
/**
 * A hairline between rows. It is an `<hr>` of no height carrying
 * `.list-hairline`, so it takes no space and its line lies half above and half
 * below where it sits: the rows either side share it as a collapsed border.
 * `overflow-visible` undoes the browser's `overflow: hidden` on `hr`, which
 * would clip the line from a box with no height, and `flow-root` stands in
 * for the formatting context that `overflow` gave it: without one, a block
 * with no height and no border lets its top and bottom margins collapse into
 * one, and `my-2` would hold the rows 8px apart instead of 16. This component
 * exists so the *inset* is a named choice rather than a copied class string:
 *
 * - `card` — `ml-4 my-2`, the settings-page idiom between `Settings/Row`s.
 *   Inset on the leading side to the row's `px-4`, where its label starts,
 *   and run to the card's trailing edge: the hairline-list rule, which a row
 *   with a leading glyph draws from its label with `.list-hairline` instead
 *   (see Patterns › Hairline lists). The 8px either side is the rows' room,
 *   as the card's `py-2` is at the ends, so two rows sit 16px apart with the
 *   line on their midline. It was `mx-4` until 2026-09-14, stopping short of
 *   the edge that the row's own fill reaches.
 * - `menu` — `mx-1 my-1`, between groups in a `MenuSurface`.
 * - `none` — edge to edge, for a table-like list.
 */
const INSET = {
  none: "",
  card: "ml-4 my-2",
  menu: "mx-1 my-1",
} as const;

const { inset = "card" } = defineProps<{
  inset?: keyof typeof INSET;
}>();

defineOptions({ inheritAttrs: false });
</script>
