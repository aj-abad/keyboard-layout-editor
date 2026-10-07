<template>
  <ToastRoot
    v-slot="{ remaining, duration }"
    as-child
    :open="true"
    :duration="rekaDuration"
    type="foreground"
    @update:open="onOpenChange">
    <!--
      `li`, because `ToastViewport` is an `ol` and every toast teleports into
      it. The default `div` puts a non-list child directly inside a list, which
      is invalid list markup.

      It is Reka's root and nothing else: `data-state`, the swipe attributes
      and the pointer handlers land here, and the swipe rules below move it.
      Everything this component animates itself is on the frame inside, so the
      two never write the same `transform`.

      Absolutely positioned at the viewport's bottom edge and centred by its
      auto margins — every toast sits on the same spot and the frame's `y`
      lifts it to its place in the stack. `w-fit` between the two insets is
      what keeps the pill hugging its text and capped at the viewport.
    -->
    <li
      class="toast pointer-events-auto absolute inset-x-4 bottom-0 mx-auto w-fit"
      :data-tone="toast.tone"
      :data-stacked="placement?.stacked || undefined"
      :data-expanded="placement?.expanded || undefined"
      :style="itemStyle">
      <div ref="frame" :style="FRAME_INITIAL">
        <Squircle :radius="RADIUS.pill" surface-class="bg-surface-inverse" :shadow="null">
          <div class="toast__content flex items-center gap-2.5 p-2">
            <span
              aria-hidden="true"
              :class="cn('flex size-8 shrink-0 items-center justify-center', wellClass)"
              :style="WELL_CLIP">
              <component :is="glyph" :size="18" />
            </span>

            <!--
              One line, and only one. The pill is sized by its content and
              capped by the viewport, so a long title truncates rather than
              wrapping — a second line made the capsule a lozenge, and a
              toast that needs one is the wrong component (see
              `composables/useToast.ts`).
            -->
            <ToastTitle class="type-label min-w-0 truncate text-ink-inverse">{{
              toast.title
            }}</ToastTitle>

            <!--
              The action rides in the trailing cluster rather than under the
              text: stacked, a one-word label left a toast-width of dead space
              beside it and made every actionable toast a line taller.
            -->
            <!--
              `gap-2`, not `gap-1`: the countdown ring is drawn to the close
              button's own edge, so at 4px it read as touching the action's
              keyline — two outlined shapes with a hairline between them.
            -->
            <div class="flex shrink-0 items-center gap-2">
              <ToastAction v-if="toast.action" as-child :alt-text="toast.action.altText">
                <!--
                  The chord is drawn inside the button, as the palette draws
                  it. `Button` sizes any SVG in a slot to its icon size,
                  which would blow the `kbd`'s glyph up to 16px in a 20px key;
                  the descendant rule is more specific than the button's own
                  and hands the key its 12px back.
                -->
                <Button variant="inverse" class="[&_kbd_svg]:size-3" @click="toast.action.onSelect">
                  {{ toast.action.label }}
                  <template v-if="toast.action.shortcut" #trailing>
                    <KeyboardShortcut
                      :keys="toast.action.shortcut"
                      class="text-ink-inverse-3"
                      kbd-surface-class="bg-fill-inverse-2" />
                  </template>
                </Button>
              </ToastAction>

              <div v-if="toast.dismissible" class="relative">
                <!--
                  The ring is drawn around the close button rather than beside
                  it: the countdown and the dismiss are the same offer — "this
                  is going, or you can send it now" — so they read better as
                  one control than as a timer and a separate X. It sits over
                  the button and takes no pointer events, so the 32px target
                  underneath is untouched.
                -->
                <svg
                  v-if="toast.countdown && Number.isFinite(duration)"
                  class="pointer-events-none absolute inset-0 -rotate-90 text-ink-inverse-3"
                  viewBox="0 0 32 32"
                  aria-hidden="true"
                  focusable="false">
                  <circle
                    cx="16"
                    cy="16"
                    :r="RING_RADIUS"
                    fill="none"
                    stroke="currentColor"
                    :stroke-width="RING_WIDTH"
                    stroke-linecap="round"
                    :stroke-dasharray="RING_LENGTH"
                    :stroke-dashoffset="RING_LENGTH * (1 - fraction(remaining, duration))" />
                </svg>

                <ToastClose as-child>
                  <IconButton
                    variant="inverse"
                    :aria-label="`Dismiss: ${toast.title}`"
                    disable-tooltip>
                    <IconNucleoXmark />
                  </IconButton>
                </ToastClose>
              </div>
            </div>
          </div>
        </Squircle>
      </div>
    </li>
  </ToastRoot>
</template>

<script setup lang="ts">
import IconNucleoXmark from "../Icon/Nucleo/Xmark.vue";

import { useResizeObserver } from "@vueuse/core";
import { animate } from "motion-v";
import { ToastAction, ToastClose, ToastRoot, ToastTitle } from "reka-ui";
import type { Component } from "vue";
import { Squircle, squircleStyle } from "../../utils/squircle";
import IconNucleoCircleCheckGlyph from "../Icon/Nucleo/CircleCheckGlyph.vue";
import IconNucleoCircleInfo from "../Icon/Nucleo/CircleInfo.vue";
import IconNucleoOctagonWarning from "../Icon/Nucleo/OctagonWarning.vue";
import IconNucleoTriangleWarning from "../Icon/Nucleo/TriangleWarning.vue";
import { RADIUS } from "../../utils/controlSquircle";
import { statusInkInverseClass } from "../../utils/status";
import type { ToastPlacement, ToastRecord, ToastTone } from "../../composables/useToast";
import { cn } from "../../utils/cn";
import Button from "./Button.vue";
import KeyboardShortcut from "./KeyboardShortcut.vue";
import IconButton from "./IconButton.vue";
import { useMotionTokens } from "../../utils/motion";

/**
 * One toast: the app's transient feedback, and the only thing that draws it.
 *
 * It is a **flat `surface-inverse` pill**: no glass, no shadow, sized by what
 * it says, and what it says is one line — that the action succeeded or failed,
 * with Undo or Retry beside it when there is one (the argument is in
 * `composables/useToast.ts`). A capsule rather than the 24px sheet it was
 * drawn as until 2026-09-12: at one line the sheet's corners were meeting in
 * the middle anyway, and a wrapped title turned the shape into a lozenge. The
 * description line went on 2026-09-13, for the same reason from the other
 * side — a toast that needs a second line is the wrong component. Being flat
 * is what lets it sit on a mostly-white dashboard without reading as a card
 * that has come loose: it is the only dark thing on the canvas, so it needs
 * no shadow to separate from it.
 *
 * ## Everything on it is drawn on the inverse scale
 *
 * `ink-inverse-*` for text, `fill-inverse-*` for the well and the control
 * states, `line-inverse` for the action's keyline, `focus-ring-inverse` for
 * focus — the standard ring is `surface-inverse`, which is what this surface
 * *is*. `Button` and `IconButton` each grew an `inverse` variant for it.
 *
 * ## Severity is the glyph, not the surface
 *
 * A neutral `fill-inverse-2` well and a status glyph, which is the same rule
 * the map pins follow — neutral shells, status in the glyph. The ink comes from
 * `statusInkInverseClass`, the bright `*-dot` end of each tone, because the
 * `DEFAULT` hues are tuned to carry text on white and are unreadable here. The
 * `*-fill` tints a notification's well takes are not used: they are alphas
 * tuned for light grounds, and on this pill they nearly vanish.
 *
 * The glyphs are Nucleo's solid `glyph` fill at 18px (2026-09-23), not the
 * glyph-duo the notification wells draw. Duo sets its mark on a soft disc of
 * its own ink, and on this pill that disc sits too close to the mark: 1.8:1
 * for `bad`. Knocked out of a solid shape, as Phosphor's fill weight drew
 * them before, the marks read at 2.5:1 (`bad`) to 4.4:1 (`warn`). That is
 * why the check is `CircleCheckGlyph`: `circle-check` is also drawn duo, and
 * a second fill of a label carries its fill in its name.
 *
 * ## It arrives along an arc, into a place the viewport decides
 *
 * Every toast is absolutely positioned on the viewport's bottom edge, and
 * `Shared/Toasters.vue` hands it a `placement` — how far up it sits, its scale,
 * whether it is a card in the stack — worked out from the measured size of
 * every open toast. This component only animates to it: `y` and `scale` on
 * the frame, on `transition.arc`, which is the sine curve of a point riding a
 * wheel up to rest. The entrance starts a full height below its place, at
 * 0.9 scale and invisible, and rises and swells into it — travel, not a
 * slide — and every later placement (the stack spreading under the pointer,
 * a neighbour leaving) is the same curve from wherever it is. The exit is the
 * reverse on `transition.exit`: a front card sinks a full height, a card
 * hidden in the stack only 40% of one, since there is nothing to see it go.
 *
 * The stack itself is vue-sonner's, redrawn in this system: the front card at
 * full size, each card behind it lifted 14px and scaled down a step with its
 * content hidden so only its edge shows, the deck spreading into a list while
 * the pointer or focus is over it. What is not sonner's is where the deck
 * sits — a toast carrying Undo or Retry is never a card in it. Those stay at
 * the edge as a plain list, always full size and readable, and the deck of
 * plain feedback rides above them. The placement carries all of that; this
 * file does not know why it was placed where it was.
 *
 * A card's content is hidden by `--squircle-group-opacity: 0` on the content
 * row, transitioned as a registered property (see the style block). It is the
 * group name rather than `--squircle-opacity` so that it multiplies with the
 * frame's own fade instead of shadowing it — the two-name rule at the top of
 * `assets/sine.css`.
 *
 * ## Reka is told the toast is open until it has gone
 *
 * `open` is held at `true`. Reka still runs the clock, the swipe, Escape and
 * the close button, and asks to close through `update:open`; this component
 * answers by playing the exit and only then telling the store to drop the
 * record — the same path a `toast.dismiss()` takes, through `open` on the
 * record. Left uncontrolled, Reka's own exit could never play: `update:open`
 * emptied the store on the same tick, and the store unmounted the toast under
 * it.
 *
 * ## Reka owns the clock; this owns the ring
 *
 * `ToastRoot` runs the dismiss timer and hands `remaining` to the default slot
 * from its own rAF, freezing it whenever the timer pauses — the pointer over
 * the viewport, the viewport focused, or the window blurred. So the ring is a
 * pure function of a number Reka is already keeping, and cannot drift from the
 * moment the toast actually leaves. Do not add a second timer beside it.
 *
 * `ToastAction` closes the toast itself after running the handler, which is why
 * Undo and Retry need no `dismiss()` of their own. Its `altText` is required by
 * the type: it names another way to do the same thing, for a reader who will
 * not reach the button in time.
 */

const { toast, placement } = defineProps<{
  toast: ToastRecord;
  /** Undefined until the viewport has measured it; nothing shows before then. */
  placement?: ToastPlacement;
}>();

const emit = defineEmits<{
  /** The exit has played and the record can go. */
  dismiss: [];
  /** Its box, whenever it changes — the viewport lays the stack out from these. */
  measure: [size: { width: number; height: number }];
}>();

/**
 * 32px at the `menu` radius. Neutral, unlike `Notification/Icon.vue`'s toned
 * well: the status tints are alphas tuned for light surfaces and nearly vanish
 * on this pill, so the tone rides on the glyph alone.
 */
const WELL_CLIP = squircleStyle({ width: 32, height: 32, radius: "xl" });

/**
 * Where the frame starts: invisible, on the edge. Motion moves it from here
 * once the viewport has placed it. One object, so the slot's per-frame
 * re-render (Reka updates `remaining` from a rAF) never re-applies it.
 */
const FRAME_INITIAL = { "--squircle-opacity": 0 } as const;

/** The scale a toast arrives at, and leaves from: the far end of its arc. */
const ARC_SCALE = 0.9;

/** How far a hidden card sinks on its way out — sonner's 40%. */
const STACKED_SINK = 0.4;

/**
 * A ring inside the 32px close button: `r` + half the stroke reaches exactly to
 * the button's edge, so the two share a silhouette instead of one haloing the
 * other.
 */
const RING_WIDTH = 2;
const RING_RADIUS = 15;
const RING_LENGTH = 2 * Math.PI * RING_RADIUS;

/**
 * A sweep this slow is still motion. Under `prefers-reduced-motion` the ring
 * ticks through twelve steps instead — the remaining time stays legible, which
 * dropping the ring entirely would not.
 */
const REDUCED_STEPS = 12;

const TONE_GLYPHS: Record<ToastTone, Component> = {
  good: IconNucleoCircleCheckGlyph,
  warn: IconNucleoTriangleWarning,
  bad: IconNucleoOctagonWarning,
  idle: IconNucleoCircleInfo,
};

const { transition, reduced } = useMotionTokens();

const frame = useTemplateRef<HTMLElement>("frame");

/**
 * Stable per placement rather than rebuilt in the template, because the slot
 * re-renders on every frame of Reka's countdown and would otherwise re-apply
 * it each time.
 */
const itemStyle = computed(() => ({
  zIndex: placement?.z,
  "--toast-gap": `${placement?.gap ?? 0}px`,
}));

const glyph = computed(() => TONE_GLYPHS[toast.tone]);

const wellClass = computed(() => cn("bg-fill-inverse-2", statusInkInverseClass[toast.tone]));

/** Reka takes a number; `Infinity` is how it is told to run no timer at all. */
const rekaDuration = computed(() => toast.duration ?? Number.POSITIVE_INFINITY);

const fraction = (remaining: number, duration: number) => {
  if (!Number.isFinite(duration) || duration <= 0) return 1;
  const raw = Math.min(1, Math.max(0, remaining / duration));
  return reduced.value ? Math.ceil(raw * REDUCED_STEPS) / REDUCED_STEPS : raw;
};

/**
 * The frame is measured rather than the list item because Reka owns the
 * item's props under `as-child`, and the item is `w-fit` around the frame so
 * the two boxes are the same. The observer is what makes the first placement
 * arrive: the viewport cannot lay a toast out until it knows how big it is.
 */
let height = 0;
useResizeObserver(frame, ([entry]) => {
  const box = entry?.borderBoxSize?.[0];
  const width = box?.inlineSize ?? entry?.contentRect.width ?? 0;
  height = box?.blockSize ?? entry?.contentRect.height ?? 0;
  emit("measure", { width, height });
});

let playing: ReturnType<typeof animate> | null = null;
let leaving = false;
let arrived = false;
/** The last placement it was given, for the exit to leave from. */
let resting: ToastPlacement | undefined;

/**
 * Up from a full height below its place, swelling from the far end of the arc.
 * A toast placed before the observer has reported (one mounted with its
 * placement already in hand) reads its own height, or it would fade in where
 * it stands with no travel at all.
 */
const rise = (el: HTMLElement, target: ToastPlacement) => {
  const travel = height || el.offsetHeight;
  playing?.stop();
  playing = animate(
    el,
    {
      y: [-target.offset + travel, -target.offset],
      scale: [ARC_SCALE, target.scale],
      "--squircle-opacity": [0, target.opacity],
    },
    transition.value.arc,
  );
};

/** To a new place in the stack, from wherever it is now. */
const settle = (el: HTMLElement, target: ToastPlacement) => {
  playing?.stop();
  playing = animate(
    el,
    {
      y: -target.offset,
      scale: target.scale,
      width: target.width ?? "auto",
      "--squircle-opacity": target.opacity,
    },
    transition.value.arc,
  );
};

/**
 * The first placement rises the toast and every later one settles it. The
 * frame is a source too, because the two can arrive in either order: in the
 * app the viewport measures the mounted toast and places it afterwards, so the
 * placement is what changes; a toast mounted with its placement already given
 * (every static story in `UI/Toast.stories.ts`) sees no placement change at
 * all, and until the frame was watched it sat invisible at `FRAME_INITIAL`.
 */
watch(
  [
    frame,
    () => placement?.offset,
    () => placement?.scale,
    () => placement?.width,
    () => placement?.stacked,
    () => placement?.opacity,
  ],
  () => {
    if (!placement || !frame.value || leaving) return;
    resting = placement;
    if (!arrived) {
      arrived = true;
      rise(frame.value, placement);
      return;
    }
    settle(frame.value, placement);
  },
);

/**
 * Sink, then go. Every way out — the clock, the close button, an action, a
 * swipe, Escape, `toast.dismiss()` — ends here, so this is the one place the
 * record leaves the store. `onDismiss` fires as it starts to leave, because
 * that is when it has left for the operator.
 *
 * A toast raised under an `id` replaces the record in place, and the same
 * component instance draws it — so if that lands while the old one is on its
 * way out, the record after the exit is not the one that was leaving. It is
 * the new toast, and it rises again instead of being dropped as the old one.
 */
const leave = async () => {
  if (leaving) return;
  leaving = true;
  const leavingRecord = toast;
  leavingRecord.onDismiss?.();

  playing?.stop();
  if (frame.value) {
    const from = resting?.offset ?? 0;
    const sink = height * (resting?.stacked ? STACKED_SINK : 1);
    playing = animate(
      frame.value,
      { y: -from + sink, scale: ARC_SCALE, "--squircle-opacity": 0 },
      transition.value.exit,
    );
    await playing;
  }

  if (toast !== leavingRecord && toast.open) {
    leaving = false;
    arrived = false;
    if (frame.value && placement) {
      arrived = true;
      resting = placement;
      rise(frame.value, placement);
    }
    return;
  }

  emit("dismiss");
};

const onOpenChange = (open: boolean) => {
  if (!open) void leave();
};

watch(
  () => toast.open,
  (open) => {
    if (!open) void leave();
  },
);

onUnmounted(() => playing?.stop());
</script>

<style>
/*
 * Not scoped: Reka teleports every toast into the viewport, which `ToastPortal`
 * has already put on `<body>`, so a scoped attribute would never reach it.
 *
 * Three things live here, none of them the entrance or the exit — those are
 * Motion, on the frame (see the component note).
 *
 * The **bridge**: a spread-out toast carries an invisible strip over the gap
 * above it, sonner's `::after`, so the pointer crossing from one toast to the
 * next never leaves the viewport — which would collapse the deck under it and
 * move the toast it was heading for.
 *
 * The **card**: a toast behind the front one hides its content by zeroing
 * `--squircle-group-opacity` on the row, which `:where(.squircle) > *`
 * multiplies into the row's opacity. The property is registered, so it
 * transitions; `opacity` itself never does, because the frame's fade writes
 * the other factor every frame and a transition there would lag it. The curve
 * is `ease.sine` from `app/utils/motion.ts`, written out because a stylesheet
 * cannot import it; keep the two in step.
 *
 * The **swipe**: Reka drives it through custom properties on the list item,
 * which is why the item and the frame are two elements — the deck's
 * `transform` and the swipe's never meet on one node. `end` holds the swiped
 * offset while the frame sinks under it, so the pill leaves from where the
 * finger let go instead of snapping back first.
 */
.toast[data-expanded]::after {
  content: "";
  position: absolute;
  left: 0;
  right: 0;
  bottom: 100%;
  height: calc(var(--toast-gap) + 1px);
}

.toast .toast__content {
  transition: --squircle-group-opacity 250ms cubic-bezier(0.39, 0.575, 0.565, 1);
}

.toast[data-stacked] .toast__content {
  --squircle-group-opacity: 0;
}

.toast[data-swipe="move"] {
  transform: translateY(var(--reka-toast-swipe-move-y));
}

.toast[data-swipe="cancel"] {
  transform: translateY(0);
  transition: transform 200ms cubic-bezier(0.32, 0.72, 0, 1);
}

.toast[data-swipe="end"] {
  transform: translateY(var(--reka-toast-swipe-end-y));
}

@media (prefers-reduced-motion: reduce) {
  .toast .toast__content,
  .toast[data-swipe="cancel"] {
    transition: none;
  }
}
</style>
