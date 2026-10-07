<template>
  <div>
    <Pill
      :border-width="1"
      :border-color="CONTROL_BORDER_COLOR"
      :focus-ring="true"
      surface-class="bg-surface"
      :class="cn('group isolate flex items-stretch', disabled && 'opacity-50')">
      <!-- The name is inside the pill, so it is body text rather than
           `UI/FieldLabel.vue`'s stacked 12px name — and an "Optional" marker
           would crowd the value it sits against. This field takes the rest of
           the contract: the chin, and the same ARIA wiring. -->
      <label
        v-if="label"
        :for="inputId"
        class="relative inline-flex shrink-0 items-center pl-4 pr-2 text-ink-3 group-focus-within:text-ink">
        {{ label }}
      </label>
      <input
        :id="inputId"
        :type="type"
        :value="model"
        :placeholder="placeholder"
        :disabled="disabled"
        @input="model = ($event.target as HTMLInputElement).value"
        v-bind="$attrs"
        :aria-required="field.ariaRequired.value"
        :aria-invalid="field.invalid.value"
        :aria-describedby="field.describedBy.value"
        class="grow bg-transparent py-2 pr-4 text-right text-ink outline-none placeholder:text-ink-4 placeholder:normal-case disabled:cursor-not-allowed" />
    </Pill>
    <FieldChin
      :description="description"
      :error="error"
      :description-id="field.descriptionId"
      :error-id="field.errorId"
      class="px-4" />
  </div>
</template>

<script setup lang="ts">
import { CONTROL_BORDER_COLOR } from "../../utils/controlSquircle";
import Pill from "./Pill.vue";
import { cn } from "../../utils/cn";
import FieldChin from "./FieldChin.vue";
import { useField } from "../../utils/field";

/**
 * A label-inside pill field — "Price ₱ [ 12.00 ]" — for compact settings rows.
 *
 * It is a squircle pill with the same keyline, `surface` fill and focus stroke
 * as `UI/Input.vue`; before 2026-09-05 it had none of the three, and no visible
 * focus indicator at all.
 */
interface Props {
  label?: string;
  type?: string;
  placeholder?: string;
  /**
   * `aria-required` — no longer the native attribute. That one fires the
   * browser's own validation bubble, drawn in the browser's chrome rather than
   * this system's and at a moment the app does not choose. See `utils/field.ts`.
   */
  required?: boolean;
  disabled?: boolean;
  id?: string;
  /** Standing help under the pill — see `UI/FieldChin.vue`. */
  description?: string;
  /** Why the current value was refused. */
  error?: string;
}

const {
  label,
  type = "text",
  placeholder,
  required,
  disabled,
  id,
  description,
  error,
} = defineProps<Props>();

const model = defineModel<string>({ default: "" });

const field = useField(() => ({ description, error, required }));

defineOptions({
  inheritAttrs: false,
});

const fallbackId = useId();
const inputId = computed(() => id || fallbackId);
</script>

<style scoped lang="postcss">
/* The label fades into the value so a long value slides under it rather than
   colliding — a gradient on a pseudo-element, not a transition. */
label::before {
  content: "";
  @apply pointer-events-none absolute -right-4 top-0 h-full w-4;
  background: linear-gradient(to right, theme("colors.surface.DEFAULT"), transparent);
}
</style>
