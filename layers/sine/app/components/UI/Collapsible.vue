<template>
  <CollapsibleRoot
    v-model:open="open"
    :as="as"
    :as-child="asChild"
    :disabled="disabled"
    :class="$attrs.class as string"
    v-bind="rest">
    <slot :open="open" />
  </CollapsibleRoot>
</template>

<script setup lang="ts">
import { CollapsibleRoot } from "reka-ui";

/**
 * A disclosure: a trigger, and a panel that reveals under it.
 *
 * ```vue
 * <Collapsible v-model:open="showDefaults">
 *   <CollapsibleTrigger variant="row" size="md">Setup defaults</CollapsibleTrigger>
 *   <CollapsibleContent class="px-3 pb-3 pt-2">…</CollapsibleContent>
 * </Collapsible>
 * ```
 *
 * The portal had eleven of these and no two agreed. Two were raw
 * `<details>`/`<summary>` with no animation at all; the rest were a hand-wired
 * `aria-expanded` button beside a `v-if` panel, animated by four different
 * means — a `motion-v` spring at `bounce: 0.15, duration: 0.35`, another at
 * `duration: 0.1` with its own variants object, and twice by nothing. Carets
 * rotated over 150ms, 200ms, or the Tailwind default. None of them wired
 * `aria-controls`, so a screen reader was told a button was expanded without
 * being told what it expanded.
 *
 * Reka's `Collapsible` supplies the part that was wrong everywhere: the
 * trigger and the panel share a generated id, so `aria-expanded` arrives with
 * an `aria-controls` that points at the thing it describes, and the panel
 * stays in the DOM as `hidden` rather than being torn out — which is what
 * lets it animate closed instead of vanishing.
 *
 * **Order inside the root is free.** The trigger and the panel find each other
 * through context, not through the DOM, so a "show N more" disclosure can put
 * the panel *above* its trigger and keep the button at the bottom of the list
 * where it has always been — `Overview/AttentionList.vue` and the QR codes page
 * both do.
 *
 * `as-child` when the caller already draws the element the root should be — a
 * card that *is* the disclosure, like `RegisterStation/Form.vue`'s. Otherwise
 * the root is a `div`, or whatever `as` names.
 */
const {
  as = "div",
  asChild = false,
  disabled = false,
} = defineProps<{
  as?: string;
  /** Use the single child element as the root, rather than wrapping it. */
  asChild?: boolean;
  disabled?: boolean;
}>();

const open = defineModel<boolean>("open", { default: false });

defineOptions({ inheritAttrs: false });

const attrs = useAttrs();
const rest = computed(() => {
  const { class: _class, ...others } = attrs;
  return others;
});
</script>
