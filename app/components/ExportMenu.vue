<script setup lang="ts">
import { ref } from "vue";
import {
  DropdownMenuContent,
  DropdownMenuPortal,
  DropdownMenuRoot,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "reka-ui";
import Button from "#layers/sine/app/components/UI/Button.vue";
import MenuSurface from "#layers/sine/app/components/UI/MenuSurface.vue";
import IconNucleoBracketsCurly from "#layers/sine/app/components/Icon/Nucleo/BracketsCurly.vue";
import IconNucleoChevronDown from "#layers/sine/app/components/Icon/Nucleo/ChevronDown.vue";
import IconNucleoImage from "#layers/sine/app/components/Icon/Nucleo/Image.vue";
import IconNucleoSquareDashed2 from "#layers/sine/app/components/Icon/Nucleo/SquareDashed2.vue";
import { useLayoutApp } from "../composables/useLayoutApp";

/**
 * The page's primary action, the one dark control in the title bar: export the
 * open layout. KLE JSON is the portable file; the images are for showing it.
 */
const app = useLayoutApp();
const open = ref(false);
</script>

<template>
  <DropdownMenuRoot v-model:open="open">
    <DropdownMenuTrigger as-child>
      <Button size="sm">
        Export
        <template #trailing>
          <IconNucleoChevronDown
            class="transition-transform duration-base ease-standard"
            :class="open && 'rotate-180'" />
        </template>
      </Button>
    </DropdownMenuTrigger>
    <DropdownMenuPortal>
      <DropdownMenuContent as-child align="end" :side-offset="6">
        <MenuSurface class="w-56">
          <MenuRow label="KLE JSON" :icon="IconNucleoBracketsCurly" shortcut="mod+s" @select="app.exportAs('json')" />
          <DropdownMenuSeparator class="my-1 h-px bg-line" />
          <MenuRow label="SVG image" :icon="IconNucleoSquareDashed2" @select="app.exportAs('svg')" />
          <MenuRow label="PNG image" :icon="IconNucleoImage" @select="app.exportAs('png')" />
        </MenuSurface>
      </DropdownMenuContent>
    </DropdownMenuPortal>
  </DropdownMenuRoot>
</template>
