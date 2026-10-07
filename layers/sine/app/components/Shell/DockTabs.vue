<template>
  <div class="flex h-11 shrink-0 items-end gap-0.5 bg-fill-2 pl-2 pr-1.5">
    <div
      role="tablist"
      :aria-label="label"
      class="flex min-w-0 items-end gap-0.5"
      @keydown="onKeydown">
      <Squircle
        v-for="tool in tools"
        :key="tool.id"
        :radius="[RADIUS_TOKENS.xl, RADIUS_TOKENS.xl, 0, 0]"
        :shadow="null"
        :surface-class="tool.id === forward ? 'bg-surface' : 'group-hover/tab:bg-fill-2'"
        :class="
          cn(
            'group/tab relative flex h-9 min-w-0 items-center',
            tool.id === forward ? 'max-w-[164px] shrink-0' : 'max-w-[120px]',
          )
        ">
        <button
          :id="tabId(tool.id)"
          type="button"
          role="tab"
          :aria-selected="tool.id === forward"
          :aria-controls="panelId"
          :aria-label="nameOf(tool)"
          :tabindex="tool.id === focused ? 0 : -1"
          :class="
            cn(
              'focus-ring flex h-full min-w-0 flex-1 items-center gap-1.5 rounded-xl pl-2.5 text-sm',
              tool.id === forward ? 'pr-1 font-medium text-ink' : 'pr-2.5 text-ink-3',
            )
          "
          @click="emit('select', tool.id)"
          @focus="focused = tool.id">
          <component :is="tool.glyph" aria-hidden="true" class="shrink-0" />
          <span v-if="tool.id === forward || !glyphOnly" class="truncate">{{ tool.name }}</span>
          <NotificationUnreadBadge
            v-if="unseenOf(tool) > 0"
            :count="unseenOf(tool)"
            class="shrink-0" />
        </button>
        <!-- The resting tabs’ close shows on hover and focus. Past two tabs the
             resting ones are down to their glyph, with no room for one. -->
        <IconButton
          v-if="tool.id === forward || !glyphOnly"
          size="xs"
          :aria-label="`Close ${tool.name}`"
          disable-tooltip
          :class="
            cn(
              'mr-1 shrink-0',
              tool.id !== forward &&
                'opacity-0 focus-visible:opacity-100 group-hover/tab:opacity-100',
            )
          "
          @click="emit('close', tool.id)">
          <IconNucleoXmark12 />
        </IconButton>
      </Squircle>
    </div>
    <div class="ml-auto flex shrink-0 items-center self-center">
      <slot name="end" />
    </div>
  </div>
</template>

<script setup lang="ts">
import { RADIUS_TOKENS, Squircle } from "../../utils/squircle";
import type { ShellTool } from "./tools";
import { cn } from "../../utils/cn";
import NotificationUnreadBadge from "../Notification/UnreadBadge.vue";
import IconButton from "../UI/IconButton.vue";
import IconNucleoXmark12 from "../Icon/Nucleo/Xmark12.vue";

/**
 * The dock’s tabs, drawn like a browser’s: a strip along the top of the dock,
 * each pinned tool a tab named by what it holds, the forward one joined to the
 * body below. A tab’s close unpins its tool. From the third tab the resting
 * ones fall back to their glyph, which is why a tool’s glyph has to tell it
 * from the others.
 *
 * A tool’s news sits on its tab while another tab is forward: its glyph is
 * what the host passes, its working spinner while a turn runs, and an unseen
 * count badges it. The forward tab shows neither, since the tool shows the
 * work itself.
 */
const { tools, forward, label, panelId } = defineProps<{
  /** The pinned tools, in the dock’s order. */
  tools: readonly ShellTool[];
  /** The tab that is forward. */
  forward: string | null;
  /** The tablist’s name. */
  label: string;
  /** The body the tabs control. */
  panelId?: string;
}>();

const emit = defineEmits<{
  select: [id: string];
  close: [id: string];
}>();

/** Past two tabs, the resting ones show only their glyph. */
const glyphOnly = computed(() => tools.length > 2);

const uid = useId();
const tabId = (id: string) => `${uid}-tab-${id}`;
defineExpose({ tabId });

const unseenOf = (tool: ShellTool) => (tool.id === forward ? 0 : (tool.unseen ?? 0));

const nameOf = (tool: ShellTool) => {
  const parts = [tool.name];
  if (tool.id !== forward && tool.working) parts.push("working");
  const unseen = unseenOf(tool);
  if (unseen > 0) parts.push(`${unseen} unseen ${unseen === 1 ? "response" : "responses"}`);
  return parts.join(", ");
};

/** The tab that takes the keyboard: the forward one, until the arrows move it. */
const focused = ref<string | null>(forward);
watch(
  () => forward,
  (next) => {
    focused.value = next;
  },
);

const onKeydown = (event: KeyboardEvent) => {
  const ids = tools.map((tool) => tool.id);
  const index = ids.indexOf(focused.value ?? "");
  let next: number | null = null;
  if (event.key === "ArrowRight") next = (index + 1) % ids.length;
  else if (event.key === "ArrowLeft") next = (index - 1 + ids.length) % ids.length;
  else if (event.key === "Home") next = 0;
  else if (event.key === "End") next = ids.length - 1;
  if (next === null) return;
  event.preventDefault();
  const id = ids[next];
  if (id === undefined) return;
  focused.value = id;
  (event.currentTarget as HTMLElement)
    .querySelector<HTMLElement>(`#${CSS.escape(tabId(id))}`)
    ?.focus();
};
</script>
