<script setup lang="ts">
import { computed, useId } from "vue";
import { ink } from "#layers/sine/tailwind.config";
import Input from "#layers/sine/app/components/UI/Input.vue";

/**
 * A color as a field: the hex, typed, with its swatch in the leading well. The
 * swatch opens the platform's picker, which a transparent `type=color` laid over
 * it draws; the hex is the keyboard's way to the same value. A layout's colors
 * are its own data, so the swatch paints whatever the document says.
 */
const {
  label,
  value,
  mixed = false,
} = defineProps<{
  label: string;
  value: string;
  /** The selection holds more than one color. */
  mixed?: boolean;
}>();
const emit = defineEmits<{ change: [color: string] }>();

const id = useId();
const HEX = /^#?([\da-f]{3}|[\da-f]{6})$/i;

/** The picker takes six digits; a three-digit or named color starts it from its nearest. */
const pickerValue = computed(() => {
  const match = HEX.exec(value.trim());
  if (!match) return ink.DEFAULT;
  const digits = match[1]!;
  return `#${digits.length === 3 ? [...digits].map((digit) => digit + digit).join("") : digits}`.toLowerCase();
});

function commit(event: Event) {
  const input = event.target as HTMLInputElement;
  const text = input.value.trim();
  const match = HEX.exec(text);
  if (match) emit("change", `#${match[1]!.toLowerCase()}`);
  // A value that isn't a color reads back as the one in use.
  else input.value = mixed ? "" : value;
}
</script>

<template>
  <div class="relative">
    <Input
      :id="id"
      :label="label"
      size="sm"
      :model-value="mixed ? '' : value"
      :placeholder="mixed ? 'Mixed' : undefined"
      spellcheck="false"
      autocomplete="off"
      class="type-data"
      @change="commit">
      <template #icon-prepend>
        <span
          data-swatch
          class="size-4 rounded ring-1 ring-inset ring-line"
          :style="{ backgroundColor: mixed ? undefined : value }" />
      </template>
    </Input>
    <input
      type="color"
      tabindex="-1"
      :aria-label="`${label}, from the picker`"
      :value="pickerValue"
      class="absolute bottom-0 left-0 size-8 cursor-pointer opacity-0"
      @change="emit('change', ($event.target as HTMLInputElement).value)" />
  </div>
</template>
