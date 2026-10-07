<template>
  <label
    :for="htmlFor"
    :id="id"
    :class="
      cn(
        'block font-medium text-xs text-ink-3 group-focus-within:text-ink',
        !htmlFor && 'cursor-default',
        className,
      )
    ">
    <!-- The space before the marker is load-bearing, not formatting. An inline
         `<span>` contributes no word boundary of its own to the accessible name,
         so without it the field is named "ConnectorOptional". `ml-1` carries the
         rest of the visible gap. -->
    {{ label }} <span v-if="optional" class="ml-1 font-normal text-ink-4">Optional</span>
  </label>
</template>

<script setup lang="ts">
import { cn } from "../../utils/cn";
/**
 * A field's name, and the one marker the system puts beside it.
 *
 * **The house marks the optional fields, not the required ones.** Nearly every
 * field in these forms is required, so an asterisk on each would be a marker
 * that says nothing 90% of the time; "Optional" appears four times and tells the
 * operator what they can skip. `useField`'s `required` still states the
 * constraint to assistive technology — it just draws nothing. Before this the
 * app had three spellings of the same idea in four call sites: `label="Name *"`,
 * `label="Connector (optional)"` and `placeholder="Optional"`.
 *
 * The marker is deliberately *not* `aria-hidden`. It sits inside the `<label>`,
 * so it joins the accessible name — "Connector, Optional" — which for a screen
 * reader user is the only place that fact appears at all.
 *
 * `group-focus-within:text-ink` brightens the name while the control has focus,
 * so it needs `group` on the field root. A control whose focus leaves the root —
 * `UI/Select.vue`, whose menu is portalled — keeps its own rule for that case.
 */
const {
  label,
  for: htmlFor,
  id,
  optional = false,
  class: className,
} = defineProps<{
  label: string;
  /**
   * The control's `id`, when it is a labelable element. Omit for a Reka trigger
   * or a group — those take their name through `aria-labelledby`, which needs
   * `id` here instead.
   */
  for?: string;
  id?: string;
  /** Draw the "Optional" marker. */
  optional?: boolean;
  class?: string;
}>();
</script>
