<template>
  <div
    ref="root"
    :class="[
      'select-trigger relative',
      aligned && 'select-trigger--aligned',
      focusReturning && 'select-trigger--returning',
    ]">
    <component :is="primitive" as-child :disabled="disabled">
      <Squircle
        as="button"
        type="button"
        v-bind="$attrs"
        :class="
          cn(selectTriggerVariants({ size }), 'select-trigger-button text-left', triggerClass)
        "
        :radius="radius"
        :surface-class="surfaceClass ?? selectSurfaceClass(disabled)"
        :border-width="bordered ? 1 : 0"
        :border-color="CONTROL_BORDER_COLOR">
        <!-- The leading icon's well: a square the trigger's height at its
             start, the one `Input` draws for `icon-prepend`, so a value
             beside an icon starts on the same column in either field. It
             gives back the start padding and the gap, which it stands in for. -->
        <span
          v-if="$slots.leading"
          :class="
            cn(
              'flex shrink-0 items-center justify-center self-stretch text-ink-4 [&_svg]:size-4.5',
              LEADING[size],
            )
          "
          aria-hidden="true">
          <slot name="leading" />
        </span>
        <!-- The value's box is as wide as the widest label the trigger can
             show: every one of them sits invisibly in this grid cell with the
             value, so the browser sizes the cell to the widest and a new value
             changes the text, not the box. The labels truncate, so the cell
             still shrinks below the widest when the row runs out of room. -->
        <span class="grid min-w-0 flex-1">
          <span
            v-for="text in ghosts"
            :key="text"
            aria-hidden="true"
            class="invisible col-start-1 row-start-1 truncate">
            {{ text }}
          </span>
          <span class="col-start-1 row-start-1 min-w-0">
            <slot />
          </span>
        </span>
        <!-- The clear button's seat, held whether or not there is anything to
             clear, so the button's arrival moves nothing. A button cannot hold
             another, so the button itself is drawn over this box from outside. -->
        <span v-if="clearLabel" :class="cn('shrink-0', CLEAR[size].seat)" aria-hidden="true" />
        <span class="flex shrink-0 text-ink-4" aria-hidden="true">
          <slot name="caret">
            <IconNucleoChevronExpandY v-if="aligned" :size="18" />
            <IconNucleoChevronDown
              v-else
              :size="18"
              class="select-trigger-chevron transition-transform duration-base ease-standard" />
          </slot>
        </span>
      </Squircle>
    </component>
    <!-- The ring: a second squircle over the keyline, because an outline
         cannot follow the smoothed corner. It shows on the next frame and never
         fades (decision 11), and an aligned list takes it away while it lies
         on the trigger: see the rules below. -->
    <Squircle
      class="select-trigger-ring pointer-events-none absolute inset-0 opacity-0"
      data-focus-border
      :radius="radius"
      :border-width="2"
      :border-color="CONTROL_FOCUS_COLOR"
      aria-hidden="true" />
    <!-- The clear button, over its seat. The row is the trigger's own classes,
         the same height, padding and gap, with a box the caret's width at its
         end, so the button lands on the seat by the same arithmetic that placed
         the seat. -->
    <div
      v-if="clearLabel && hasValue && !disabled"
      :class="
        cn(selectTriggerVariants({ size }), triggerClass, 'pointer-events-none absolute inset-0')
      ">
      <span class="flex-1" />
      <IconButton
        :size="CLEAR[size].button"
        class="pointer-events-auto"
        :aria-label="clearLabel"
        disable-tooltip
        @click="clearFromButton">
        <IconNucleoXmark />
      </IconButton>
      <span class="size-4.5 shrink-0" aria-hidden="true" />
    </div>
  </div>
</template>

<script setup lang="ts">
import type { Component } from "vue";
import IconNucleoChevronDown from "../Icon/Nucleo/ChevronDown.vue";
import IconNucleoChevronExpandY from "../Icon/Nucleo/ChevronExpandY.vue";
import IconNucleoXmark from "../Icon/Nucleo/Xmark.vue";
import {
  CONTROL_BORDER_COLOR,
  CONTROL_FOCUS_COLOR,
  controlRadius,
} from "../../utils/controlSquircle";
import {
  selectSurfaceClass,
  selectTriggerVariants,
  type SelectTriggerVariants,
} from "../../utils/selectVariants";
import { Squircle } from "../../utils/squircle";
import { cn } from "../../utils/cn";
import IconButton from "./IconButton.vue";

/**
 * The trigger the select family opens from: `UI/Select.vue`, `UI/MultiSelect.vue`
 * and the pickers, `UI/DateSelector.vue`, `UI/DateRangeSelector.vue` and
 * `UI/TimePicker.vue`. Everything they draw around a value lives here, once,
 * because it was written more than once and drifted: the squircle and its
 * keyline, the ring, the caret, the sizing, and the clear button with its seat.
 *
 * `primitive` is the Reka trigger to render it through, `SelectTrigger`, or the
 * `PopoverTrigger` a `Popover` with `primitive-trigger` hands its slot, with
 * `as-child`, so the squircle button *is* the combobox. It is passed in rather
 * than wrapped around this component because the ring and the clear button are
 * the button's siblings, and an `as-child` on a wrapper would make the wrapper
 * the combobox. Attributes land on the button, which is what takes the
 * accessible name.
 */
defineOptions({ inheritAttrs: false });

type Size = NonNullable<SelectTriggerVariants["size"]>;

const {
  primitive,
  size = "md",
  rounded = false,
  disabled = false,
  bordered = true,
  surfaceClass,
  triggerClass,
  position = "popper",
  sizingLabels = [],
  clearLabel,
  hasValue = false,
  focusReturning = false,
} = defineProps<{
  /** The Reka trigger this renders through with `as-child`. */
  primitive: Component;
  size?: Size;
  /** Pill instead of `rounded-lg`, matching `UI/Input.vue`'s `rounded`. */
  rounded?: boolean;
  disabled?: boolean;
  /**
   * The resting keyline. Drop it where the trigger sits inside a tinted panel
   * that is already its edge. It has to be a prop: the keyline is one of the
   * squircle's SVG strokes, so a `border-0` class is inert.
   */
  bordered?: boolean;
  /** Trigger fill. A `bg-*` in `triggerClass` would square off the corners. */
  surfaceClass?: string;
  /** Type and spacing of the trigger. Spacing is mirrored onto the clear row. */
  triggerClass?: string;
  /**
   * Where the list opens, `UI/Select.vue`'s `position`, which settles the
   * caret and the ring while the list is open.
   *
   * `aligned` lays the list over the trigger, running above and below it. The
   * caret is the pop-up button's pair of chevrons and holds still, and the ring
   * goes while the list lies on the trigger: the list covers it but for its
   * corners, which the list's rounder corner leaves showing.
   *
   * `popper` hangs the list below. The caret is a down chevron that turns while
   * the list is open, and the ring stays, to say whose list it is.
   */
  position?: "aligned" | "popper";
  /**
   * Every string the trigger can show: the options, the placeholder, the clear
   * row, a count at its largest. The trigger is as wide as the widest of them
   * and holds that width whatever it shows, so a choice moves nothing beside it
   * and the list's anchor stays put while it is open.
   */
  sizingLabels?: string[];
  /**
   * The clear button's name. Given, the trigger holds a seat for the button
   * and draws it there while `hasValue` is true. The button shows no tooltip:
   * a × in a field is one of the conventions `IconButton` leaves unlabeled.
   */
  clearLabel?: string;
  hasValue?: boolean;
  /**
   * The list has closed and the focus is on its way back, which Reka returns
   * when the list's exit ends: `returning` from `useOutsideClickFocus`. A popper
   * trigger holds its ring meanwhile, so the ring runs unbroken from the list's
   * opening to the focus's return. The root carries `.select-trigger--returning`
   * for the field's name to hold on too.
   */
  focusReturning?: boolean;
}>();

const emit = defineEmits<{ clear: [] }>();

defineSlots<{
  /** The value, or the placeholder. */
  default?: () => unknown;
  /**
   * An icon before the value, the pickers' calendar and clock, drawn at 18px in
   * `ink-4` in a well the trigger's height. The well assumes the trigger's own
   * start padding: a `px-*` in `triggerClass` moves the value off the column.
   */
  leading?: () => unknown;
  /** Replaces the house caret. Keep it 18px wide, or the clear button drifts off its seat. */
  caret?: () => unknown;
}>();

const aligned = computed(() => position === "aligned");
const ghosts = computed(() => [...new Set(sizingLabels)]);
const radius = computed(() => controlRadius(rounded));

/**
 * One step under the trigger, as `InputGroup` sizes the button in a field:
 * the button, which sizes its own glyph, and the box the trigger holds for it.
 */
const CLEAR: Record<Size, { button: "xs" | "sm" | "md"; seat: string }> = {
  sm: { button: "xs", seat: "size-6" },
  md: { button: "sm", seat: "size-8" },
  lg: { button: "md", seat: "size-10" },
};

/**
 * The leading well: as wide as the trigger is tall, pulled back over the start
 * padding (`px-3`, `px-3.5`, `px-4`) and the `gap-2` after it, so the value
 * starts where `Input`'s text does past its own well (`pl-8`, `pl-10`, `pl-12`).
 */
const LEADING: Record<Size, string> = {
  sm: "w-8 -ml-3 -mr-2",
  md: "w-10 -ml-3.5 -mr-2",
  lg: "w-12 -ml-4 -mr-2",
};

const root = useTemplateRef<HTMLElement>("root");

/**
 * Clearing from the button removes the button, so a keyboard user's focus
 * would fall to the document; it goes to the trigger instead, which is what
 * the cleared control now is. A pointer click leaves focus where the browser
 * put it — Safari never focuses a clicked button, and this should not.
 */
const clearFromButton = (event: MouseEvent) => {
  const heldFocus = event.currentTarget === document.activeElement;
  emit("clear");
  if (!heldFocus) return;
  root.value?.querySelector<HTMLElement>(".select-trigger-button")?.focus();
};
</script>

<style scoped lang="postcss">
/*
 * Keyed to the button, not the wrapper: the clear button beside it takes focus
 * too, and should not light the trigger's ring. The ring stays while the list
 * is open, since the list takes the focus with it, and through the list's exit
 * while the focus is coming back.
 */
.select-trigger:has(> .select-trigger-button:focus) > .select-trigger-ring,
.select-trigger:has(> .select-trigger-button[data-state="open"]) > .select-trigger-ring,
.select-trigger--returning > .select-trigger-ring {
  opacity: 1;
}
/*
 * Except under an aligned list, which lies on the trigger and would leave the
 * ring's corners showing past its own, open or leaving. Keyed to the state
 * rather than the focus, so a list opened from the keyboard, while the trigger
 * still holds the focus, takes the ring away as it arrives; the focus's return
 * brings it back once the list has gone. Declared after the rule above, which
 * it matches in specificity.
 */
.select-trigger--aligned:has(> .select-trigger-button[data-state="open"]) > .select-trigger-ring,
.select-trigger--aligned.select-trigger--returning > .select-trigger-ring {
  opacity: 0;
}
.select-trigger-button[data-state="open"] .select-trigger-chevron {
  transform: rotate(180deg);
}
</style>
