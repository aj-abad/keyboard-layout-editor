<script setup lang="ts">
import { computed, useTemplateRef } from "vue";
import { SYSTEM_FONT } from "../utils/svg";

/**
 * A legend typed where it is drawn, as Sine's `HeadlineInput` types a title:
 * in the legend's own type and color, with no shell, and one hairline under
 * it in the focus color while it is open. The hairline sits on a white one,
 * so it reads on a cap of any color. The caller puts this at the legend's
 * anchor, on its baseline; the field grows from there as the text does,
 * rightward, both ways or leftward with the legend's alignment.
 */
const {
  size,
  color,
  anchor,
  minWidth = 0,
} = defineProps<{
  /** The legend's size on screen, in pixels. */
  size: number;
  color: string;
  anchor: "start" | "middle" | "end";
  /** The slot's width on screen, so a blank legend still has room to show. */
  minWidth?: number;
}>();
const emit = defineEmits<{
  /** Enter: keep the text and close. */
  done: [];
  /** Escape: drop the text and close. */
  cancel: [];
  /** Tab and Shift-Tab: keep the text and go to the next or previous slot. */
  step: [direction: 1 | -1];
  /** Focus left for somewhere else: keep the text and close. */
  leave: [];
}>();
const text = defineModel<string>({ required: true });
defineOptions({ inheritAttrs: false });

const input = useTemplateRef<HTMLInputElement>("input");
const LINE_HEIGHT = 1.25;
const padding = computed(() => Math.round(size * 0.15));

let measure: CanvasRenderingContext2D | null = null;
/** How far the first baseline sits below the field's top, from the font's own metrics. */
const baseline = computed(() => {
  measure ??= document.createElement("canvas").getContext("2d");
  const line = size * LINE_HEIGHT;
  if (!measure) return line * 0.8;
  measure.font = `${size}px ${SYSTEM_FONT}`;
  const { fontBoundingBoxAscent: ascent, fontBoundingBoxDescent: descent } = measure.measureText("Hg");
  return (line - ascent - descent) / 2 + ascent;
});

const shift = computed(() =>
  anchor === "start"
    ? `${-padding.value}px`
    : anchor === "middle"
      ? "-50%"
      : `calc(-100% + ${padding.value}px)`,
);
const ALIGN = { start: "text-left", middle: "text-center", end: "text-right" } as const;

function onKeydown(event: KeyboardEvent) {
  // A key that finishes an IME composition is the composition's.
  if (event.isComposing) return;
  if (event.key === "Enter") emit("done");
  else if (event.key === "Escape") emit("cancel");
  else if (event.key === "Tab") emit("step", event.shiftKey ? -1 : 1);
  else return;
  event.preventDefault();
  event.stopPropagation();
}

// Focus going to another window, to copy a symbol from a character map, say,
// leaves the field open: the caret comes back to it with the window.
function onBlur() {
  if (document.hasFocus()) emit("leave");
}

/** Take the caret with the whole legend selected, so typing replaces it. */
function focus() {
  input.value?.focus();
  input.value?.select();
}
defineExpose({ focus });
</script>

<template>
  <span
    class="absolute left-0 top-0 inline-grid"
    :style="{
      minWidth: `${minWidth}px`,
      color,
      font: `${size}px/${LINE_HEIGHT} ${SYSTEM_FONT}`,
      transform: `translate(${shift}, ${-baseline}px)`,
    }">
    <!-- The text again, unseen: the field is as wide as what it holds. -->
    <span
      class="invisible col-start-1 row-start-1 whitespace-pre"
      :class="ALIGN[anchor]"
      :style="{ paddingInline: `${padding}px` }"
      aria-hidden="true"
      >{{ text || " " }}</span
    >
    <input
      ref="input"
      v-model="text"
      v-bind="$attrs"
      type="text"
      size="1"
      autocomplete="off"
      autocapitalize="off"
      spellcheck="false"
      enterkeyhint="done"
      class="col-start-1 row-start-1 w-full min-w-0 appearance-none border-0 bg-transparent p-0 outline-none"
      :class="ALIGN[anchor]"
      :style="{ font: 'inherit', color: 'inherit', paddingInline: `${padding}px` }"
      @keydown="onKeydown"
      @blur="onBlur" />
    <span class="pointer-events-none absolute inset-x-0 bottom-0 h-px bg-surface-inverse" aria-hidden="true" />
    <span class="pointer-events-none absolute inset-x-0 -bottom-px h-px bg-surface" aria-hidden="true" />
  </span>
</template>
