<script setup lang="ts">
import { ScrollAreaRoot, ScrollAreaScrollbar, ScrollAreaThumb, ScrollAreaViewport } from "reka-ui";
import { useEventListener, useMounted, useMutationObserver, useResizeObserver } from "@vueuse/core";
import { Squircle, type RadiusToken } from "../../utils/squircle";
import { CONTROL_FOCUS_COLOR } from "../../utils/controlSquircle";
import { cn } from "../../utils/cn";
import Pill from "./Pill.vue";

interface Props {
  orientation?: "horizontal" | "vertical";
  /** Names the keyboard-focusable viewport, rather than the decorative root. */
  label?: string;
  viewportAttrs?: Record<string, unknown>;
  rootClass?: string;
  viewportClass?: string;
  /** Track padding sets thumb travel; increase the exposed ends to clear surface corners. */
  scrollbarClass?: string;
  thumbClass?: string;
  /**
   * Draw the focus indicator as a concentric squircle stroke rather than the
   * inset rectangle. Pass the radius of the surface this viewport fills, as a
   * pre-measurement fallback; the ring itself derives its corner from that
   * surface. Use it wherever the scroller is edge-to-edge in a rounded box (a
   * card, a dialog body) — a rectangle inside a 24px smoothed corner cuts
   * across it. Leave unset for a genuinely square-cornered viewport.
   */
  focusRadius?: RadiusToken;
  /**
   * The scroller sits on `surface-inverse` (an OCPP frame body, a code block
   * on the dark card). The thumb is a black alpha and lands on black there, so
   * it takes the inverse ink step instead — the same reason `fill-inverse-*`
   * and `ink-inverse-*` exist.
   */
  inverse?: boolean;
}

const {
  orientation = "vertical",
  label,
  viewportAttrs,
  rootClass,
  viewportClass,
  scrollbarClass,
  thumbClass,
  focusRadius,
  inverse = false,
} = defineProps<Props>();

const rekaViewport = useTemplateRef<InstanceType<typeof ScrollAreaViewport>>("viewportRef");
const viewport = computed<HTMLElement | null>(() => rekaViewport.value?.viewportElement ?? null);
/** Reka renders the content primitive as the viewport's only child. */
const content = computed<HTMLElement | null>(
  () => (viewport.value?.firstElementChild as HTMLElement | null) ?? null,
);

defineExpose({ viewport });

/*
 * Reka's viewport scrolls only on an axis a scrollbar has enabled, and the
 * scrollbar enables it after the viewport has been drawn. So the server's page,
 * and the render that hydrates it, would hold a viewport that clips its content
 * and cannot scroll: the whole page, where the page scrolls in one. Until the
 * area has mounted, the viewport scrolls on its own axis, and a horizontal one
 * lets its content keep its width, as Reka does once the scrollbar is there.
 */
const mounted = useMounted();

/*
 * The viewport is a tab stop only when it has to be.
 *
 * Reka hardcodes `tabindex="0"` on the viewport — `mergeProps(…, $attrs,
 * { tabindex: 0 })`, last, so no attribute can override it — and it does so
 * unconditionally. Browsers do the same thing with a condition attached: a
 * scroll container becomes keyboard-focusable *only if it contains no
 * keyboard-focusable children* (Chrome 127 and later; Firefox for far longer).
 * That condition is the whole point. Tabbing to a link inside a scroller
 * already scrolls it into view, so a stop in front of it is a stop that does
 * nothing, and the sidebar — thirty links in a scroller — drew a full-height
 * focus ring for it on the first Tab of every session.
 *
 * axe's `scrollable-region-focusable` (WCAG 2.1.1) states the rule the same
 * way: a scrollable region must be reachable *unless* its content already is.
 * So the stop is worth having on exactly one shape — overflowing content with
 * nothing focusable in it — and is noise on the other three.
 *
 * The visibility test errs on the safe side deliberately. A hidden focusable
 * would otherwise remove a stop that is genuinely needed, which is a keyboard
 * trap; a redundant stop is only untidy.
 */
const FOCUSABLE_SELECTOR = [
  "a[href]",
  "area[href]",
  "button:not([disabled])",
  "input:not([disabled])",
  "select:not([disabled])",
  "textarea:not([disabled])",
  "iframe",
  "audio[controls]",
  "video[controls]",
  '[contenteditable]:not([contenteditable="false"])',
  '[tabindex]:not([tabindex^="-"])',
].join(",");

const hasReachableContent = (el: HTMLElement) => {
  // The first match settles it on any page with a control on it, which is the
  // common case and the only one worth a full `querySelectorAll` per frame.
  const first = el.querySelector<HTMLElement>(FOCUSABLE_SELECTOR);
  if (!first) return false;
  if (first.checkVisibility?.() ?? true) return true;
  for (const candidate of el.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR)) {
    if (candidate.checkVisibility?.() ?? true) return true;
  }
  return false;
};

const isTabStop = ref(false);

const syncTabStop = () => {
  const el = viewport.value;
  if (!el) return;
  const overflows = el.scrollHeight > el.clientHeight || el.scrollWidth > el.clientWidth;
  isTabStop.value = overflows && !hasReachableContent(el);
  /*
   * `-1`, never `removeAttribute`: a viewport that is focused when its last
   * row lands keeps the focus instead of dropping it on `<body>`, and scroll
   * restoration can still call `.focus()` on it.
   */
  el.tabIndex = isTabStop.value ? 0 : -1;
};

/*
 * Both halves of that test move with the content, so both are watched: the
 * overflow with a resize, the reachable content with a mutation. The mutation
 * observer is subtree-wide — the main viewport wraps the whole page — so the
 * work is deferred to a frame and coalesced. `querySelectorAll` stops being a
 * full walk as soon as a page has a control on it, which is the common case.
 */
let scheduled = 0;
const scheduleSync = () => {
  if (scheduled) return;
  scheduled = requestAnimationFrame(() => {
    scheduled = 0;
    syncTabStop();
  });
};

onMounted(syncTabStop);
onBeforeUnmount(() => scheduled && cancelAnimationFrame(scheduled));
useResizeObserver(viewport, scheduleSync);
useResizeObserver(content, scheduleSync);
useMutationObserver(content, scheduleSync, { childList: true, subtree: true });

/*
 * Focus is indicated twice, and the scrollbar is the half that means
 * something: it is already the affordance for "this scrolls", so pinning it
 * visible at its hover width says the keys will now move this box. Reka's
 * `hover` type mounts the scrollbar on pointer enter; `force-mount` bypasses
 * that without touching the overflow gate below it (`ScrollAreaScrollbarHover`
 * does not forward the prop to `…Auto`), so a viewport whose content fits
 * still shows nothing.
 */
const focusVisible = ref(false);
const syncFocusVisible = () => {
  focusVisible.value = viewport.value?.matches(":focus-visible") ?? false;
};
useEventListener(viewport, "focus", syncFocusVisible);
useEventListener(viewport, "blur", () => {
  focusVisible.value = false;
});
/*
 * `:focus-visible` is not settled by the time `focus` fires. A viewport that is
 * not a tab stop still takes the focus when the operator clicks the page — a
 * click lands on the nearest focusable ancestor and `tabindex="-1"` is one —
 * and Chromium then raises the flag on the *first keypress*, which for a
 * scroller is the operator reaching for PageDown. So the state is re-read on
 * keydown, where the flag is already up (checked in Chromium: the keydown
 * handler sees it true, with no frame to wait for).
 *
 * Before this the two halves fired on opposite cases. The ring is pure CSS and
 * followed the keypress; the scrollbar was pinned from a `focus` event that had
 * already passed. Click the canvas, press PageDown, and the portal drew a
 * full-page rectangle and no scrollbar — precisely the wrong half.
 */
useEventListener(viewport, "keydown", syncFocusVisible);

/*
 * The ring answers a tab stop, so it is drawn only where there is one. The
 * incidental focus above is not a keyboard user arriving at this box: they
 * clicked into it, they know where they are, and there is nothing here to
 * operate. At the scale of the page scroller, ringing it to say so reads as a
 * rectangle drawn over the whole app rather than as focus. The scrollbar still
 * pins, which is the honest half — it is already the affordance for "this
 * scrolls", so widening it says the keys will now move this box without
 * claiming a stop that does not exist.
 */
const ringVisible = computed(() => focusVisible.value && isTabStop.value);
</script>

<template>
  <ScrollAreaRoot :class="cn('size-full min-h-0 min-w-0 overflow-hidden', rootClass)">
    <ScrollAreaViewport
      ref="viewportRef"
      v-bind="viewportAttrs"
      :role="label ? 'region' : undefined"
      :aria-label="label"
      :class="
        cn(
          'size-full',
          !focusRadius && isTabStop ? 'focus-ring-inset' : 'outline-none',
          !mounted &&
            (orientation === 'vertical'
              ? '!overflow-y-auto'
              : '!overflow-x-auto [&>div]:!min-w-fit'),
          viewportClass,
        )
      ">
      <slot />
    </ScrollAreaViewport>
    <!-- Reka measures track padding for both proportional sizing and dragging.
         Keep end gutters here so the thumb stops before a surface's corners. -->
    <ScrollAreaScrollbar
      :orientation
      :force-mount="focusVisible"
      :class="
        cn(
          'flex select-none touch-none bg-transparent p-0.5 transition-[width,height] duration-base ease-standard motion-reduce:transition-none data-[orientation=horizontal]:h-2 data-[orientation=horizontal]:flex-col data-[orientation=horizontal]:hover:h-3 data-[orientation=vertical]:w-2 data-[orientation=vertical]:hover:w-3',
          focusVisible &&
            (orientation === 'vertical'
              ? 'data-[orientation=vertical]:w-3'
              : 'data-[orientation=horizontal]:h-3'),
          orientation === 'vertical' ? 'py-2' : 'px-2',
          scrollbarClass,
        )
      ">
      <Pill
        :as="ScrollAreaThumb"
        :surface-class="inverse ? 'bg-ink-inverse-3' : 'bg-ink-4'"
        :class="cn('relative flex-1 cursor-grab active:cursor-grabbing z-10', thumbClass)" />
    </ScrollAreaScrollbar>
    <!-- The ring, where the viewport fills a rounded surface. A stacked
         squircle rather than an outline, for the reason `UI/Input.vue` gives:
         an outline cannot follow a smoothed corner. It is always rendered so
         its corner is measured before it is ever shown, and lands on the next
         frame — decision 11, no fade on a focus stroke. -->
    <Squircle
      v-if="focusRadius"
      data-focus-border
      aria-hidden="true"
      concentric
      :radius="focusRadius"
      :border-width="2"
      :border-color="CONTROL_FOCUS_COLOR"
      :class="
        cn('pointer-events-none absolute inset-0 z-20', ringVisible ? 'opacity-100' : 'opacity-0')
      " />
  </ScrollAreaRoot>
</template>
