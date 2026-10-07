<template>
  <Dialog
    :is-open="state.isOpen"
    :title="state.title"
    size="sm"
    initial-focus="[data-cancel]"
    @update:is-open="(open: boolean) => !open && decline()">
    <p class="text-sm text-ink-3">{{ state.message }}</p>

    <template #footer>
      <!-- Two actions share the sheet's edge as cells. An alternative makes
           three, drawn as the padded group in the order `UI/Dialog`'s
           MoreActions story sets: the dismissal as a ghost, the confirm in
           its own weight, and the alternative last as the primary — it is
           the way out that keeps everything, so it takes the default place. -->
      <Button
        data-cancel
        :variant="state.alternativeLabel ? 'ghost' : 'secondary'"
        @click="decline">
        {{ state.cancelLabel }}
      </Button>
      <Button
        :variant="
          state.destructive ? 'destructive' : state.alternativeLabel ? 'secondary' : 'primary'
        "
        @click="accept">
        {{ state.confirmLabel }}
      </Button>
      <Button v-if="state.alternativeLabel" @click="chooseAlternative">
        {{ state.alternativeLabel }}
      </Button>
    </template>
  </Dialog>
</template>

<script setup lang="ts">
import Dialog from "../UI/Dialog.vue";
import Button from "../UI/Button.vue";
import { useConfirm } from "../../composables/useConfirm";
// The single host for `useConfirm()`. Mounted once in `app.vue` so it sits
// above every page and layout — including the teleported bulk action bar that
// triggers most of its prompts.
const { state, accept, decline, chooseAlternative } = useConfirm();
</script>
