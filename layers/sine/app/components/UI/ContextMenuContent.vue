<template>
  <DropdownMenuPortal>
    <DropdownMenuContent
      as-child
      v-bind="placement"
      @interact-outside="noteInteractOutside"
      @close-auto-focus="closeAutoFocus">
      <MenuSurface
        v-bind="surfaceAttrs"
        :rounded="sheet"
        :padded="!sheet"
        :z="sheet ? dialogZIndex : undefined"
        :class="
          cn(
            'text-sm outline-none',
            sheet ? 'dropdown-content--sheet menu-sheet' : 'min-w-52',
            attrs.class as string,
          )
        "
        :style="sheet ? sheetStyle : undefined">
        <template v-if="sheet">
          <ContextMenuSheetHandle />
          <!-- The body runs to the sheet's bottom edge, with the surface's
               inset on its own viewport, so a row scrolled past it fades into
               the rim rather than stopping 4px short of it. The track keeps the
               corner's 16px at that end and stays 4px in from the side. -->
          <ScrollArea
            :viewport-attrs="{ style: sheetBodyStyle }"
            viewport-class="px-1 pb-1"
            scrollbar-class="mt-1 mb-2 mr-1">
            <slot />
          </ScrollArea>
        </template>
        <slot v-else />
      </MenuSurface>
    </DropdownMenuContent>
  </DropdownMenuPortal>
</template>

<script setup lang="ts">
import { useWindowSize } from "@vueuse/core";
import { DropdownMenuContent, DropdownMenuPortal } from "reka-ui";
import { useDialogBackdrop } from "../../composables/useDialogBackdrop";
import { cn } from "../../utils/cn";
import {
  CONTEXT_MENU_KEY,
  SHEET_GUTTER,
  SHEET_HEIGHT_RATIO,
  sheetReference,
} from "../../utils/contextMenu";
import MenuSurface from "./MenuSurface.vue";
import ContextMenuSheetHandle from "./ContextMenuSheetHandle.vue";
import ScrollArea from "./ScrollArea.vue";

/**
 * The surface a `ContextMenu` opens. Rows go in the slot as Reka's
 * `DropdownMenuItem`, `DropdownMenuLabel` and `DropdownMenuSeparator`, and a
 * submenu is a `ContextMenuSub`.
 *
 * Two presentations, decided by the root and drawn here — the one place every
 * context menu's shape is decided, which is the point of it being
 * first-party:
 *
 * - **A popper**, beside the point the root recorded: the house menu
 *   squircle, growing out of the corner nearest the pointer and flipping
 *   rather than sliding at a viewport edge.
 * - **A sheet**, on a compact viewport: the same squircle a step rounder,
 *   inset from the bottom edge by the gutter and the safe area, on the shared
 *   dialog backdrop, rising from below. Rows are `.menu-sheet`-sized for a
 *   thumb, and the body scrolls past `SHEET_HEIGHT_RATIO` of the viewport.
 *   Reka positions it: `side="top"` on a reference that is the gutter band
 *   itself, so the placement is a measurement rather than a rule this file
 *   has to keep in step with the popper's.
 *
 * Attributes land on the menu element — `aria-label` names it, `class` widens
 * a popper (`min-w-52` is the default), and `MenuSurface`'s own props
 * (`variant`, `rounded`, `z`) pass straight through.
 */

defineOptions({ inheritAttrs: false });
const emit = defineEmits<{ closeAutoFocus: [event: Event] }>();

const attrs = useAttrs();
const surfaceAttrs = computed(() => {
  const { class: _class, ...rest } = attrs;
  return rest;
});

const menu = inject(CONTEXT_MENU_KEY);
if (!menu) throw new Error("ContextMenuContent must be rendered inside a ContextMenu.");
const { anchor, sheet, isOpen, restoreFocus, noteInteractOutside } = menu;
// Actions that open an editor can supply the next focus target on dismissal.
const closeAutoFocus = (event: Event) => {
  emit("closeAutoFocus", event);
  restoreFocus(event);
};

const { width: viewportWidth, height: viewportHeight } = useWindowSize();

const placement = computed(() =>
  sheet.value
    ? {
        side: "top" as const,
        align: "center" as const,
        sideOffset: 0,
        avoidCollisions: false,
        reference: sheetReference(viewportWidth.value, viewportHeight.value),
      }
    : {
        side: "right" as const,
        align: "start" as const,
        sideOffset: 4,
        prioritizePosition: true,
        reference: anchor.value,
      },
);

// The sheet is a modal surface like a dialog, so it shares the dialog
// backdrop and takes its place in that stack's z-order.
const { dialogZIndex } = useDialogBackdrop(() => sheet.value && isOpen.value);

const sheetStyle = computed(() => ({ width: `${viewportWidth.value - SHEET_GUTTER * 2}px` }));
const sheetBodyStyle = computed(() => ({
  maxHeight: `${Math.round(viewportHeight.value * SHEET_HEIGHT_RATIO)}px`,
}));
</script>
