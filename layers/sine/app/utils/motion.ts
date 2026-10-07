/**
 * The motion vocabulary, as values rather than as a habit.
 *
 * The portal's timings were already consistent in *feel* — three durations, the
 * CSS easing keywords, and one Apple curve — but every one of them was typed at
 * the call site, so six springs existed where three were meant and the standard
 * curve was spelled out twice in CSS and once as an arbitrary Tailwind value.
 *
 * The same numbers are Tailwind utilities (`duration-fast`, `ease-standard`) via
 * `tailwind.config.ts`; these exports are for `motion-v`, which takes them as
 * JavaScript. Keep the two in step.
 *
 * See `docs/design-system.md` § Motion.
 */

import { useMotionValueEvent, useReducedMotion, useSpring, type MotionValue } from "motion-v";

/** Seconds — what `motion-v` transitions take. */
export const duration = {
  /** Menus, and reveals close enough to a hover to feel like one. */
  fast: 0.1,
  /** Dialogs, tooltips, the default for a discrete change. */
  base: 0.15,
  /** Sheets, and layout shifts the eye has to follow. */
  slow: 0.2,
  /** Height reveals and disclosures, which need longer to read as one motion. */
  reveal: 0.25,
} as const;

/** Milliseconds — what `setTimeout` and CSS take. */
export const durationMs = {
  fast: 100,
  base: 150,
  slow: 200,
  reveal: 250,
} as const;

export const ease = {
  /**
   * Entrances, and anything that slides. Apple's own curve: a fast start that
   * settles without overshoot, which is why the inbox toaster already used it
   * by hand.
   */
  standard: [0.32, 0.72, 0, 1],
  /** Exits. Nothing needs to be readable on the way out. */
  exit: [0.4, 0, 1, 1],
  /**
   * A thing arriving along an arc. `easeOutSine`: the vertical projection of
   * uniform motion round a circle facing the viewer, so a toast rising into
   * place and swelling as it comes moves the way a point on a wheel would —
   * fastest at the bottom of its travel, settling into rest with no snap.
   * Softer at the start than `standard`, which is the point: it reads as
   * travel, not as a slide.
   */
  sine: [0.39, 0.575, 0.565, 1],
} as const satisfies Record<string, [number, number, number, number]>;

/** The same curves as CSS strings, for a `transition` shorthand in a style block. */
export const easeCss = {
  standard: "cubic-bezier(0.32, 0.72, 0, 1)",
  exit: "cubic-bezier(0.4, 0, 1, 1)",
  sine: "cubic-bezier(0.39, 0.575, 0.565, 1)",
} as const;

export interface Spring {
  stiffness: number;
  damping: number;
}

export const spring = {
  /** The default. Interactive feedback that should feel answered, not animated. */
  snappy: { stiffness: 500, damping: 40 },
  /**
   * Tab and segment indicators. Stiffer because the pill is read as *attached*
   * to the label under the pointer — any visible lag reads as a dropped click.
   */
  firm: { stiffness: 900, damping: 60 },
  /**
   * The sidebar's active-link indicator. Effectively instant: it moves on a
   * route change the operator already committed to, so easing it in would only
   * delay the page they asked for.
   */
  rigid: { stiffness: 3000, damping: 110 },
} as const satisfies Record<string, Spring>;

/** `motion-v` transition presets, so a caller states intent rather than numbers. */
export const transition = {
  snappy: { type: "spring", ...spring.snappy },
  firm: { type: "spring", ...spring.firm },
  rigid: { type: "spring", ...spring.rigid },
  fast: { duration: duration.fast, ease: ease.standard },
  base: { duration: duration.base, ease: ease.standard },
  slow: { duration: duration.slow, ease: ease.standard },
  reveal: { duration: duration.reveal, ease: ease.standard },
  /** An arrival along an arc — the toast's rise, and its stack settling around it. */
  arc: { duration: duration.reveal, ease: ease.sine },
  /** A departure. The `dropdown-out` keyframes in JS: `base` long, on the exit curve. */
  exit: { duration: duration.base, ease: ease.exit },
} as const;

/* -------------------------------------------------------------------------- */
/*  Reduced motion                                                            */
/* -------------------------------------------------------------------------- */

/**
 * **Reduced motion is a property of the token, not a decision at the call
 * site.**
 *
 * The system already decided that durations, easings and springs are tokens
 * rather than numbers someone types. Reduced motion is the same kind of fact
 * about the same values, so it belongs here — and a component that reaches for
 * `useMotionTokens()` gets it for nothing.
 *
 * Before this it was re-derived everywhere, four different ways: `motion-v`'s
 * `useReducedMotion()` at 28 sites each computing its own reduced variants, 11
 * hand-written `prefers-reduced-motion` media queries in `<style>` blocks, five
 * `motion-reduce:` Tailwind variants — and 25 of the 49 animating components
 * honouring none of it. A component that hard-codes `{ stiffness: 500, damping:
 * 40 }` *cannot* honour the preference; one that names a token can.
 *
 * **Reduced means instant, not slower.** A 100ms fade is still motion, and the
 * operator asked for none. It still changes state, it just doesn't travel, and
 * that holds for every token.
 */
export const INSTANT = { duration: 0 } as const;

const instantly = <T extends Record<string, unknown>>(values: T, replacement: unknown) =>
  Object.fromEntries(Object.keys(values).map((key) => [key, replacement])) as {
    [K in keyof T]: typeof replacement;
  };

const INSTANT_TRANSITIONS = instantly(transition, INSTANT) as Record<
  keyof typeof transition,
  typeof INSTANT
>;
const INSTANT_DURATION = instantly(duration, 0) as Record<keyof typeof duration, number>;
const INSTANT_DURATION_MS = instantly(durationMs, 0) as Record<keyof typeof durationMs, number>;

/**
 * The preference, as a boolean that is right on the first frame.
 *
 * `motion-v`'s `useReducedMotion()` hands back a ref that can still be `null`
 * when a component reads it — its media-query listener attaches after setup — so
 * anything treating a falsy value as "no preference" animates once before
 * correcting itself. `UI/Tabs.vue`'s badge widths did exactly that under the
 * reduced-motion gate, and `useTabGeometry`'s `Ref<boolean | null>` signature is
 * the fossil of someone meeting this before. A synchronous `matchMedia` read
 * fills the gap; the ref still drives updates when the setting changes.
 */
const useReducedMotionPreference = () => {
  const preference = useReducedMotion();
  return computed(
    () =>
      preference.value ??
      (typeof window !== "undefined" &&
        typeof window.matchMedia === "function" &&
        window.matchMedia("(prefers-reduced-motion: reduce)").matches),
  );
};

/**
 * The motion tokens, already collapsed when the operator has asked for less.
 *
 * ```ts
 * const { transition, durationMs, reduced } = useMotionTokens();
 * ```
 * ```vue
 * <motion.div :transition="transition.snappy" />
 * ```
 *
 * Each is a `computed`, so destructuring at the top of `setup` keeps template
 * auto-unwrapping — `transition.snappy` in a template, `transition.value.snappy`
 * in script. `durationMs` is collapsed too, because a `setTimeout` waiting out
 * an animation that no longer runs is just a delay.
 *
 * `reduced` is there for the cases a token cannot express: a spring that should
 * `jump()` (see `useMotionSpring`), an entrance whose *shape* changes rather
 * than its timing, a `matchMedia` branch in a test.
 */
export const useMotionTokens = () => {
  const reduced = useReducedMotionPreference();

  return {
    reduced,
    transition: computed(() => (reduced.value ? INSTANT_TRANSITIONS : transition)),
    duration: computed(() => (reduced.value ? INSTANT_DURATION : duration)),
    durationMs: computed(() => (reduced.value ? INSTANT_DURATION_MS : durationMs)),
  };
};

/**
 * A component's *own* timing, collapsed under reduced motion.
 *
 * The escape hatch for motion no token describes — a bounce a component tuned
 * for itself, a two-second onboarding entrance. Reach for a token first: this
 * keeps the value at the call site, which is the thing the token layer exists
 * to avoid, and only guarantees the preference is honoured.
 *
 * ```ts
 * const reveal = useMotionTransition({ type: "spring", bounce: 0.15, duration: 0.35 });
 * ```
 *
 * Takes a getter when the timing depends on something reactive.
 */
export const useMotionTransition = <T>(own: T | (() => T)) => {
  const reduced = useReducedMotionPreference();
  return computed(() =>
    reduced.value ? INSTANT : typeof own === "function" ? (own as () => T)() : own,
  );
};

/**
 * A house spring that arrives instantly under reduced motion.
 *
 * A spring has no "instant" configuration — stiffness and damping describe a
 * physical settle, and there is no value of them that means *do not move*. The
 * only way to honour the preference is to stop letting it animate and set the
 * value outright, which is what `UI/Tabs.vue` and `Sidebar/ActiveLinkIndicator`
 * each worked out separately. This is that, once:
 *
 * ```ts
 * const indicatorX = useMotionSpring(targetX, spring.firm);
 * ```
 *
 * The jump rides the source's own change notification rather than a watcher on
 * the spring, so the value lands in the same frame the target does — the lag
 * `UI/Tabs.vue`'s comment describes, which a `ResizeObserver`-driven resize
 * makes visible.
 */
export const useMotionSpring = (source: MotionValue<number>, preset: Spring) => {
  const reduced = useReducedMotionPreference();
  const value = useSpring(source, preset);

  useMotionValueEvent(source, "change", (next) => {
    if (reduced.value) value.jump(next);
  });

  // Also covers the preference being turned on mid-session, and the first frame
  // — where the spring starts at the source's value anyway, so it is a no-op.
  watch(reduced, (isReduced) => isReduced && value.jump(source.get()), { immediate: true });

  return value;
};
