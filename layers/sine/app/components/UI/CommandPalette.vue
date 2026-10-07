<template>
  <DialogRoot :open="open" @update:open="open = $event">
    <DialogPortal>
      <DialogOverlay class="cmd-overlay fixed inset-0 z-palette" />
      <DialogContent
        :aria-describedby="undefined"
        class="cmd-content fixed inset-x-4 top-[12vh] z-palette mx-auto max-w-xl outline-none"
        @open-auto-focus="focusInput"
        @close-auto-focus="restoreFocus">
        <motion.div
          :initial="{ scale: reducedMotion ? 1 : CLOSED_SCALE }"
          :animate="{ scale: open || reducedMotion ? 1 : CLOSED_SCALE }"
          :transition="scaleTransition">
          <Squircle
            class="flex max-h-[70vh] flex-col"
            glass="lg"
            :radius="RADIUS.row"
            v-bind="glassStroke()">
            <DialogTitle class="sr-only">{{ title }}</DialogTitle>
            <div class="border-b">
              <input
                ref="input"
                v-model="query"
                type="search"
                role="combobox"
                :aria-label="title"
                aria-autocomplete="list"
                aria-haspopup="listbox"
                :aria-expanded="open"
                :aria-controls="listboxId"
                :aria-activedescendant="activeItem ? optionId(activeItem.id) : undefined"
                :placeholder="placeholder"
                class="w-full bg-transparent p-4 text-ink outline-none placeholder:text-ink-4 [&::-webkit-search-cancel-button]:appearance-none"
                @keydown="handleKeydown" />
            </div>
            <motion.div
              :animate="{ height: listHeight }"
              :transition="
                reducedMotion ? { duration: 0 } : { type: 'spring', bounce: 0.2, duration: 0.2 }
              "
              class="min-h-0 overflow-hidden">
              <ScrollArea
                root-class="h-full"
                viewport-class="h-full w-full p-1 pr-2"
                scrollbar-class="pb-4">
                <ul :id="listboxId" role="listbox" :aria-label="resultsLabel">
                  <li
                    v-for="(item, index) in items"
                    :id="optionId(item.id)"
                    :key="item.id"
                    :ref="(element) => setOptionRef(index, element as HTMLElement | null)"
                    role="option"
                    :aria-selected="index === activeIndex"
                    :data-highlighted="index === activeIndex || undefined"
                    class="menu-item flex-col items-stretch gap-0.5 px-3 py-2.5"
                    @click="select(item)"
                    @pointermove="activeIndex = index">
                    <span class="flex w-full items-center gap-3">
                      <span class="min-w-0 flex-1 truncate font-medium text-ink">{{
                        item.name
                      }}</span>
                      <KeyboardShortcut
                        v-if="item.shortcut"
                        :keys="item.shortcut"
                        class="shrink-0 text-ink-3"
                        aria-hidden="true" />
                      <span v-if="item.group" class="type-caption shrink-0">{{ item.group }}</span>
                    </span>
                    <span v-if="item.detail" class="type-caption line-clamp-1 w-full">
                      {{ item.detail }}
                    </span>
                  </li>
                </ul>
                <p v-if="!items.length" class="type-body-sm px-4 py-3 text-ink-3">
                  {{ query.trim() ? emptyText : initialText }}
                </p>
              </ScrollArea>
            </motion.div>
          </Squircle>
        </motion.div>
      </DialogContent>
    </DialogPortal>
  </DialogRoot>
</template>

<script setup lang="ts">
import { DialogContent, DialogOverlay, DialogPortal, DialogRoot, DialogTitle } from "reka-ui";
import { motion, useReducedMotion } from "motion-v";
import { Squircle } from "../../utils/squircle";
import { RADIUS, glassStroke } from "../../utils/controlSquircle";
import { duration } from "../../utils/motion";
import ScrollArea from "./ScrollArea.vue";
import KeyboardShortcut from "./KeyboardShortcut.vue";
import { useShortcutBlocker } from "../../composables/useShortcutBlocker";

/** The consumer supplies ordered results and handles the selected command. */
export interface CommandPaletteItem {
  id: string;
  name: string;
  group?: string;
  detail?: string;
  shortcut?: string;
}

const {
  items,
  title = "Command palette",
  placeholder = "Search everything…",
  resultsLabel = "Commands",
  emptyText = "No results",
  initialText = "Type to search commands.",
} = defineProps<{
  items: readonly CommandPaletteItem[];
  title?: string;
  placeholder?: string;
  resultsLabel?: string;
  emptyText?: string;
  initialText?: string;
}>();

const open = defineModel<boolean>("open", { required: true });
const query = defineModel<string>("query", { required: true });
const emit = defineEmits<{ select: [item: CommandPaletteItem] }>();

useShortcutBlocker(open);

const input = useTemplateRef<HTMLInputElement>("input");
const activeIndex = ref(0);
const optionRefs = ref<Map<number, HTMLElement>>(new Map());
const reducedMotion = useReducedMotion();
const listboxId = `command-palette-${useId()}`;
let previouslyFocused: HTMLElement | null = null;
const CLOSED_SCALE = 0.96;
const ITEM_HEIGHT = 44;
const MAX_VISIBLE_ITEMS = 8;
const MIN_HEIGHT = 52;

const scaleTransition = computed(() =>
  reducedMotion.value
    ? ({ duration: 0 } as const)
    : ({
        type: "spring",
        duration: open.value ? duration.reveal : duration.fast,
        bounce: 0.25,
      } as const),
);

const activeItem = computed(() => items[activeIndex.value]);
const listHeight = computed(() =>
  items.length
    ? Math.min(items.length * ITEM_HEIGHT, MAX_VISIBLE_ITEMS * ITEM_HEIGHT) + 8
    : MIN_HEIGHT,
);

watch([() => items, query], () => (activeIndex.value = 0));
watch(open, (value) => {
  if (value) {
    previouslyFocused = document.activeElement as HTMLElement | null;
  } else {
    query.value = "";
    activeIndex.value = 0;
  }
});

function optionId(id: string) {
  return `${listboxId}-${id}`;
}

function setOptionRef(index: number, element: HTMLElement | null) {
  if (element) optionRefs.value.set(index, element);
  else optionRefs.value.delete(index);
}

function focusInput(event: Event) {
  event.preventDefault();
  nextTick(() => input.value?.focus());
}

function restoreFocus(event: Event) {
  event.preventDefault();
  const target = previouslyFocused;
  previouslyFocused = null;
  if (target?.isConnected) requestAnimationFrame(() => target.focus());
}

function scrollActiveIntoView() {
  nextTick(() => optionRefs.value.get(activeIndex.value)?.scrollIntoView({ block: "nearest" }));
}

function move(step: number) {
  if (!items.length) return;
  activeIndex.value = (activeIndex.value + step + items.length) % items.length;
  scrollActiveIntoView();
}

function handleKeydown(event: KeyboardEvent) {
  // `mod+k` closes the palette, once per press: held, the first repeat would
  // close the palette its own press had just opened. The prevented default is
  // what tells the command registry the key is taken, so a registered `mod+k`
  // doesn't open the palette again under the same keypress.
  if (event.key.toLowerCase() === "k" && (event.metaKey || event.ctrlKey)) {
    event.preventDefault();
    if (!event.repeat) open.value = false;
    return;
  }

  switch (event.key) {
    case "ArrowDown":
      move(1);
      break;
    case "ArrowUp":
      move(-1);
      break;
    case "Home":
      activeIndex.value = 0;
      scrollActiveIntoView();
      break;
    case "End":
      activeIndex.value = Math.max(0, items.length - 1);
      scrollActiveIntoView();
      break;
    case "Enter":
      if (activeItem.value) select(activeItem.value);
      break;
    default:
      return;
  }
  event.preventDefault();
}

function select(item: CommandPaletteItem) {
  emit("select", item);
  open.value = false;
}
</script>

<style lang="postcss">
.cmd-overlay[data-state="open"] {
  animation: dialogOverlayIn theme("transitionDuration.reveal")
    theme("transitionTimingFunction.standard");
}
.cmd-overlay[data-state="closed"] {
  animation: dialogOverlayOut theme("transitionDuration.fast")
    theme("transitionTimingFunction.exit") forwards;
}
.cmd-content[data-state="open"] {
  animation: cmdContentIn theme("transitionDuration.reveal")
    theme("transitionTimingFunction.standard");
}
.cmd-content[data-state="closed"] {
  animation: cmdContentOut theme("transitionDuration.fast") theme("transitionTimingFunction.exit")
    forwards;
}

@media (prefers-reduced-motion: reduce) {
  .cmd-overlay[data-state],
  .cmd-content[data-state] {
    animation: none;
  }
}

@keyframes cmdContentIn {
  from {
    --squircle-opacity: 0;
  }
}
@keyframes cmdContentOut {
  to {
    --squircle-opacity: 0;
  }
}
</style>
