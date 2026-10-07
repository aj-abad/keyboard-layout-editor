<template>
  <ClientOnly>
    <Teleport to="body">
      <div class="sr-only" role="status" aria-live="assertive" aria-atomic="true">
        {{ sequenceState.announcement }}
      </div>
      <Transition
        enter-active-class="transition-[transform,--squircle-opacity] duration-base ease-standard motion-reduce:transition-none"
        enter-from-class="[--squircle-opacity:0] translate-y-2 scale-95"
        enter-to-class="[--squircle-opacity:1] translate-y-0 scale-100"
        leave-active-class="transition-[transform,--squircle-opacity] duration-fast ease-exit motion-reduce:transition-none"
        leave-from-class="[--squircle-opacity:1] translate-y-0 scale-100"
        leave-to-class="[--squircle-opacity:0] translate-y-2 scale-95">
        <SharedSequenceIndicatorChip
          v-if="sequenceState.active"
          :keys="sequenceState.pressedKeys"
          :remaining-fraction="remainingFraction"
          class="fixed bottom-20 left-1/2 z-floating -translate-x-1/2" />
      </Transition>
    </Teleport>
    <template #fallback></template>
  </ClientOnly>
</template>

<script setup lang="ts">
import { useRafFn } from "@vueuse/core";
import { SEQUENCE_TIMEOUT_MS, sequenceState } from "../../composables/commandRegistry";
import SharedSequenceIndicatorChip from "./SequenceIndicatorChip.vue";
import { useMotionTokens } from "../../utils/motion";

const REDUCED_STEPS = 12;
const remainingFraction = ref(0);
const { reduced } = useMotionTokens();

const syncRemaining = (now: number) => {
  if (!sequenceState.active || sequenceState.expiresAt === null) {
    remainingFraction.value = 0;
    return;
  }

  const raw = Math.min(1, Math.max(0, (sequenceState.expiresAt - now) / SEQUENCE_TIMEOUT_MS));
  remainingFraction.value = reduced.value ? Math.ceil(raw * REDUCED_STEPS) / REDUCED_STEPS : raw;
};

const { pause, resume } = useRafFn(({ timestamp }) => syncRemaining(timestamp), {
  immediate: false,
});

watch(
  [() => sequenceState.active, () => sequenceState.expiresAt, reduced],
  ([active, expiresAt]) => {
    if (!active || expiresAt === null) {
      remainingFraction.value = 0;
      pause();
      return;
    }

    syncRemaining(performance.now());
    resume();
  },
  { immediate: true },
);
</script>
