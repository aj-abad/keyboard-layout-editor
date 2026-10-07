<template>
  <Transition :css="false" @leave="exitDropdownContent">
    <Card
      v-if="pinnedTools.length && !collapsed"
      as="aside"
      :id="id"
      aria-label="Dock"
      padding="none"
      clip-content
      content-class="flex h-full min-h-0 flex-col"
      data-side="bottom"
      data-align="end"
      data-state="open"
      :class="cn('dropdown-content dropdown-content--panel w-96', attrs.class as string)"
      v-bind="rest">
      <!-- One pinned tool keeps the popover's head, with its pin pressed. -->
      <ShellToolHead
        v-if="only"
        :title="only.name"
        :glyph="only.glyph"
        pinned
        :pinnable="pinnable"
        :heading-id="headingId"
        @unpin="emit('float')"
        @collapse="emit('collapse')">
        <template v-if="$slots.actions" #actions>
          <slot name="actions" :tool="only.id" />
        </template>
      </ShellToolHead>
      <ShellDockTabs
        v-else
        ref="tabs"
        :tools="pinnedTools"
        :forward="forward"
        label="Pinned tools"
        :panel-id="bodyId"
        @select="emit('select', $event)"
        @close="emit('close', $event)">
        <template #end>
          <IconButton aria-label="Collapse the dock" @click="emit('collapse')">
            <IconNucleoDoubleChevronRight />
          </IconButton>
        </template>
      </ShellDockTabs>
      <div
        :id="bodyId"
        :role="only ? undefined : 'tabpanel'"
        :aria-labelledby="only || forward === null ? undefined : tabs?.tabId(forward)"
        class="min-h-0 flex-1">
        <slot :tool="forward" />
      </div>
    </Card>
  </Transition>
</template>

<script setup lang="ts">
import { useAttrs } from "vue";
import { exitDropdownContent } from "../../utils/dropdownExit";
import type { ShellTool } from "./tools";
import Card from "../UI/Card.vue";
import { cn } from "../../utils/cn";
import ShellToolHead from "./ToolHead.vue";
import ShellDockTabs from "./DockTabs.vue";
import IconButton from "../UI/IconButton.vue";
import IconNucleoDoubleChevronRight from "../Icon/Nucleo/DoubleChevronRight.vue";

/**
 * The dock: the card on the canvas that pinned tools share (Patterns › Shell).
 * It is 384px wide, as the popover is, whatever it holds, and the canvas’s
 * height; the host places it inside the canvas and moves the page over by its
 * width. One pinned tool keeps the popover’s head; from the second the head
 * is the tab strip. The dock goes with its last tab, and collapses with its
 * pins kept.
 *
 * The slot draws the forward tool, and the host keeps the others mounted
 * where their state should survive a swap, as a running conversation’s does.
 */
defineOptions({ inheritAttrs: false });

const {
  tools,
  pinned,
  forward,
  collapsed = false,
  pinnable = true,
  id,
  headingId,
} = defineProps<{
  /** Every tool the shell has. */
  tools: readonly ShellTool[];
  /** The pinned tools, in the dock’s order. */
  pinned: readonly string[];
  /** The pinned tool whose tab is forward. */
  forward: string | null;
  /** Hidden, with its pins kept: the dock leaves, and comes back when this clears. */
  collapsed?: boolean;
  /** Below `xl` nothing pins: the host hides the pin there. */
  pinnable?: boolean;
  /** For the tool buttons’ `aria-controls`. */
  id?: string;
  headingId?: string;
}>();

const emit = defineEmits<{
  select: [id: string];
  close: [id: string];
  float: [];
  collapse: [];
}>();

const pinnedTools = computed(() =>
  pinned.flatMap((pin) => {
    const tool = tools.find((candidate) => candidate.id === pin);
    return tool ? [tool] : [];
  }),
);
const only = computed(() => (pinnedTools.value.length === 1 ? pinnedTools.value[0] : undefined));

const tabs = useTemplateRef<{ tabId: (id: string) => string }>("tabs");
const bodyId = `${useId()}-body`;

const attrs = useAttrs();
/** Everything but `class`, which is merged above so a host’s size and place win. */
const rest = computed(() => {
  const { class: _class, ...others } = attrs;
  return others;
});
</script>
