<script setup lang="ts">
import { computed, useId } from "vue";
import Button from "#layers/sine/app/components/UI/Button.vue";
import Pill from "#layers/sine/app/components/UI/Pill.vue";
import { statusInkClass, statusSheetClass } from "#layers/sine/app/utils/status";
import { useLayoutApp } from "../composables/useLayoutApp";

/**
 * Said only when the browser stops keeping the layout: a toned capsule in the
 * title bar with the one thing to do about it. While it keeps it, there is
 * nothing to say; the help says once that layouts save as they're edited.
 */
const app = useLayoutApp();
const problem = computed(() => app.document.storageError.value);
const reasonId = useId();
</script>

<template>
  <!-- The live region stays mounted, so a problem is read out as it appears. -->
  <div class="flex min-w-0 empty:hidden" role="status" aria-live="polite">
    <template v-if="problem">
      <p :id="reasonId" class="sr-only">{{ problem }}</p>
      <Pill
        :surface-class="statusSheetClass.bad"
        class="flex min-w-0 items-center gap-2 py-1 pl-3 pr-1"
        :class="statusInkClass.bad">
        <span class="type-caption min-w-0 truncate font-medium text-current">Not saving</span>
        <Button variant="toned" size="xs" :aria-describedby="reasonId" @click="app.exportAs('json')">
          Export JSON
        </Button>
      </Pill>
    </template>
  </div>
</template>
