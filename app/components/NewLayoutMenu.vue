<script setup lang="ts">
import { ref, watch } from "vue";
import {
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuPortal,
  DropdownMenuRoot,
  DropdownMenuSeparator,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
  DropdownMenuTrigger,
} from "reka-ui";
import IconButton from "#layers/sine/app/components/UI/IconButton.vue";
import MenuSurface from "#layers/sine/app/components/UI/MenuSurface.vue";
import IconNucleoChevronRight12 from "#layers/sine/app/components/Icon/Nucleo/ChevronRight12.vue";
import IconNucleoCopy from "#layers/sine/app/components/Icon/Nucleo/Copy.vue";
import IconNucleoHistory from "#layers/sine/app/components/Icon/Nucleo/History.vue";
import IconNucleoLayers from "#layers/sine/app/components/Icon/Nucleo/Layers.vue";
import IconNucleoPlus from "#layers/sine/app/components/Icon/Nucleo/Plus.vue";
import IconNucleoUpload from "#layers/sine/app/components/Icon/Nucleo/Upload.vue";
import { nameOf, useLayoutApp } from "../composables/useLayoutApp";
import { TEMPLATES } from "../utils/documents";

/**
 * Where another layout comes from, each into a browser tab of its own: blank,
 * a template, a copy of this one, a file, or one this browser keeps that no
 * tab has open, as a native app's Open Recent lists them.
 */
const app = useLayoutApp();
const open = ref(false);
watch(open, (isOpen) => {
  if (isOpen) app.refreshRecent();
});

const relative = new Intl.RelativeTimeFormat(undefined, { numeric: "auto" });
const UNITS = [
  ["year", 365 * 86400],
  ["month", 30 * 86400],
  ["week", 7 * 86400],
  ["day", 86400],
  ["hour", 3600],
  ["minute", 60],
] as const;
/** When a layout was last open, as “2 hours ago” or “yesterday”. */
function ago(time: number) {
  const seconds = (time - Date.now()) / 1000;
  const [unit, size] = UNITS.find(([, length]) => Math.abs(seconds) >= length) ?? ["minute", 60];
  return relative.format(Math.round(seconds / size), unit);
}
</script>

<template>
  <DropdownMenuRoot v-model:open="open">
    <DropdownMenuTrigger as-child>
      <IconButton aria-label="New layout">
        <IconNucleoPlus />
      </IconButton>
    </DropdownMenuTrigger>
    <DropdownMenuPortal>
      <DropdownMenuContent as-child align="end" :side-offset="6">
        <MenuSurface class="w-60">
          <MenuRow label="Blank layout" :icon="IconNucleoPlus" shortcut="mod+alt+n" @select="app.newLayout()" />
          <DropdownMenuSub>
            <DropdownMenuSubTrigger class="menu-item">
              <IconNucleoLayers :size="18" aria-hidden="true" class="shrink-0" />
              <span class="min-w-0 flex-1">From a template</span>
              <IconNucleoChevronRight12 :size="12" aria-hidden="true" class="shrink-0 text-ink-4" />
            </DropdownMenuSubTrigger>
            <DropdownMenuPortal>
              <DropdownMenuSubContent as-child :side-offset="4" :align-offset="-4">
                <MenuSurface level="lg" class="w-56">
                  <MenuRow
                    v-for="template in TEMPLATES"
                    :key="template.name"
                    :label="template.name"
                    @select="app.openTemplate(template)" />
                </MenuSurface>
              </DropdownMenuSubContent>
            </DropdownMenuPortal>
          </DropdownMenuSub>
          <MenuRow label="Duplicate layout" :icon="IconNucleoCopy" @select="app.duplicateLayout()" />
          <DropdownMenuSeparator class="my-1 h-px bg-line" />
          <MenuRow label="Open…" :icon="IconNucleoUpload" shortcut="mod+o" @select="app.pickFiles()" />
          <DropdownMenuSub>
            <DropdownMenuSubTrigger class="menu-item" :disabled="!app.recent.value.length">
              <IconNucleoHistory :size="18" aria-hidden="true" class="shrink-0" />
              <span class="min-w-0 flex-1">Open recent</span>
              <IconNucleoChevronRight12 :size="12" aria-hidden="true" class="shrink-0 text-ink-4" />
            </DropdownMenuSubTrigger>
            <DropdownMenuPortal>
              <DropdownMenuSubContent as-child :side-offset="4" :align-offset="-4">
                <MenuSurface level="lg" class="w-80">
                  <DropdownMenuItem
                    v-for="{ id, record } in app.recent.value"
                    :key="id"
                    class="menu-item"
                    @select="app.openRecent(id)">
                    <LayoutThumbnail :layout="record.layout" class="h-5 w-8 shrink-0" />
                    <span class="min-w-0 flex-1 truncate">{{ nameOf(record.layout) }}</span>
                    <span class="type-caption shrink-0 text-ink-4">{{ ago(record.updated) }}</span>
                  </DropdownMenuItem>
                </MenuSurface>
              </DropdownMenuSubContent>
            </DropdownMenuPortal>
          </DropdownMenuSub>
        </MenuSurface>
      </DropdownMenuContent>
    </DropdownMenuPortal>
  </DropdownMenuRoot>
</template>
