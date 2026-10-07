<template>
  <div class="relative group" :class="containerClass" data-input>
    <FieldLabel
      v-if="label"
      :label="label"
      :for="(attrs.id as string) || internalId"
      :optional="optional"
      :class="textPaddingClass" />
    <div class="relative">
      <!-- `flex` rather than the default block: an `<input>` is inline-level,
           so a block parent would give it a line box and pad the squircle by
           the font's descender — the shell would measure a few px taller than
           the control it is drawn around. -->
      <Squircle
        :class="cn('group/shell flex', disabled && 'opacity-50')"
        :radius="resolvedRadius"
        :surface-class="cn(surfaceClass, AUTOFILL_SURFACE, disabled && 'bg-surface-sunken')"
        :border-width="bordered ? 1 : 0"
        :border-color="CONTROL_BORDER_COLOR">
        <div class="relative flex min-w-0 flex-1">
          <div
            v-if="slots['icon-prepend']"
            class="absolute h-full aspect-square left-0 top-0 flex items-center justify-center pointer-events-none"
            data-icon-prepend>
            <slot name="icon-prepend" />
          </div>
          <input
            ref="inputRef"
            :id="internalId"
            v-bind="$attrs"
            :type="type"
            :placeholder="placeholder"
            :value="model"
            :class="inputClass"
            :disabled="disabled"
            :readonly="readOnly"
            :min="min"
            :max="max"
            :step="step"
            @input="model = ($event.target as HTMLInputElement).value"
            @beforeinput="preventDisallowedBeforeInput"
            @paste="preventDisallowedPaste"
            @keydown="handleKeydown"
            :aria-invalid="
              field.invalid.value ?? (attrs['aria-invalid'] as AriaAttributes['aria-invalid'])
            "
            :aria-required="field.ariaRequired.value"
            :aria-describedby="field.describedBy.value" />
          <!-- The spinner: the browser's own shape, up over down in a narrow
               column between the digits and the unit well, so the unit keeps
               the edge. It is there only while the field is hovered or holds
               focus, and its space is always reserved (in the input's trailing
               padding, with the well's), so the reveal moves nothing. The
               states are ink alone — a fill on a half-height button against
               the edge would paint a rectangle into the smoothed corner.
               Stepping starts on pointerdown, and a hold keeps stepping; the
               release is read off `window` inside the composable. -->
          <div
            v-if="showSpinButtons"
            :class="
              cn(
                'absolute top-0 flex h-full flex-col opacity-0 group-hover/shell:opacity-100 group-focus-within/shell:opacity-100',
                SPIN_SIZE[size || 'md'].column,
                slots['icon-append'] ? WELL_WIDTH[size || 'md'].offset : 'right-0',
              )
            "
            data-spin-buttons>
            <button
              v-for="direction in [1, -1] as const"
              :key="direction"
              type="button"
              :class="
                cn(
                  'flex min-h-0 flex-1 select-none items-center justify-center text-ink-4 outline-none touch-none enabled:hover:text-ink enabled:active:text-ink disabled:cursor-not-allowed disabled:text-ink-5',
                  SPIN_SIZE[size || 'md'].glyph,
                )
              "
              :aria-label="`${direction === 1 ? 'Increase' : 'Decrease'} ${spinLabel}`"
              :aria-controls="(attrs.id as string) || internalId"
              :disabled="spinValues[direction] === null"
              :tabindex="-1"
              @pointerdown.prevent="startHold(direction)">
              <component :is="direction === 1 ? IconNucleoChevronUp12 : IconNucleoChevronDown12" />
            </button>
          </div>
          <div
            v-if="slots['icon-append']"
            class="absolute h-full aspect-square right-0 top-0 flex items-center justify-center"
            data-icon-append>
            <slot name="icon-append" />
          </div>
        </div>
      </Squircle>
      <!-- Focus ring: a second squircle rather than a thicker stroke on the
           first, because `borderWidth` is geometry — swapping 1 for 2 would
           redraw the path. It lands on the next frame (decision 11: no fade on
           a focus stroke). Stacked, not nested, so its own opacity never sits
           above the shell's surface layer. -->
      <Squircle
        class="pointer-events-none absolute inset-0"
        data-focus-border
        aria-hidden="true"
        :radius="resolvedRadius"
        :border-width="2"
        :border-color="CONTROL_FOCUS_COLOR" />
    </div>
    <FieldChin
      :description="description"
      :error="error"
      :description-id="field.descriptionId"
      :error-id="field.errorId"
      :class="textPaddingClass">
      <template v-if="$slots.chin" #default><slot name="chin" /></template>
    </FieldChin>
  </div>
</template>

<script setup lang="ts">
import { cva, type VariantProps } from "class-variance-authority";
import IconNucleoChevronDown12 from "../Icon/Nucleo/ChevronDown12.vue";
import IconNucleoChevronUp12 from "../Icon/Nucleo/ChevronUp12.vue";
import { useNumberInput } from "../../composables/useNumberInput";
import { Squircle } from "../../utils/squircle";
import type { AriaAttributes } from "vue";
import {
  CONTROL_BORDER_COLOR,
  CONTROL_FOCUS_COLOR,
  controlRadius,
} from "../../utils/controlSquircle";
import type { RadiusToken } from "../../utils/squircle";
import FieldLabel from "./FieldLabel.vue";
import { cn } from "../../utils/cn";
import FieldChin from "./FieldChin.vue";
import { useField } from "../../utils/field";

/**
 * The shape comes from the local `UI/Squircle`, which is why the `<input>` itself
 * is transparent and borderless: both the fill and the 1px keyline are drawn by
 * the shell around it, the only place they can follow the smoothed corner.
 *
 * The consequence for callers is that a `bg-*` in `class` lands on the input —
 * a plain rectangle whose corners poke out past the shell. Pass `surfaceClass`
 * instead; `class` is still the right place for anything about the *text*
 * (`font-mono`, `uppercase`, `placeholder:…`).
 *
 * Autofill is the browser making that same mistake, and `surfaceClass` is no
 * escape from it because the declaration is the UA's. It is undone globally in
 * `sine.css` and re-drawn below.
 */
const inputVariants = cva(
  // `text-ink` is stated, not inherited: preflight gives an `<input>`
  // `color: inherit`, so a field under a muted wrapper (`type-caption`, a
  // `text-ink-3` row) drew its value in the wrapper's ink and lost the step
  // between value and placeholder. Same rule as `selectTriggerVariants`.
  "min-w-0 w-full bg-transparent text-ink outline-none disabled:cursor-not-allowed placeholder:text-ink-4",
  {
    variants: {
      size: {
        sm: "text-sm h-8 px-3",
        md: "text-base h-10 px-3.5",
        lg: "text-lg h-12 px-4",
      },
    },
    defaultVariants: {
      size: "md",
    },
  },
);

const textPaddingVariants = cva("", {
  variants: {
    size: {
      sm: "px-3",
      md: "px-3.5",
      lg: "px-4",
    },
  },
  defaultVariants: {
    size: "md",
  },
});

type InputVariants = VariantProps<typeof inputVariants>;

/**
 * The autofill tint, re-drawn on the clipped layer so it follows the smoothed
 * corner — `sine.css` takes Chrome's own paint off the `<input>`, where it
 * could only ever be a rectangle, and that comment carries the why.
 *
 * The hex is Chrome's own light-scheme `rgb(232 240 254)`, kept rather than
 * restyled to the palette: the point of the tint is that a filled field is
 * recognisably *autofilled*, and it is the blue that says so. It normalises
 * Firefox's yellow to the same thing, which is a fair trade for one tint.
 *
 * `group-has-` rather than `has-`: the input is the surface layer's sibling,
 * not its child, so the condition has to be read from the wrapper that contains
 * both — the `group` on the root. Chrome drops `:autofill` as soon as the field
 * is edited, so the tint clears on its own.
 */
const AUTOFILL_SURFACE = "group-has-[input:autofill]:bg-[#e8f0fe]";

interface Props {
  type?: string;
  /**
   * Characters accepted while editing a text-backed numeric field. Native
   * number inputs always reject letters (including exponent notation); use
   * this for fields such as clock parts and decimal currency strings.
   * Complete-value validation still belongs to the caller.
   */
  inputFilter?: "digits" | "decimal";
  placeholder?: string;
  error?: string;
  disabled?: boolean;
  readonly?: boolean;
  min?: number | string;
  max?: number | string;
  /** Native increment and validation step; omitted means 1 for number inputs. */
  step?: number | string;
  /**
   * Opt-in minus/plus controls, on a `type="number"` field or a text-backed
   * one carrying `inputFilter` — a money field keeps its editing string and
   * still steps. `step="any"` leaves both controls disabled.
   */
  spinButtons?: boolean;
  size?: InputVariants["size"];
  /** Use the shared 0.7-smoothed squircle pill instead of the control radius. */
  rounded?: boolean;
  /**
   * Corner radius override — px, or a `rounded-*` token — for a field whose
   * shape belongs to something else: one flush inside a shaped toolbar, or a
   * segment of a joined group. `0` / `"none"` squares the corners, and a square
   * corner has nothing to smooth, so the squircle geometry drops out with it.
   *
   * Wins over `rounded`; leave both off for the house `rounded-lg`.
   */
  radius?: number | RadiusToken;
  /**
   * The resting 1px keyline. `false` drops it — for a field drawn inside a
   * container that already has an edge, where the two would read as a double
   * border. The focus ring is deliberately *not* covered by this: the `<input>`
   * is `outline-none`, so that ring is the field's only focus indicator.
   */
  bordered?: boolean;
  containerClass?: string;
  /** Fill for the squircle shell — `bg-*` belongs here, not in `class`. */
  surfaceClass?: string;
  label?: string;
  /**
   * Standing help under the field — what to put in. The `chin` slot is the same
   * line when the help needs markup; both are read as the field's description.
   */
  description?: string;
  /** Draw the "Optional" marker beside the label — see `UI/FieldLabel.vue`. */
  optional?: boolean;
  /** `aria-required`, without the browser's own validation bubble. */
  required?: boolean;
}

const {
  type,
  inputFilter,
  placeholder,
  error,
  disabled,
  readonly: readOnly = false,
  min,
  max,
  step,
  spinButtons = false,
  size = "md",
  rounded = false,
  radius,
  bordered = true,
  containerClass,
  surfaceClass,
  label,
  description,
  optional = false,
  required = false,
} = defineProps<Props>();

const model = defineModel<string | number>();

const attrs = useAttrs();
const slots = defineSlots<{
  "icon-prepend"?: () => unknown;
  "icon-append"?: () => unknown;
  chin?: () => unknown;
}>();
const field = useField(() => ({ description, error, chin: Boolean(slots.chin), required }));
const internalId = field.id;

const inputRef = useTemplateRef<HTMLInputElement>("inputRef");

// A text-backed numeric field steps too: the composable probes a detached
// number input, so the real input's type never enters into it. A field that
// cannot be edited draws no spinner at all, as the browser's own does.
const showSpinButtons = computed(
  () => spinButtons && !disabled && !readOnly && (type === "number" || inputFilter !== undefined),
);
const spinLabel = computed(() => label || (attrs["aria-label"] as string) || "value");
const {
  nextValues: spinValues,
  startHold,
  onKeydown: onSpinKeydown,
} = useNumberInput(inputRef, () => ({
  enabled: showSpinButtons.value,
  disabled: !!disabled,
  readonly: readOnly,
  value: model.value,
  min,
  max,
  step,
}));

/**
 * `type="number"` still accepts `e`/`E` because the HTML number grammar
 * includes scientific notation. The portal never stores exponent notation,
 * while the time and money fields are text inputs so they can preserve their
 * editing strings. Prevent invalid insertions before the browser paints them;
 * keydown covers hardware keyboards and paste covers browsers whose
 * `beforeinput` event does not expose transferred text.
 */
const allowsInsertedText = (text: string): boolean => {
  if (inputFilter === "digits") return /^[0-9]*$/.test(text);
  if (inputFilter === "decimal") return /^[0-9.]*$/.test(text);
  if (type === "number") return !/[A-Za-z]/.test(text);
  return true;
};

const preventDisallowedBeforeInput = (event: InputEvent) => {
  const text = event.data ?? event.dataTransfer?.getData("text/plain");
  if (text && !allowsInsertedText(text)) event.preventDefault();
};

const preventDisallowedPaste = (event: ClipboardEvent) => {
  const text = event.clipboardData?.getData("text/plain");
  if (text && !allowsInsertedText(text)) event.preventDefault();
};

const handleKeydown = (event: KeyboardEvent) => {
  const modified = event.altKey || event.ctrlKey || event.metaKey;
  // Autofill and password-manager integrations can dispatch a keydown-shaped
  // event without KeyboardEvent.key. Types cannot describe that browser edge,
  // so narrow the runtime value before applying the character filter.
  const key = (event as Partial<KeyboardEvent>).key;
  if (!modified && !event.isComposing && key?.length === 1 && !allowsInsertedText(key)) {
    event.preventDefault();
  }
  if (!event.defaultPrevented) onSpinKeydown(event);
};

// The spinner column's width and its carets' size per field height. Each
// caret sits in a box half the field tall — 16px in the `sm` field — and a
// 12px caret's visible ink is about 8×4, so it keeps its clearance there.
const SPIN_SIZE = {
  sm: { column: "w-6", glyph: "[&_svg]:size-3" },
  md: { column: "w-6", glyph: "[&_svg]:size-3" },
  lg: { column: "w-8", glyph: "[&_svg]:size-3.5" },
} as const;

// An icon well is a square the field's height. The text pads past what sits
// at its edge: the leading well; and, trailing, the well, the spinner column
// (`SPIN_SIZE`) or the two together — the column stands off the edge by the
// well's width when both are there, so the unit keeps the edge.
const WELL_WIDTH = {
  sm: { start: "pl-8", end: "pr-8", offset: "right-8", spin: "pr-6", both: "pr-14" },
  md: { start: "pl-10", end: "pr-10", offset: "right-10", spin: "pr-6", both: "pr-16" },
  lg: { start: "pl-12", end: "pr-12", offset: "right-12", spin: "pr-8", both: "pr-20" },
} as const;

const focus = () => inputRef.value?.focus();
const blur = () => inputRef.value?.blur();
const clear = () => {
  if (inputRef.value) {
    inputRef.value.value = "";
    model.value = "";
  }
};

defineExpose({ inputRef, focus, blur, clear });

const resolvedRadius = computed(() => radius ?? controlRadius(rounded));
const textPaddingClass = computed(() => textPaddingVariants({ size }));

const trailingPadding = computed(() => {
  const well = WELL_WIDTH[size || "md"];
  const append = Boolean(slots["icon-append"]);
  if (showSpinButtons.value) return append ? well.both : well.spin;
  return append ? well.end : "";
});

const inputClass = computed(() => {
  return cn(
    inputVariants({ size }),
    slots["icon-prepend"] ? WELL_WIDTH[size || "md"].start : "",
    trailingPadding.value,
    attrs.class as string,
  );
});

// Disable attribute inheritance on root element
defineOptions({
  inheritAttrs: false,
});
</script>

<style lang="postcss" scoped>
input[type="number"] {
  appearance: textfield;
  -moz-appearance: textfield;

  &::-webkit-inner-spin-button,
  &::-webkit-outer-spin-button {
    -webkit-appearance: none;
    margin: 0;
  }
}

[data-input] {
  [data-focus-border] {
    opacity: 0;
  }

  &:focus-within {
    [data-focus-border] {
      opacity: 1;
    }
  }
}
</style>
