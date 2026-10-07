<script setup lang="ts">
import { Squircle, type SquircleTip } from "../../utils/squircle";
import { useEventListener, useResizeObserver } from "@vueuse/core";
import { AnimatePresence, motion } from "motion-v";
import { normalizeStyle, type StyleValue } from "vue";
import { useMotionTokens } from "../../utils/motion";

const VIEWPORT_PADDING = 8;
const TRIGGER_GAP = 8;
const ARROW_PADDING = 8;
const TIP_HEIGHT = 4;
const MOTION_DISTANCE = 5;
const TRIGGER_SELECTOR =
  "button, a[href], input, select, textarea, [role='button'], [tabindex]:not([tabindex='-1'])";

type Side = "top" | "right" | "bottom" | "left";

const DEFAULT_SIDES: Side[] = ["top", "bottom", "right", "left"];

interface PopoverPosition {
  left: number;
  top: number;
  side: Side;
  arrowOffset: number;
}

interface Props {
  text?: string;
  /**
   * The side to try first, when the caller knows something the fit test
   * cannot.
   *
   * The default order puts the tooltip above its trigger wherever there is
   * room, which is right for a control with space around it and wrong for a
   * dense column of them: the collapsed navigation rail's rows sit 44px apart,
   * so a tooltip above one covers the row before it — and in that rail the
   * tooltip *is* the label, so it would be hiding the very thing the pointer
   * is reading. The fit test still has the last word; this only reorders what
   * it tries.
   */
  prefer?: Side;
  /**
   * Read the tooltip aloud when it opens.
   *
   * Off by default, because a screen reader already has the text by another
   * route in most mounts: `IconButton`'s tooltip is its `aria-label`, and
   * `HelpPopover`'s is its trigger's `aria-describedby` — both announced on
   * focus, so a live region here reads the same sentence a second time. It is
   * also the less reliable of the two channels: a live region has to exist
   * before its content changes, and this element mounts already holding its
   * text, which some readers announce and others skip.
   *
   * Turn it on for a tooltip that only a pointer opens. A screen-reader user
   * driving a mouse — low vision, most often — never focuses the control, so
   * the live region is the one way the label reaches them.
   */
  announce?: boolean;
  /**
   * Appear with no entrance. For a tooltip that opens in the wake of another,
   * as `useTooltipTrigger` hands a pointer from one control's name to the
   * next: a fade and a rise on every button of a toolbar reads as flicker.
   */
  instant?: boolean;
}

const { text = "", prefer, announce = false, instant = false } = defineProps<Props>();

defineOptions({ inheritAttrs: false });

const attrs = useAttrs();
const model = defineModel<boolean>({ required: true });
const triggerAnchor = useTemplateRef<HTMLElement>("trigger-anchor");
const popoverBody = useTemplateRef<HTMLElement>("popover-body");
const label = useTemplateRef<HTMLElement>("label");
const triggerElement = shallowRef<HTMLElement | null>(null);
const position = shallowReactive<PopoverPosition>({
  left: VIEWPORT_PADDING,
  top: VIEWPORT_PADDING,
  side: "top",
  arrowOffset: ARROW_PADDING,
});

let positionFrame: number | undefined;

/**
 * The tip is the squircle's own, on the side that faces the trigger and aimed
 * at the trigger's middle, so the surface's shadow is cast by the tip as well
 * and one outline carries both.
 */
const TIP_SIDE = { top: "bottom", right: "left", bottom: "top", left: "right" } as const;
const tip = computed<SquircleTip>(() => ({
  side: TIP_SIDE[position.side],
  at: position.arrowOffset,
  width: 2 * TIP_HEIGHT,
  height: TIP_HEIGHT,
}));

const forwardedAttrs = computed(() => {
  const { class: _class, style: _style, ...rest } = attrs;
  return rest;
});

const popoverStyle = computed(() => {
  const positionedStyle = {
    left: `${position.left}px`,
    top: `${position.top}px`,
    transformOrigin:
      position.side === "top"
        ? `${position.arrowOffset}px bottom`
        : position.side === "bottom"
          ? `${position.arrowOffset}px top`
          : position.side === "left"
            ? `right ${position.arrowOffset}px`
            : `left ${position.arrowOffset}px`,
  };
  const normalizedStyle = normalizeStyle([attrs.style as StyleValue, positionedStyle]);

  return typeof normalizedStyle === "string" ? positionedStyle : normalizedStyle;
});

/**
 * The tooltip's timing comes from the tokens, so reduced motion collapses it
 * without this component knowing how — see `utils/motion.ts` § Reduced motion.
 * `reduced` is read once more here because the *shape* changes too, not only the
 * duration: the travel is what a reduced-motion reader asked not to see, so the
 * tooltip appears where it will rest rather than sliding the last 5px into it.
 */
const { transition, reduced } = useMotionTokens();

const offsetFor = (side: string, sign: number) => ({
  x: side === "left" ? MOTION_DISTANCE * sign : side === "right" ? -MOTION_DISTANCE * sign : 0,
  y: side === "top" ? MOTION_DISTANCE * sign : side === "bottom" ? -MOTION_DISTANCE * sign : 0,
});

const initialMotion = computed(() => ({
  opacity: 0,
  scale: reduced.value ? 1 : 0.95,
  ...(reduced.value ? { x: 0, y: 0 } : offsetFor(position.side, 1)),
}));

const exitMotion = computed(() => ({
  opacity: 0,
  scale: reduced.value ? 1 : 0.95,
  ...(reduced.value ? { x: 0, y: 0 } : offsetFor(position.side, -1)),
  transition: transition.value.exit,
}));

const clamp = (value: number, minimum: number, maximum: number) =>
  Math.min(Math.max(value, minimum), Math.max(minimum, maximum));

const resolveTrigger = () => {
  const anchor = triggerAnchor.value;
  if (!anchor) return null;

  const parent = anchor.parentElement;
  if (!parent) return null;
  if (parent.matches(TRIGGER_SELECTOR)) return parent;

  const directTrigger = Array.from(parent.children).find(
    (child): child is HTMLElement =>
      child instanceof HTMLElement && child.matches(TRIGGER_SELECTOR),
  );
  if (directTrigger) return directTrigger;

  return anchor.closest<HTMLElement>(TRIGGER_SELECTOR) ?? parent;
};

const updatePosition = () => {
  const trigger = triggerElement.value;
  const body = popoverBody.value;
  if (!model.value || !trigger || !body) return;

  const triggerRect = trigger.getBoundingClientRect();
  const width = body.offsetWidth;
  const height = body.offsetHeight;
  const viewportRight = window.innerWidth - VIEWPORT_PADDING;
  const viewportBottom = window.innerHeight - VIEWPORT_PADDING;
  // The tooltip is centered on its trigger and stays there: it names the
  // control, not the place on it the pointer happens to be, and a label that
  // holds still is the one that can be read. Only the viewport moves it off
  // centre, and the tip keeps to the trigger's middle when it does.
  const middle = {
    x: triggerRect.left + triggerRect.width / 2,
    y: triggerRect.top + triggerRect.height / 2,
  };

  const available: Record<Side, number> = {
    top: triggerRect.top - VIEWPORT_PADDING - TRIGGER_GAP,
    right: viewportRight - triggerRect.right - TRIGGER_GAP,
    bottom: viewportBottom - triggerRect.bottom - TRIGGER_GAP,
    left: triggerRect.left - VIEWPORT_PADDING - TRIGGER_GAP,
  };
  const required: Record<Side, number> = { top: height, right: width, bottom: height, left: width };
  const preferredSides: Side[] = prefer
    ? [prefer, ...DEFAULT_SIDES.filter((candidate) => candidate !== prefer)]
    : DEFAULT_SIDES;
  const side =
    preferredSides.find((candidate) => available[candidate] >= required[candidate]) ??
    preferredSides.reduce((best, candidate) =>
      available[candidate] / required[candidate] > available[best] / required[best]
        ? candidate
        : best,
    );

  let left = middle.x - width / 2;
  let top = middle.y - height / 2;

  if (side === "top") top = triggerRect.top - TRIGGER_GAP - height;
  if (side === "right") left = triggerRect.right + TRIGGER_GAP;
  if (side === "bottom") top = triggerRect.bottom + TRIGGER_GAP;
  if (side === "left") left = triggerRect.left - TRIGGER_GAP - width;

  left = clamp(left, VIEWPORT_PADDING, viewportRight - width);
  top = clamp(top, VIEWPORT_PADDING, viewportBottom - height);

  position.left = left;
  position.top = top;
  position.side = side;
  position.arrowOffset =
    side === "top" || side === "bottom"
      ? clamp(middle.x - left, ARROW_PADDING, width - ARROW_PADDING)
      : clamp(middle.y - top, ARROW_PADDING, height - ARROW_PADDING);
};

/**
 * A block of wrapped text is as wide as its measure, not as its longest line,
 * so a name that wraps would sit in a box with room to spare either side. The
 * lines are measured once they are laid out and the label is set to the widest,
 * which leaves the balanced lines as they are and brings the surface in to
 * them. A range is measured as drawn, and the entrance draws the tooltip at
 * 95%, so the scale is taken back out.
 */
const fitLabel = () => {
  const element = label.value;
  if (!element) return;
  element.style.width = "";

  const range = document.createRange();
  range.selectNodeContents(element);
  const lines = Array.from(range.getClientRects());
  if (lines.length < 2 || !element.offsetWidth) return;

  const scale = element.getBoundingClientRect().width / element.offsetWidth || 1;
  const widest = Math.max(...lines.map((line) => line.width)) / scale;
  element.style.width = `${Math.ceil(widest)}px`;
};

const schedulePositionUpdate = () => {
  if (!model.value || positionFrame !== undefined) return;

  positionFrame = window.requestAnimationFrame(() => {
    positionFrame = undefined;
    updatePosition();
  });
};

watch(
  model,
  async (isOpen) => {
    if (!isOpen) return;

    triggerElement.value = resolveTrigger();
    await nextTick();
    fitLabel();
    updatePosition();
  },
  { immediate: true },
);

// A name that changes while it shows, "Copied", is measured again; the
// surface's own resize then moves the tooltip.
watch(
  () => text,
  async () => {
    if (!model.value) return;
    await nextTick();
    fitLabel();
  },
);

onMounted(() => {
  triggerElement.value = resolveTrigger();
  schedulePositionUpdate();
});

useEventListener("resize", schedulePositionUpdate);
useEventListener("scroll", schedulePositionUpdate, { capture: true, passive: true });
useResizeObserver(triggerElement, schedulePositionUpdate);
useResizeObserver(popoverBody, schedulePositionUpdate);

onBeforeUnmount(() => {
  if (positionFrame !== undefined) window.cancelAnimationFrame(positionFrame);
});
</script>

<template>
  <span ref="trigger-anchor" hidden aria-hidden="true" />

  <!-- In the browser only: a tooltip opens from a pointer or focus, which a page
       doesn't have before it hydrates. The empty fallback keeps the server's
       markup free of a placeholder element inside the trigger. -->
  <ClientOnly>
    <Teleport to="body">
      <AnimatePresence>
        <motion.div
          v-if="model"
          v-bind="forwardedAttrs"
          key="tooltip"
          role="tooltip"
          :aria-live="announce ? 'polite' : undefined"
          :class="['pointer-events-none fixed z-tooltip', attrs.class]"
          :style="popoverStyle"
          :initial="instant ? false : initialMotion"
          :animate="{ opacity: 1, x: 0, y: 0, scale: 1 }"
          :exit="exitMotion"
          :transition="transition.base">
          <div ref="popover-body">
            <Squircle
              radius="md"
              shadow="md"
              :tip
              surface-class="bg-surface-inverse"
              class="relative w-max max-w-[calc(100vw-1rem)] break-words text-balance whitespace-normal px-2 py-1 text-xs text-ink-inverse">
              <!-- A clamp, not a scroller: the tooltip takes no pointer, so
                 nothing could work a scrollbar here. It only keeps a tooltip
                 taller than the screen from being cut off entirely. -->
              <span class="block max-h-[calc(100dvh-1.5rem)] overflow-y-auto">
                <!-- A name wraps at 15rem and centers, so a long one stays a
                     label over its control rather than a line across the page.
                     Slotted content sets its own measure. -->
                <slot>
                  <span ref="label" class="block max-w-60 text-center">{{ text }}</span>
                </slot>
              </span>
            </Squircle>
          </div>
        </motion.div>
      </AnimatePresence>
    </Teleport>
    <template #fallback />
  </ClientOnly>
</template>
