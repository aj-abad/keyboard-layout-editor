<template>
  <CollapsibleContent
    :as="as"
    :class="cn('collapsible-panel', $attrs.class as string)"
    v-bind="rest">
    <slot />
  </CollapsibleContent>
</template>

<script setup lang="ts">
import { CollapsibleContent } from "reka-ui";
import { cn } from "../../utils/cn";

/**
 * The panel a `Collapsible` reveals.
 *
 * The reveal is a CSS animation over `--reka-collapsible-content-height`, which
 * Reka measures and writes on this element — a height animation needs a number
 * to travel to, and `auto` is not one. `.collapsible-panel` lives in
 * `app/assets/sine.css` beside the menu's `.dropdown-content` for the same
 * reason that one does: the house open/close motion is one thing, and keeping
 * the two in one file is what stops them drifting. It runs at
 * `duration.reveal` — the 250ms the token table already reserved for "height
 * reveals, disclosures" — and honours `prefers-reduced-motion`.
 *
 * `overflow: hidden` comes with it, because that is what a height animation
 * clips against. A panel that must not be clipped while open is not this
 * component.
 *
 * **The gap above the panel goes inside it, not on it.** A `mt-*` on this
 * element is outside the box whose height animates, so it holds its full
 * height while the panel is closed — a margin the disclosure can never close.
 * `overflow: hidden` makes the panel its own block formatting context, so a
 * margin on the first child is measured into the height Reka travels to and
 * disappears with it.
 *
 * The element stays in the DOM when closed, carrying `hidden` — that is what
 * lets it animate closed rather than disappear, and it is why `aria-controls`
 * on the trigger always names something real. Reka renders the slot only while
 * open, so a closed panel costs nothing but its wrapper.
 *
 * `as` for a panel whose position demands a tag: an `ol`/`ul` continuing the
 * list its trigger sits under, which is how the "N more" disclosures avoid
 * putting a `div` inside a `<ul>`.
 */
const { as = "div" } = defineProps<{ as?: string }>();

defineOptions({ inheritAttrs: false });

const attrs = useAttrs();
const rest = computed(() => {
  const { class: _class, ...others } = attrs;
  return others;
});
</script>
