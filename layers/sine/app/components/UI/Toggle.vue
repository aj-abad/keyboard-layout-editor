<template>
  <Pill
    :as="SwitchRoot"
    :model-value="checked"
    :disabled="disabled"
    :aria-label="ariaLabel"
    :data-key-press="keyPress ? '' : undefined"
    surface-class="bg-fill-3 group-[:enabled:not([data-key-press]):active]/toggle:bg-fill-4 after:absolute after:inset-0 after:bg-surface-inverse after:opacity-0 after:transition-opacity after:duration-fast after:ease-standard group-data-[state=checked]/toggle:after:opacity-100 group-[:enabled:not([data-key-press]):active]/toggle:after:bg-surface-inverse-pressed"
    :class="
      cn(
        'group/toggle relative shrink-0 cursor-pointer rounded-full focus-ring disabled:cursor-not-allowed disabled:opacity-50',
        size === 'sm' && 'h-5 w-9',
        size === 'md' && 'h-6 w-10',
        className,
      )
    "
    v-bind="$attrs"
    @keydown="onKey"
    @keyup="onKey"
    @blur="keyPress = false"
    @update:model-value="(v: boolean) => (checked = v)">
    <SwitchThumb
      :class="
        cn(
          'relative block translate-x-0.5 rounded-full bg-surface shadow-sm transition-[transform,width] duration-fast ease-standard will-change-transform after:absolute after:inset-0 after:rounded-full group-[:enabled:not([data-key-press]):active]/toggle:after:bg-fill-2',
          size === 'sm' &&
            'size-4 data-[state=checked]:translate-x-[18px] group-[:enabled:not([data-key-press]):active]/toggle:w-[19px] group-[:enabled:not([data-key-press]):active]/toggle:data-[state=checked]:translate-x-[15px]',
          size === 'md' &&
            'size-5 data-[state=checked]:translate-x-[18px] group-[:enabled:not([data-key-press]):active]/toggle:w-6 group-[:enabled:not([data-key-press]):active]/toggle:data-[state=checked]:translate-x-3.5',
        )
      " />
  </Pill>
</template>

<script setup lang="ts">
import { SwitchRoot, SwitchThumb } from "reka-ui";
import Pill from "./Pill.vue";
import { cn } from "../../utils/cn";

/**
 * The switch — and the one control whose state colour is allowed to
 * transition. Its thumb travels, so the track colour crossfades over the same
 * `duration-fast` and the two arrive together; a colour may ride on a transform
 * that way, and may not move on its own (decision 11, `docs/design-system.md`
 * § Motion). Nothing else gets this exception by default.
 *
 * The crossfade is the checked colour as a layer over the unchecked one, fading
 * in by opacity, so that it is the only thing that moves. A press steps both
 * colours to their pressed shades — `fill-4` off, `surface-inverse-pressed` on
 * — and lays `fill-2` over the thumb, and all three land on the next frame, on
 * the way in and on the way out. There is no hover: the pointer cursor already
 * says the switch can be clicked.
 *
 * **A press also stretches the thumb toward where it would go**, by about a
 * fifth of its width (20px to 24px at `md`, 16px to 19px at `sm`), over the
 * same `duration-fast`. Off, it grows to the right; on, it grows to the left,
 * its translate giving back the same pixels, so in both the end at the track's
 * edge holds still. The release that flips the switch runs the travel and the
 * return to a circle together.
 *
 * **The press answers the pointer, not the keyboard.** Chrome holds a button
 * `:active` for as long as Space is down on it, which would darken and stretch
 * a switch flipped from the keyboard before it moved. Space and Enter mark the
 * switch `data-key-press` while they are down, and every press style is
 * `group-[:enabled:not([data-key-press]):active]/toggle:`, so a keyboard flip
 * is the travel alone. `:enabled`, because Chrome matches `:active` on a
 * disabled button too; `:active` last, or the design lint's `surface-state`
 * rule takes it for a bare `active:`. The pointer's press is still `:active`
 * rather than a pointer handler, so a press on the name of a `label-for` row
 * shows on the switch it names.
 *
 * **The ring is an outline, 2px outside the track.** The thumb sits 2px inside
 * it, where a stroke along the edge or the primary button's cut would run, and
 * the checked track is `surface-inverse`, the ring's own colour. The outline
 * stays outside in both states, so a switch flipped from the keyboard keeps its
 * ring where it was. At this size the pill's end is within a tenth of a pixel of
 * a semicircle, which is the shape `rounded-full` gives the outline.
 *
 * **The one control the field contract deliberately skips.** A switch changes a
 * persistent setting or feature state immediately. It is never required, never
 * optional, and has no value to refuse — and its name is not its own: its
 * `Settings/Row` owns the name and the description. Growing a `label` here would
 * mean two ways to name a toggle. What it does take is the wiring: `$attrs` land
 * on the switch itself, so pass the row's `describedBy` slot prop as
 * `aria-describedby` and the sentence under the name is finally read out with it.
 */
const {
  disabled = false,
  ariaLabel,
  size = "md",
  class: className,
} = defineProps<{
  disabled?: boolean;
  ariaLabel?: string;
  size?: "sm" | "md";
  class?: string;
}>();

const checked = defineModel<boolean>("checked", { required: true });

/**
 * Whether Space or Enter is down on the switch. Blur clears it, as it clears
 * `:active`, for a key that is let go after focus has moved on.
 */
const keyPress = shallowRef(false);
const onKey = (event: KeyboardEvent) => {
  if (event.key === " " || event.key === "Enter") keyPress.value = event.type === "keydown";
};

defineOptions({
  inheritAttrs: false,
});
</script>
