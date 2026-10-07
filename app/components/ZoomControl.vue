<script setup lang="ts">
import { computed } from "vue";
import {
  DropdownMenuContent,
  DropdownMenuItemIndicator,
  DropdownMenuPortal,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuRoot,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "reka-ui";
import Button from "#layers/sine/app/components/UI/Button.vue";
import IconButton from "#layers/sine/app/components/UI/IconButton.vue";
import MenuSurface from "#layers/sine/app/components/UI/MenuSurface.vue";
import Pill from "#layers/sine/app/components/UI/Pill.vue";
import IconNucleoCheck12 from "#layers/sine/app/components/Icon/Nucleo/Check12.vue";
import IconNucleoMinus from "#layers/sine/app/components/Icon/Nucleo/Minus.vue";
import IconNucleoPlus from "#layers/sine/app/components/Icon/Nucleo/Plus.vue";
import { glassStroke } from "#layers/sine/app/utils/controlSquircle";
import { ariaKeyshortcuts } from "../utils/shortcuts";
import { formatScale, stepZoom, ZOOM_MAX, ZOOM_MIN, type Zoom } from "../utils/zoom";

/**
 * The stage's zoom, floating over its corner as map chrome does: glass, with
 * the scale between the two steps. The scale opens the presets.
 */
const { zoom, scale } = defineProps<{ zoom: Zoom; scale: number }>();
const emit = defineEmits<{ zoom: [zoom: Zoom] }>();

const PRESETS = [0.5, 1, 2] as const;
const choice = computed({
  get: () => (zoom === "fit" ? "fit" : String(zoom)),
  set: (value: string) => emit("zoom", value === "fit" ? "fit" : Number(value)),
});
</script>

<template>
  <Pill glass="md" v-bind="glassStroke()" class="flex items-center gap-0.5 p-1">
    <IconButton
      aria-label="Zoom out"
      :aria-keyshortcuts="ariaKeyshortcuts('mod+-')"
      disable-tooltip
      :disabled="scale <= ZOOM_MIN + 0.001"
      @click="emit('zoom', stepZoom(scale, -1))">
      <IconNucleoMinus />
    </IconButton>
    <DropdownMenuRoot>
      <DropdownMenuTrigger as-child>
        <Button variant="ghost" size="sm" class="w-16 tabular-nums" :aria-label="`Zoom, ${formatScale(scale)}`">
          {{ formatScale(scale) }}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuPortal>
        <DropdownMenuContent as-child side="top" align="center" :side-offset="8">
          <MenuSurface class="w-48">
            <DropdownMenuRadioGroup v-model="choice">
              <DropdownMenuRadioItem value="fit" class="menu-item" :aria-keyshortcuts="ariaKeyshortcuts('mod+0')">
                <span class="min-w-0 flex-1">Zoom to fit</span>
                <DropdownMenuItemIndicator><IconNucleoCheck12 /></DropdownMenuItemIndicator>
              </DropdownMenuRadioItem>
              <DropdownMenuSeparator class="my-1 h-px bg-line" />
              <DropdownMenuRadioItem
                v-for="preset in PRESETS"
                :key="preset"
                :value="String(preset)"
                class="menu-item tabular-nums">
                <span class="min-w-0 flex-1">{{ formatScale(preset) }}</span>
                <DropdownMenuItemIndicator><IconNucleoCheck12 /></DropdownMenuItemIndicator>
              </DropdownMenuRadioItem>
            </DropdownMenuRadioGroup>
          </MenuSurface>
        </DropdownMenuContent>
      </DropdownMenuPortal>
    </DropdownMenuRoot>
    <IconButton
      aria-label="Zoom in"
      :aria-keyshortcuts="ariaKeyshortcuts('mod+=')"
      disable-tooltip
      :disabled="scale >= ZOOM_MAX - 0.001"
      @click="emit('zoom', stepZoom(scale, 1))">
      <IconNucleoPlus />
    </IconButton>
  </Pill>
</template>
