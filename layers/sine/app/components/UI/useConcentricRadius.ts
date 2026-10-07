import {
  computed,
  inject,
  onBeforeUnmount,
  onMounted,
  provide,
  shallowRef,
  watch,
  type ComputedRef,
  type InjectionKey,
  type ShallowRef,
} from "vue";
import {
  concentric,
  toSquircleElement,
  type ConcentricOptions,
  type SquircleElementTarget,
  type SquirclePixelRadii,
} from "./squircleGeometry";

/**
 * The runtime half of `concentric()`: a squircle publishes its own corner and
 * its box, and a nested one derives its radius from both.
 *
 * `concentric()` alone needs the inset written out at the call site, which is
 * only knowable when the padding is a literal on the same element. The common
 * shape in this app is not that — a card in one component holds a row from
 * another (`Settings/Card.vue` and `Settings/Row.vue`), and neither file can
 * see the other's numbers. Measuring the two border boxes is what closes that
 * gap, and it is also what keeps the corner right when the inset is a
 * breakpoint away from the one the author had in mind.
 *
 * There is no CSS equivalent to reach for instead: `border-radius: inherit`
 * copies the container's *value*, not its value less the inset, and nothing
 * exposes an ancestor's radius to a descendant.
 */
export interface SquircleContainer {
  /** The container's own element, once it has mounted. */
  readonly element: ComputedRef<HTMLElement | null>;
  /**
   * Its resolved corner radii in px — after its own concentric pass, so a card
   * holding a row holding a chip derives all three from the card.
   */
  readonly radii: ComputedRef<SquirclePixelRadii>;
}

const SQUIRCLE_CONTAINER = Symbol("squircle-container") as InjectionKey<SquircleContainer>;

/**
 * Publish a squircle as the container its descendants measure against. Vue does
 * not resolve a component's own `provide` in its own `inject`, so a squircle
 * that is itself concentric still reads its parent rather than itself.
 */
export const provideSquircleContainer = (container: SquircleContainer) =>
  provide(SQUIRCLE_CONTAINER, container);

/** Half-pixel precision: enough for a corner, and it keeps subpixel layout from churning. */
const halfPixel = (value: number) => Math.round(value * 2) / 2;

export const useConcentricRadius = (
  host: () => SquircleElementTarget,
  options: () => ConcentricOptions | null,
): Readonly<ShallowRef<SquirclePixelRadii | null>> => {
  const container = inject(SQUIRCLE_CONTAINER, null);
  const resolved = shallowRef<SquirclePixelRadii | null>(null);
  const enabled = computed(options);
  let observer: ResizeObserver | null = null;

  const measure = () => {
    const settings = enabled.value;
    const outerElement = container?.element.value ?? null;
    const innerElement = toSquircleElement(host());
    if (
      !settings ||
      !container ||
      !outerElement ||
      !innerElement ||
      outerElement === innerElement
    ) {
      resolved.value = null;
      return;
    }

    const outer = outerElement.getBoundingClientRect();
    const inner = innerElement.getBoundingClientRect();
    if (outer.width <= 0 || outer.height <= 0 || inner.width <= 0 || inner.height <= 0) {
      resolved.value = null;
      return;
    }

    const derived = concentric(
      container.radii.value,
      [
        halfPixel(inner.top - outer.top),
        halfPixel(outer.right - inner.right),
        halfPixel(outer.bottom - inner.bottom),
        halfPixel(inner.left - outer.left),
      ],
      settings.minimum ?? 0,
    );
    resolved.value = typeof derived === "number" ? [derived, derived, derived, derived] : derived;
  };

  /**
   * Both boxes are observed, because either one moving changes the inset. What
   * this cannot see is a shape displaced inside a container that keeps its own
   * size — rare, since a container that holds its children is sized by them.
   */
  const observe = () => {
    observer?.disconnect();
    measure();

    const outerElement = container?.element.value ?? null;
    const innerElement = toSquircleElement(host());
    if (!enabled.value || !outerElement || !innerElement) return;
    if (typeof ResizeObserver === "undefined") return;

    observer ??= new ResizeObserver(measure);
    observer.observe(outerElement);
    observer.observe(innerElement);
  };

  onMounted(observe);
  watch([enabled, () => container?.element.value, () => toSquircleElement(host())], observe, {
    flush: "post",
  });
  watch(() => container?.radii.value, measure, { flush: "post" });
  onBeforeUnmount(() => {
    observer?.disconnect();
    observer = null;
  });

  return resolved;
};
