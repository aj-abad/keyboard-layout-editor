<template>
  <!--
    Rendered whether or not it has anything in it, which is the whole reason it
    announces. A live region has to exist *before* its content changes for a
    screen reader to read that change; a region created with the error already
    inside it is, to most SR/browser pairs, just some text that appeared. This
    used to be `v-if`'d in `UI/Input.vue`, so the error it exists to announce was
    the one thing it could not announce.

    `polite`, not `assertive` — `UI/Select.vue`'s old spelling. An assertive
    region interrupts the operator mid-keystroke to read a validation message
    that `aria-describedby` will read again the moment they return to the field.
  -->
  <div :class="className" role="status" aria-live="polite" aria-atomic="true">
    <!-- The one line. The description and the error share a grid cell rather
         than swap, so the line is as tall as the taller of the two and a short
         error over a longer description pulls nothing up. Inside `.fields` it
         is held open before there is anything in it. Padding rather than a
         margin, so the 4px is part of the line. -->
    <div class="grid min-h-[var(--field-chin-line,0px)]">
      <p
        v-if="description || $slots.default"
        :id="descriptionId"
        :class="['type-caption col-start-1 row-start-1 pt-1', error && 'invisible']">
        <slot>{{ description }}</slot>
      </p>
      <p v-if="error" :id="errorId" class="type-caption col-start-1 row-start-1 pt-1 text-bad">
        {{ error }}
      </p>
    </div>
  </div>
</template>

<script setup lang="ts">
/**
 * The line under a control: what to put in, and, in its place, why what went in
 * was refused.
 *
 * **The error takes the description's place.** A chin is one line of
 * `type-caption`: the description at rest, and the error over it while the
 * value is refused. Sharing the line leaves a refusal nowhere to push anything,
 * since it lands where the description already was. It also means an error
 * says what to enter in full, "Enter a URL ending in /ocpi/versions" rather
 * than "Enter their versions URL", because the help that said so is covered
 * while it shows.
 *
 * **In a form, the line is held before there is anything in it.** The form's
 * `.fields` class sets `--field-chin-line`, so a field with no description
 * still keeps the 20px an error needs, and a refusal fills room that was
 * already there. A filter in a toolbar is outside any `.fields`, so its error,
 * if it ever has one, takes its room when it arrives, and the toolbar keeps its
 * height the rest of the time. See `.fields` in `tailwind.config.ts`.
 *
 * Ids come from `useField`, which is also what points the control's
 * `aria-describedby` at whichever of the two is showing.
 */
const {
  description,
  error,
  descriptionId,
  errorId,
  class: className,
} = defineProps<{
  description?: string;
  error?: string;
  descriptionId?: string;
  errorId?: string;
  class?: string;
}>();
</script>
