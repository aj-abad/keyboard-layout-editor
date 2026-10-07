<template>
  <svg
    :width="WIDTH"
    :height="HEIGHT"
    :viewBox="`0 0 ${WIDTH} ${HEIGHT}`"
    class="shrink-0 text-surface-inverse/80"
    aria-hidden="true"
    focusable="false">
    <path :d="PILL_PATH" fill="currentColor" />
    <text
      class="font-mono"
      :x="WIDTH / 2"
      :y="baseline"
      :font-size="fontSize"
      font-weight="500"
      text-anchor="middle"
      :fill="surface.DEFAULT">
      {{ label }}
    </text>
  </svg>
</template>

<script setup lang="ts">
import { surface } from "../../../tailwind.config";
import { RADIUS_TOKENS, squirclePath } from "../../utils/squircle";

/**
 * Unread-count pill for the inbox row — see `Sidebar/index.vue`.
 *
 * Purely decorative: the count is announced by the control that owns it (the
 * sidebar folds it into the button's `aria-label`), so this is `aria-hidden`
 * and would otherwise read the number out twice. Visibility is the caller's
 * too — the sidebar's `v-if` is what drives its enter/exit animation — so a
 * count of 0 renders a "0" rather than nothing.
 */
const { count } = defineProps<{ count: number }>();

/** The design draws one 24×16 pill, the same box whatever the count. */
const WIDTH = 24;
const HEIGHT = 16;
const PILL_PATH = squirclePath({ width: WIDTH, height: HEIGHT, radius: RADIUS_TOKENS.full });

/** Anything past this reads "99+", the widest label the pill has to hold. */
const MAX_COUNT = 99;

/**
 * The box is fixed, so the type shrinks to make room instead: every extra
 * character is 1/1.2 the size of the one before, with one- and two-character
 * labels sharing the two-character size.
 */
const BASE_FONT_SIZE = 14;
const FONT_SIZE_STEP = 1.2;

const BASELINE_OFFSET_EM = 0.325;

const label = computed(() => (count > MAX_COUNT ? `${MAX_COUNT}+` : String(count)));

const fontSize = computed(
  () => BASE_FONT_SIZE / FONT_SIZE_STEP ** (Math.max(label.value.length, 2) - 1),
);

const baseline = computed(() => HEIGHT / 2 + fontSize.value * BASELINE_OFFSET_EM);
</script>
