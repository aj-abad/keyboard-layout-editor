<template>
  <DialogRoot :open="isOpen" @update:open="handleOpenChange">
    <DialogPortal>
      <DialogContent
        :aria-describedby="undefined"
        tabindex="-1"
        :style="{ zIndex: dialogZIndex }"
        :class="[
          'dialog-content fixed inset-x-4 top-1/2 -translate-y-1/2 mx-auto max-h-[calc(100dvh-theme(spacing.8))] outline-none',
          sizeClasses[size],
        ]"
        @interact-outside.prevent
        @open-auto-focus="handleOpenAutoFocus"
        @close-auto-focus="emit('closeAutoFocus', $event)"
        @pointer-down-outside="handlePointerDownOutside"
        @escape-key-down="handleEscapeKeyDown">
        <Squircle
          class="flex max-h-[inherit] min-h-0 flex-col"
          surface-class="bg-surface"
          shadow="xl"
          :radius="RADIUS.sheet">
          <header
            v-if="$slots.eyebrow || $slots.header || title || showClose"
            class="relative px-6 pt-6 shrink-0">
            <div
              :class="
                cn(
                  'min-w-0',
                  showClose && 'pr-8',
                  !$slots.header && !title && !$slots.eyebrow && 'min-h-6',
                )
              ">
              <div
                v-if="$slots.eyebrow"
                data-dialog-eyebrow
                class="type-eyebrow mb-4 flex items-center gap-2 [&_svg]:size-4 [&_svg]:shrink-0">
                <slot name="eyebrow" />
              </div>
              <DialogTitle
                v-if="$slots.header || title"
                as="h2"
                class="type-subheading min-w-0 break-words">
                <slot name="header">
                  {{ title }}
                </slot>
              </DialogTitle>
            </div>
            <IconButton
              v-if="showClose"
              type="button"
              aria-label="Close dialog"
              disable-tooltip
              size="md"
              variant="ghost"
              class="absolute top-2 right-2"
              @click="requestClose">
              <IconNucleoXmark />
            </IconButton>
          </header>
          <DialogTitle v-if="!$slots.header && !title" as="h2" class="sr-only">Dialog</DialogTitle>
          <ScrollArea
            root-class="flex h-auto flex-1 flex-col"
            viewport-class="h-auto min-h-0 flex-1"
            :scrollbar-class="
              cn(
                !($slots.eyebrow || $slots.header || title || showClose) && 'pt-6',
                !$slots.footer && 'pb-6',
              )
            "
            :viewport-attrs="{ 'data-sheet-body': '' }"
            :label="title ? `${title} content` : 'Dialog content'">
            <div
              :class="
                cn(
                  'px-6 pb-6',
                  $slots.eyebrow || $slots.header || title || showClose ? 'pt-2' : 'pt-6',
                  contentClass,
                )
              ">
              <slot />
            </div>
          </ScrollArea>
          <DialogFooter v-if="$slots.footer">
            <slot name="footer" />
          </DialogFooter>
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
import DialogFooter from "../Shared/DialogFooter.vue";
import { cn } from "../../utils/cn";
import IconButton from "./IconButton.vue";
import ScrollArea from "./ScrollArea.vue";
import { isBackdropInteraction, useDialogBackdrop } from "../../composables/useDialogBackdrop";
import { useSheetFocus } from "../../composables/useSheetFocus";

interface DialogProps {
  title?: string;
  size?:
    | "sm"
    | "md"
    | "lg"
    | "xl"
    | "2xl"
    | "screen-sm"
    | "screen-md"
    | "screen-lg"
    | "screen-xl"
    | "screen-2xl"
    | "full";
  showClose?: boolean;
  persistent?: boolean;
  initialFocus?: SheetFocusTarget;
  contentClass?: string;
}

const {
  title = "",
  size = "md",
  showClose = true,
  persistent = false,
  initialFocus,
  contentClass = "",
} = defineProps<DialogProps>();

const isOpen = defineModel<boolean>("isOpen", { required: true });

const emit = defineEmits<{
  close: [];
  dismiss: [];
  openAutoFocus: [event: Event];
  closeAutoFocus: [event: Event];
}>();

defineSlots<{
  default?: () => unknown;
  eyebrow?: () => unknown;
  header?: () => unknown;
  footer?: () => unknown;
}>();

const sizeClasses = {
  sm: "max-w-sm",
  md: "max-w-md",
  lg: "max-w-lg",
  xl: "max-w-xl",
  "2xl": "max-w-2xl",
  "screen-sm": "max-w-screen-sm",
  "screen-md": "max-w-screen-md",
  "screen-lg": "max-w-screen-lg",
  "screen-xl": "max-w-screen-xl",
  "screen-2xl": "max-w-screen-2xl",
  full: "max-w-none",
};

const handleOpenChange = (value: boolean) => {
  isOpen.value = value;
  if (!value) emit("close");
};

const handleEscapeKeyDown = (event: Event) => {
  if (!persistent) return;
  event.preventDefault();
  emit("dismiss");
};

const requestClose = () => {
  if (persistent) {
    emit("dismiss");
    return;
  }
  handleOpenChange(false);
};

// Reka's own dismissal is prevented (`@interact-outside.prevent`) so a focus
// leaving the dialog can't close it; this is the pointer half of it, reinstated
// on the one event that is layer-aware. See `useDialogBackdrop`.
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
.dialog-content[data-state="open"] {
  animation: dialogContentIn theme("transitionDuration.base")
    theme("transitionTimingFunction.standard");
}
.dialog-content[data-state="closed"] {
  animation: dialogContentOut theme("transitionDuration.base")
    theme("transitionTimingFunction.exit") forwards;
}

@media (prefers-reduced-motion: reduce) {
  .dialog-content[data-state] {
    animation: none;
  }
}

/* Translation keeps measured dimensions stable for the footer's corner clip. */
@keyframes dialogContentIn {
  from {
    opacity: 0;
    transform: translateY(calc(-50% + theme("spacing.2")));
  }
  to {
    opacity: 1;
    transform: translateY(-50%);
  }
}
@keyframes dialogContentOut {
  from {
    opacity: 1;
    transform: translateY(-50%);
  }
  to {
    opacity: 0;
    transform: translateY(calc(-50% + theme("spacing.2")));
  }
}
</style>
