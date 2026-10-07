<template>
  <DialogRoot :open="isOpen" @update:open="handleOpenChange">
    <DialogPortal>
      <DialogContent
        :aria-describedby="undefined"
        tabindex="-1"
        :style="{ zIndex: dialogZIndex }"
        :class="[
          'side-panel-content fixed inset-x-4 ml-auto top-4 bottom-4 outline-none',
          sizeClasses[size],
        ]"
        @interact-outside.prevent
        @open-auto-focus="handleOpenAutoFocus"
        @close-auto-focus="emit('closeAutoFocus', $event)"
        @escape-key-down="handleEscapeKeyDown"
        @pointer-down-outside="handlePointerDownOutside">
        <Squircle
          class="size-full"
          content-class="flex flex-col"
          surface-class="bg-surface"
          shadow="xl"
          :radius="RADIUS.sheet"
          clip-content>
          <header
            v-if="showHeader && ($slots.header || title || showClose)"
            class="flex items-center gap-2 py-2 pl-6 pr-2 shrink-0">
            <DialogTitle
              v-if="hasVisibleTitle"
              as="h2"
              :class="cn('type-subheading min-w-0 break-words', titleClass)">
              <slot name="header">
                {{ title }}
              </slot>
            </DialogTitle>
            <IconButton
              size="md"
              variant="ghost"
              v-if="showClose"
              type="button"
              aria-label="Close panel"
              disable-tooltip
              class="ml-auto shrink-0"
              @click="requestClose">
              <IconNucleoXmark />
            </IconButton>
          </header>
          <IconButton
            v-if="!showHeader && showClose"
            type="button"
            size="md"
            variant="ghost"
            aria-label="Close panel"
            disable-tooltip
            class="absolute top-2 right-2 z-10"
            @click="requestClose">
            <IconNucleoXmark />
          </IconButton>
          <!-- Reka points `aria-labelledby` at a `DialogTitle` whether or not one
               renders, so a panel with no visible title needs this or it opens
               with no accessible name at all. -->
          <DialogTitle v-if="!hasVisibleTitle" as="h2" class="sr-only">
            {{ title || "Side panel" }}
          </DialogTitle>
          <ScrollArea
            v-if="bodyLayout === 'scroll'"
            root-class="h-auto flex-1"
            :scrollbar-class="
              cn(
                !(showHeader && ($slots.header || title || showClose)) && 'pt-6',
                !$slots.footer && 'pb-6',
              )
            "
            :viewport-attrs="{ 'data-sheet-body': '' }"
            :focus-radius="RADIUS.sheet"
            :label="title ? `${title} content` : 'Panel content'">
            <div :class="cn(contentClass, !showHeader && showClose && 'pt-14')"><slot /></div>
          </ScrollArea>
          <div
            v-else
            data-sheet-body
            role="region"
            :aria-label="title ? `${title} content` : 'Panel content'"
            tabindex="0"
            :class="cn('focus-ring-inset min-h-0 flex-1', contentClass)">
            <slot />
          </div>
          <div
            v-if="$slots.footer"
            class="flex flex-wrap items-center justify-end gap-2 border-t p-4 shrink-0">
            <slot name="footer" />
          </div>
        </Squircle>
      </DialogContent>
    </DialogPortal>
  </DialogRoot>
</template>

<script setup lang="ts">
import IconNucleoXmark from "../Icon/Nucleo/Xmark.vue";
import { DialogContent, DialogPortal, DialogRoot, DialogTitle } from "reka-ui";
import type { PointerDownOutsideEvent } from "reka-ui";

import { Squircle } from "../../utils/squircle";
import { RADIUS } from "../../utils/controlSquircle";
import type { SheetFocusTarget } from "../../composables/useSheetFocus";
import { cn } from "../../utils/cn";
import IconButton from "./IconButton.vue";
import ScrollArea from "./ScrollArea.vue";
import { isBackdropInteraction, useDialogBackdrop } from "../../composables/useDialogBackdrop";
import { useSheetFocus } from "../../composables/useSheetFocus";

interface SidePanelProps {
  title?: string;
  titleClass?: string;
  size?: "sm" | "md" | "lg" | "xl" | "2xl" | "full";
  showHeader?: boolean;
  showClose?: boolean;
  persistent?: boolean;
  initialFocus?: SheetFocusTarget;
  /** Fill is for a fixed toolbar and independently scrolling child views. */
  bodyLayout?: "scroll" | "fill";
  contentClass?: string;
}

const {
  title = "",
  titleClass = "",
  size = "md",
  showHeader = true,
  showClose = true,
  persistent = false,
  initialFocus,
  bodyLayout = "scroll",
  contentClass = "px-6 py-4",
} = defineProps<SidePanelProps>();

const isOpen = defineModel<boolean>("isOpen", { required: true });

const emit = defineEmits<{
  close: [];
  dismiss: [];
  openAutoFocus: [event: Event];
  closeAutoFocus: [event: Event];
}>();

const slots = defineSlots<{
  default?: () => unknown;
  header?: () => unknown;
  footer?: () => unknown;
}>();

const hasVisibleTitle = computed(() => showHeader && Boolean(slots.header || title));

const sizeClasses = {
  sm: "max-w-sm",
  md: "max-w-md",
  lg: "max-w-lg",
  xl: "max-w-xl",
  "2xl": "max-w-2xl",
  full: "max-w-3xl",
};

const handleOpenChange = (value: boolean) => {
  isOpen.value = value;
  if (!value) emit("close");
};

const requestClose = () => {
  if (persistent) emit("dismiss");
  else handleOpenChange(false);
};

const handleEscapeKeyDown = (event: Event) => {
  if (!persistent) return;
  event.preventDefault();
  emit("dismiss");
};

// See `UI/Dialog.vue`: only a pointerdown on the backdrop dismisses, so a select
// or menu portalled out of the panel doesn't take the panel with it.
const handlePointerDownOutside = (event: PointerDownOutsideEvent) => {
  if (isBackdropInteraction(event)) requestClose();
};

const { dialogZIndex } = useDialogBackdrop(() => isOpen.value);
const { handleOpenAutoFocus } = useSheetFocus(
  () => initialFocus,
  (event) => emit("openAutoFocus", event),
);
</script>

<style lang="postcss">
.side-panel-content[data-state="open"] {
  animation: sidePanelSlideIn theme("transitionDuration.slow")
    theme("transitionTimingFunction.standard");
}
.side-panel-content[data-state="closed"] {
  animation: sidePanelSlideOut theme("transitionDuration.slow")
    theme("transitionTimingFunction.exit") forwards;
}

@media (prefers-reduced-motion: reduce) {
  .side-panel-content[data-state] {
    animation: none;
  }
}

@keyframes sidePanelSlideIn {
  from {
    transform: translateX(calc(100% + theme("spacing.4")));
  }
}
@keyframes sidePanelSlideOut {
  to {
    transform: translateX(calc(100% + theme("spacing.4")));
  }
}
</style>
