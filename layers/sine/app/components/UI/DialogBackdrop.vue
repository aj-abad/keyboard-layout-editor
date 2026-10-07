<template>
  <!-- In the browser only: before the page hydrates there is no dialog for it to
       cover, since the dialogs' own portals wait for the same moment. The empty
       fallback keeps the server's markup free of a placeholder element. -->
  <ClientOnly>
    <Teleport to="body">
      <Transition name="dialog-backdrop">
        <div
          v-if="isDialogBackdropOpen"
          aria-hidden="true"
          class="dialog-backdrop pointer-events-auto fixed inset-0 z-backdrop bg-scrim backdrop-blur-sm" />
      </Transition>
    </Teleport>
    <template #fallback />
  </ClientOnly>
</template>

<script setup lang="ts">
import { useDialogBackdrop } from "../../composables/useDialogBackdrop";
// Stays hittable rather than `pointer-events-none`: it both blocks the page
// behind and is the target `isBackdropInteraction()` looks for. Dismissal is
// the dialog's own layer-aware `pointer-down-outside`, not a listener here.
const { isDialogBackdropOpen } = useDialogBackdrop();
</script>

<style lang="postcss">
.dialog-backdrop-enter-active {
  animation: dialogBackdropIn theme("transitionDuration.base")
    theme("transitionTimingFunction.standard");
}
.dialog-backdrop-leave-active {
  pointer-events: none;
  animation: dialogBackdropOut theme("transitionDuration.slow")
    theme("transitionTimingFunction.exit") forwards;
}

@media (prefers-reduced-motion: reduce) {
  .dialog-backdrop-enter-active,
  .dialog-backdrop-leave-active {
    animation: none;
  }
}

@keyframes dialogBackdropIn {
  from {
    opacity: 0;
  }
}
@keyframes dialogBackdropOut {
  to {
    opacity: 0;
  }
}
</style>
