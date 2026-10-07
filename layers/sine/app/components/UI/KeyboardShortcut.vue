<template>
  <span class="inline-flex items-center gap-1">
    <template v-for="(step, stepIndex) in formattedSteps" :key="stepIndex">
      <span v-if="stepIndex > 0" class="text-micro text-current">then</span>
      <Squircle
        as="kbd"
        :radius="RADIUS.micro"
        :surface-class="cn('bg-fill-2', kbdSurfaceClass)"
        :class="
          cn(
            'font-sans h-5 min-w-5 px-1 text-current inline-flex items-center justify-center gap-1',
            kbdClass,
          )
        ">
        <template v-for="(key, keyIndex) in step" :key="keyIndex">
          <KeyboardShortcutIcon v-if="key.type === 'icon'" :icon="key.icon" />
          <span v-else class="font-medium text-micro font-sans">{{ key.value }}</span>
        </template>
      </Squircle>
    </template>
  </span>
</template>

<script setup lang="ts">
import { cn } from "../../utils/cn";
import KeyboardShortcutIcon from "./KeyboardShortcut/Icon.vue";
import { Squircle } from "../../utils/squircle";
import { RADIUS } from "../../utils/controlSquircle";
import { useMounted } from "@vueuse/core";
import { isMac } from "../../utils/platform";

interface Props {
  /** Shortcut string (e.g., "mod+k", "g d") or array of already-pressed keys (e.g., ["G", "D"]) */
  keys?: string | readonly string[];
  /** Optional class to apply to each chord or sequence-step <kbd> element. */
  kbdClass?: string;
  /** Optional surface class for each chord or sequence-step <kbd> element. */
  kbdSurfaceClass?: string;
}

const { keys, kbdClass, kbdSurfaceClass } = defineProps<Props>();

/**
 * Whether to draw the Mac's keys. Which keyboard the reader has is known only
 * in the browser, so the server's page, and the render that hydrates it, draw
 * Ctrl and Alt; a Mac's ⌘ and ⌥ take their place once the shortcut has mounted.
 */
const mounted = useMounted();
const onMac = computed(() => mounted.value && isMac);

type ShortcutKey =
  | { type: "icon"; icon: "cmd" | "shift" | "option" | "enter" | "space" }
  | { type: "text"; value: string };

/**
 * The arrow keys, by the `KeyboardEvent.key` names the registry parses. Drawn
 * as text rather than as icons because PPNeueMontreal carries these four
 * glyphs — it is the ⌘ ⇧ ⌥ ↵ Space set it lacks, which is why those are SVGs.
 */
const ARROW_KEYS: Record<string, string> = {
  arrowleft: "←",
  arrowright: "→",
  arrowup: "↑",
  arrowdown: "↓",
};

const formatStep = (step: string, mac: boolean): ShortcutKey[] =>
  step.split("+").map((part) => {
    const p = part.toLowerCase().trim();
    if (p in ARROW_KEYS) return { type: "text", value: ARROW_KEYS[p]! } as const;
    if (p === "mod" || p === "cmd" || p === "ctrl" || p === "⌘") {
      return mac
        ? ({ type: "icon", icon: "cmd" } as const)
        : ({ type: "text", value: "Ctrl" } as const);
    }
    if (p === "shift" || p === "⇧") return { type: "icon", icon: "shift" } as const;
    if (p === "alt" || p === "option" || p === "⌥") {
      return mac
        ? ({ type: "icon", icon: "option" } as const)
        : ({ type: "text", value: "Alt" } as const);
    }
    if (p === "enter") return { type: "icon", icon: "enter" } as const;
    if (p === "space") return { type: "icon", icon: "space" } as const;
    if (p === "escape" || p === "esc") return { type: "text", value: "Esc" } as const;
    // The key a Mac labels "delete" sends Backspace, so a surface that lists
    // Delete takes Backspace too, and the word is the legend on both keyboards.
    if (p === "delete" || p === "del") return { type: "text", value: "Delete" } as const;
    return { type: "text", value: part.toUpperCase() } as const;
  });

const formattedSteps = computed<ShortcutKey[][]>(() => {
  if (!keys) return [];

  // If keys is already an array (e.g., from SequenceIndicator), treat each as a single step
  if (typeof keys !== "string") {
    return keys.map((step) => formatStep(step, onMac.value));
  }

  return keys
    .trim()
    .split(/\s+/)
    .map((step) => formatStep(step, onMac.value));
});
</script>
