<template>
  <ToastProvider label="Feedback" swipe-direction="down" :duration="DEFAULT_DURATION">
    <!--
      The viewport is declared before the toasts on purpose: every `ToastRoot`
      teleports itself into it, so it has to exist by the time one mounts.
    -->
    <!--
      The viewport has no height of its own: every toast is absolutely
      positioned on its bottom edge and lifted into place by the layout below,
      so it is a line the stack stands on rather than a box around it. Its
      width is still what caps a toast — `max-w-xl` is where the longest titles
      the app raises fit on their one line — with the toasts insetting
      themselves from it. The pointer or focus anywhere in it spreads the deck.
    -->
    <ToastPortal>
      <ToastViewport
        :hotkey="FEEDBACK_HOTKEY"
        label="Feedback messages ({hotkey})"
        class="pointer-events-none fixed inset-x-0 bottom-4 z-toast mx-auto w-full max-w-xl outline-none"
        @pointerenter="hovered = true"
        @pointerleave="hovered = false"
        @focusin="focused = true"
        @focusout="onFocusOut" />
    </ToastPortal>

    <Toast
      v-for="entry in toasts"
      :key="entry.id"
      :toast="entry"
      :placement="placements[entry.id]"
      @measure="sizes[entry.id] = $event"
      @dismiss="remove(entry.id)" />
  </ToastProvider>
</template>

<script setup lang="ts">
/**
 * The feedback toaster, and the only place it is configured. Mount it once,
 * beside the app's root, so every toast raised through `toast` in
 * `composables/useToast.ts` lands in the same stack.
 *
 * Feedback is the result of something the operator just did. It is `reka-ui`'s
 * `Toast`, rendered from the store in `composables/useToast.ts` and drawn by
 * `UI/Toast.vue`, which gives it severities, an action with a real
 * accessibility contract, and a countdown that reads the dismiss timer rather
 * than racing it.
 *
 * The portal mounts a second toaster beside this one for inbox notifications,
 * things that happened elsewhere. That one renders the portal's own
 * `Notification` objects and is not part of the design system.
 */
import { ToastPortal, ToastProvider, ToastViewport } from "reka-ui";
import { useCommands, type CommandInput } from "../../composables/useCommands";
import type { ToastPlacement } from "../../composables/useToast";
import Toast from "../UI/Toast.vue";
import { useToasts } from "../../composables/useToast";

/**
 * The deck, in vue-sonner's numbers: a card behind the front one is lifted
 * this much and scaled down this step per card, so only its top edge shows
 * above the card in front. Spread out, the cards sit `GAP` apart — the house
 * 8px, which is also what the bridge over each gap has to cover.
 */
const GAP = 8;
const LIFT = 14;
const SCALE_STEP = 0.05;
/**
 * And a step of fade per card, which sonner does not need: its white cards
 * carry a border and a shadow, and two flat `surface-inverse` pills overlapping
 * read as one stepped shape until the one behind is visibly further away.
 */
const DEPTH_FADE = 0.3;

/**
 * Reka's per-toast fallback. Every toast the store raises states its own
 * duration, so this only covers one raised directly against the provider.
 */
const DEFAULT_DURATION = 4000;

/**
 * Alt+T moves focus into the feedback stack.
 * Reka's own default is F8, which collides with nothing here but is also
 * discoverable by nobody; the viewport announces whichever it carries.
 */
const FEEDBACK_HOTKEY = ["altKey", "KeyT"];

const { toasts, dismiss, remove } = useToasts();

/** Each toast's measured box, reported by `UI/Toast.vue` as it changes. */
const sizes = reactive<Record<string, { width: number; height: number }>>({});

watch(
  () => toasts.value.map((entry) => entry.id),
  (ids) => {
    for (const id of Object.keys(sizes)) {
      if (!ids.includes(id)) delete sizes[id];
    }
  },
);

/**
 * The deck spreads while the pointer or the keyboard is in the stack.
 * `pointerenter` reaches the viewport for a pointer over any toast in it even
 * though the viewport itself takes no pointer events, and `pointerleave` only
 * fires once the pointer has left every toast — the bridge each spread-out
 * toast draws over the gap above it is what keeps that true while the deck
 * is moving under the pointer.
 */
const hovered = ref(false);
const focused = ref(false);
const expanded = computed(() => hovered.value || focused.value);

const onFocusOut = (event: FocusEvent) => {
  const viewport = event.currentTarget as HTMLElement | null;
  focused.value = !!viewport && viewport.contains(event.relatedTarget as Node | null);
};

/**
 * Where every open toast sits, from the bottom edge up.
 *
 * Two kinds of toast, two layouts. A toast carrying an action — Undo, Retry —
 * is **pinned**: it is a plain list at the edge, newest nearest it, always full
 * size and readable, because a button the operator is meant to reach must not
 * be hidden behind a newer "Station registered". Everything else is the
 * **deck** above them, vue-sonner's stack: the newest plain toast in front,
 * each older one behind it lifted `LIFT` and scaled down a step with its
 * content hidden, wearing the front card's width so the edges line up. While
 * the stack is hovered or focused the deck spreads into a list at `GAP`.
 *
 * A toast on its way out is not laid out — the others move into its room
 * while it plays its exit from where it was. One not yet measured is not laid
 * out either; its first placement is what starts its entrance.
 *
 * `z` runs down from the edge: a new toast rises from *behind* whatever is
 * nearer the edge than its place, and the deck's front card is over the cards
 * behind it.
 */
const placements = computed<Record<string, ToastPlacement>>(() => {
  const open = toasts.value.filter((entry) => entry.open && sizes[entry.id]);
  const pinned = open.filter((entry) => entry.action).reverse();
  const deck = open.filter((entry) => !entry.action).reverse();
  const out: Record<string, ToastPlacement> = {};

  let offset = 0;
  pinned.forEach((entry, index) => {
    out[entry.id] = {
      offset,
      scale: 1,
      width: null,
      stacked: false,
      expanded: true,
      opacity: 1,
      z: 200 - index,
      gap: GAP,
    };
    offset += sizes[entry.id]!.height + GAP;
  });

  const base = offset;
  const front = deck[0];
  deck.forEach((entry, index) => {
    const spread = expanded.value || index === 0;
    out[entry.id] = spread
      ? {
          offset,
          scale: 1,
          width: null,
          stacked: false,
          expanded: expanded.value,
          opacity: 1,
          z: 100 - index,
          gap: GAP,
        }
      : {
          offset: base + LIFT * index,
          scale: 1 - SCALE_STEP * index,
          width: sizes[front!.id]!.width,
          stacked: true,
          expanded: false,
          opacity: 1 - DEPTH_FADE * index,
          z: 100 - index,
          gap: GAP,
        };
    offset += sizes[entry.id]!.height + GAP;
  });

  return out;
});

/**
 * A toast whose action names a chord answers to it for as long as it is on
 * screen — `mod+z` on an undo window, today. Registered here rather than in
 * `UI/Toast.vue` because two toasts can carry the same chord, and the registry
 * would fire whichever it met first; walking the stack from the newest picks
 * the action the operator took last, and one command per chord is what the
 * palette should list. The action closes its toast the way the button would.
 */
const shortcutCommands = computed<CommandInput[]>(() => {
  const taken = new Set<string>();
  const commands: CommandInput[] = [];
  for (const entry of [...toasts.value].reverse()) {
    const action = entry.action;
    if (!entry.open || !action?.shortcut || taken.has(action.shortcut)) continue;
    taken.add(action.shortcut);
    commands.push({
      id: `toast-action-${entry.id}`,
      name: `${action.label}: ${entry.title}`,
      group: "Action",
      shortcut: action.shortcut,
      action: () => {
        action.onSelect();
        dismiss(entry.id);
      },
    });
  }
  return commands;
});

useCommands(shortcutCommands);
</script>
