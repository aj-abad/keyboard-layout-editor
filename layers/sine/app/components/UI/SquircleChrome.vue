<script setup lang="ts">
import {
  computed,
  onBeforeUnmount,
  onMounted,
  ref,
  shallowRef,
  toValue,
  watch,
  type ComponentPublicInstance,
  type MaybeRefOrGetter,
  type Ref,
  type ShallowRef,
} from "vue";
import {
  DEFAULT_SQUIRCLE_RADIUS,
  fitSquircleTip,
  offsetSquircleRadius as offsetRadius,
  offsetSquircleTip,
  radiiToPx,
  squirclePath,
  toSquircleElement as toElement,
  type MotionValueLike,
  type SquircleAppearance,
  type SquircleBorderSideColors,
  type SquircleBorderSideStyle,
  type SquircleBorderSideStyles,
  type SquircleBorderSideWidths,
  type SquircleBorderStyle,
  type SquircleCut,
  type SquircleGlass,
  type SquirclePathRadius,
  type SquircleShadowLayer,
  type SquircleShadowPreset,
  type SquircleTip,
  type SquircleVisualValue,
} from "./squircleGeometry";
import GlassRimFilter from "./GlassRimFilter.vue";
import {
  glass as glassLevels,
  glassEdge,
  glassRimFade,
  line,
  shadowLayers as elevationShadowLayers,
} from "../../../tailwind.config";

type ElementTarget = HTMLElement | ComponentPublicInstance | null | undefined;
type BorderSides<T> = readonly [T, T, T, T];

interface SquircleChromeProps {
  readonly host?: ElementTarget;
  readonly clipId: string;
  readonly appearance?: SquircleAppearance;
  readonly surfaceClass?: string;
  readonly surfaceCut?: SquircleCut | null;
  readonly tip?: SquircleTip | null;
  readonly glass?: SquircleGlass;
  readonly shadow?: SquircleShadowPreset | readonly SquircleShadowLayer[] | null;
  readonly highlight?: boolean | string;
  readonly borderStyle?: SquircleBorderStyle | SquircleBorderSideStyles;
  readonly rightInset?: SquircleVisualValue<number>;
}

interface Pad {
  top: number;
  right: number;
  bottom: number;
  left: number;
}

interface SquircleStroke {
  readonly d: string;
  readonly color: string;
  readonly width: number;
  readonly dasharray?: string;
  readonly linecap?: "butt" | "round";
  readonly clipPath?: string;
  readonly clipSides?: readonly number[];
  readonly mask?: string;
  /** Glass's own keyline, which Increase Contrast redraws in `line-strong`. */
  readonly keyline?: boolean;
}

const props = withDefaults(defineProps<SquircleChromeProps>(), {
  appearance: () => ({}),
  highlight: undefined,
  borderStyle: "solid",
  rightInset: 0,
});

const emit = defineEmits<{ measuredChange: [measured: boolean] }>();

/** The same layered elevation records that generate Tailwind's `shadow-*` utilities. */
const SHADOW_PRESETS: Record<SquircleShadowPreset, readonly SquircleShadowLayer[]> =
  elevationShadowLayers;

const classNames = (...values: (string | false | null | undefined)[]) =>
  values.filter(Boolean).join(" ");

const useElementSize = (
  target: MaybeRefOrGetter<ElementTarget>,
): { width: Ref<number>; height: Ref<number> } => {
  const width = ref(0);
  const height = ref(0);
  let observer: ResizeObserver | null = null;

  const measure = (element: HTMLElement) => {
    const rect = element.getBoundingClientRect();
    width.value = rect.width;
    height.value = rect.height;
  };

  const observe = () => {
    observer?.disconnect();
    const element = toElement(toValue(target));
    if (!element) {
      width.value = 0;
      height.value = 0;
      return;
    }

    measure(element);
    if (typeof ResizeObserver === "undefined") return;
    observer ??= new ResizeObserver((entries) => {
      const box = entries[0]?.borderBoxSize?.[0];
      if (box) {
        width.value = box.inlineSize;
        height.value = box.blockSize;
      } else {
        measure(element);
      }
    });
    observer.observe(element);
  };

  onMounted(observe);
  watch(() => toValue(target), observe, { flush: "post" });
  onBeforeUnmount(() => {
    observer?.disconnect();
    observer = null;
  });

  return { width, height };
};

const isMotionValueLike = <T,>(value: unknown): value is MotionValueLike<T> => {
  if (typeof value !== "object" || value === null) return false;
  const candidate = value as Partial<MotionValueLike<T>>;
  return typeof candidate.get === "function" && typeof candidate.on === "function";
};

const readVisualValue = <T,>(source: SquircleVisualValue<T> | undefined, fallback: T): T => {
  if (source === undefined) return fallback;
  return isMotionValueLike<T>(source) ? source.get() : source;
};

const useVisualValue = <T,>(
  source: () => SquircleVisualValue<T> | undefined,
  fallback: T,
): Readonly<ShallowRef<T>> => {
  const current = shallowRef(fallback) as ShallowRef<T>;
  let mounted = false;
  let unsubscribe: (() => void) | undefined;

  const sync = (next: SquircleVisualValue<T> | undefined) => {
    unsubscribe?.();
    unsubscribe = undefined;
    current.value = readVisualValue(next, fallback);
    if (mounted && isMotionValueLike<T>(next)) {
      unsubscribe = next.on("change", (value) => {
        current.value = value;
      });
    }
  };

  watch(source, sync, { immediate: true, flush: "sync" });
  onMounted(() => {
    mounted = true;
    sync(source());
  });
  onBeforeUnmount(() => {
    mounted = false;
    unsubscribe?.();
  });

  return current;
};

const clipId = props.clipId;
const tipClipId = `${clipId}-tip`;
const cutId = `${clipId}-cut`;
const knockoutId = `${clipId}-knockout`;
const wellId = `${clipId}-well`;
const rimId = `${clipId}-rim`;
const maskId = `${clipId}-mask`;
const borderMaskId = `${clipId}-border-mask`;
const borderSides = ["top", "right", "bottom", "left"] as const;
const borderClipIds = borderSides.map((side) => `${clipId}-border-${side}`);

const { width, height } = useElementSize(() => props.host);
const rightInset = useVisualValue(() => props.rightInset, 0);
const visibleWidth = computed(() => Math.max(0, width.value - Math.max(0, rightInset.value)));
const measured = computed(() => visibleWidth.value > 0 && height.value > 0);
watch(measured, (value) => emit("measuredChange", value), { immediate: true });

const radius = useVisualValue(() => props.appearance.radius, DEFAULT_SQUIRCLE_RADIUS);
const borderWidth = useVisualValue<number | SquircleBorderSideWidths>(
  () => props.appearance.borderWidth,
  0,
);
const borderColor = useVisualValue<string | SquircleBorderSideColors>(
  () => props.appearance.borderColor,
  line.DEFAULT,
);
const resolvedBorderColor = computed(() =>
  props.appearance.borderColor === undefined && props.glass ? glassEdge.shade : borderColor.value,
);

const shape = (
  w: number,
  h: number,
  shapeRadius: SquirclePathRadius,
  x = 0,
  y = 0,
  shapeTip?: SquircleTip,
) => squirclePath({ width: w, height: h, radius: shapeRadius, x, y, tip: shapeTip });

const radiusPx = computed(() => radiiToPx(radius.value));
/** The box's own outline, with no tip: what the content is clipped to. */
const surfacePath = computed(() => shape(visibleWidth.value, height.value, radiusPx.value));
/** The box's outline moved `inset` px in on a concentric corner, with the box's corner at `(x, y)`: where a cut runs. */
const insetPath = (inset: number, x = 0, y = 0) =>
  shape(
    visibleWidth.value - 2 * inset,
    height.value - 2 * inset,
    offsetRadius(radiusPx.value, -inset),
    x + inset,
    y + inset,
  );

/**
 * The tip, placed once on the box's own outline. Every layer that draws round
 * it moves this one tip with its outline (`outline`), so the fill, the strokes,
 * the rim and the shadows agree where it stands and run parallel round it.
 */
const tip = computed(() =>
  props.tip && visibleWidth.value > 0 && height.value > 0
    ? fitSquircleTip({
        width: visibleWidth.value,
        height: height.value,
        radius: radiusPx.value,
        tip: props.tip,
      })
    : undefined,
);

const NO_PAD: Pad = { top: 0, right: 0, bottom: 0, left: 0 };

/**
 * How far the layers that paint the tip reach past the box, on the tip's side:
 * its height and a pixel more. The tip is outside the squircle's box, as a cast
 * shadow is. The pixel keeps its point off the edge of the surface it is painted
 * in: a surface that ends exactly where the point does loses the point's last
 * fraction of a pixel wherever the box sits between pixels, and a rounded point
 * is drawn flat.
 */
const TIP_SLACK = 1;
const overhang = computed<Pad>(() =>
  tip.value ? { ...NO_PAD, [tip.value.side]: Math.ceil(tip.value.height) + TIP_SLACK } : NO_PAD,
);
const overhung = (pad: Pad): Pad => {
  const over = overhang.value;
  return {
    top: pad.top + over.top,
    right: pad.right + over.right,
    bottom: pad.bottom + over.bottom,
    left: pad.left + over.left,
  };
};

/**
 * The whole outline, tip and all, moved `offset` px out on a concentric corner
 * (in, when negative), drawn with the box's own corner at `(x, y)`: the fill at
 * 0, a stroke half its width in, a shadow its spread out.
 */
const outline = (offset = 0, x = 0, y = 0) =>
  shape(
    visibleWidth.value + 2 * offset,
    height.value + 2 * offset,
    offsetRadius(radiusPx.value, offset),
    x - offset,
    y - offset,
    tip.value && offsetSquircleTip(tip.value, offset),
  );

/**
 * What the fill is clipped to. With a tip the surface reaches past the box to
 * paint it, so its outline is drawn in that larger box and normalized to it;
 * with none it is the box's own.
 */
const fillPath = computed(() =>
  tip.value ? outline(0, overhang.value.left, overhang.value.top) : surfacePath.value,
);
const fillPathTransform = computed(() => {
  if (!measured.value) return undefined;
  const over = overhang.value;
  return `scale(${1 / (width.value + over.left + over.right)} ${1 / (height.value + over.top + over.bottom)})`;
});
/**
 * The clip is declared in `objectBoundingBox` units, so its coordinates are
 * fractions of whatever box it is applied to and the browser refits it at
 * layout time. An absolute-pixel `userSpaceOnUse` path has to be rewritten from
 * a `ResizeObserver` before the next paint instead, and Chromium does not
 * reliably repaint the elements referencing it: a grown element keeps its
 * pre-resize extent and is cropped to it. CSS `path()` is pixel-based for the
 * same reason and additionally miscomposites `backdrop-filter`, so the SVG URL
 * clip stays. Don't switch either back.
 *
 * The path is still built in pixels — a squircle's corner is an absolute radius
 * rather than a fraction of its box, so it has to be solved at the measured
 * size — and is normalized to the unit box here. The divisor is the *full*
 * measured width, not `visibleWidth`: the reference box is the target's own
 * border box, so a path spanning `visibleWidth` has to end up at that fraction
 * of it. Dividing by `visibleWidth` would stretch the shape back over the whole
 * box and silently drop `rightInset`.
 */
const surfacePathTransform = computed(() =>
  measured.value ? `scale(${1 / width.value} ${1 / height.value})` : undefined,
);

/**
 * `surfaceCut`, as the fill's own clip: the outline and the band's two edges,
 * filled even-odd, so the band between them is open and whatever is behind the
 * shape shows through. It is a second clip rather than a change to the first,
 * because `clipContent` clips the content layer with `clipId` too, and the cut
 * belongs to the fill alone.
 */
const cutPath = computed(() => {
  const cut = props.surfaceCut;
  if (!cut || !fillPath.value) return "";
  const { left, top } = overhang.value;
  const outer = insetPath(cut.inset, left, top);
  const inner = insetPath(cut.inset + cut.width, left, top);
  return outer && inner ? `${fillPath.value} ${outer} ${inner}` : "";
});

const radiusCss = computed(() =>
  typeof radiusPx.value === "number"
    ? `${radiusPx.value}px`
    : radiusPx.value.map((corner) => `${corner}px`).join(" "),
);

const wantsHighlight = computed(() =>
  props.highlight === undefined ? Boolean(props.glass) : Boolean(props.highlight),
);
/**
 * The glass edge is light rather than a line: `GlassRimFilter` lights the
 * outline from `lighting`'s distant light, and the surface adds it to its own
 * paint. It is as wide as the level is thick, the default level's on a
 * squircle lit without glass. A highlight given as a colour is still a line,
 * one pixel inside the border.
 */
const rim = computed(() => wantsHighlight.value && typeof props.highlight !== "string");
const rimWidth = computed(() => glassLevels[props.glass ?? "md"].rim);
/** The flat face the rim's light is cut from: the outline moved the rim's width in, concentric. */
const rimFacePath = computed(() => (rim.value ? outline(-rimWidth.value) : ""));
/** The outline the rim lights, the tip's edges with it. */
const rimPath = computed(() => (rim.value ? outline() : ""));
/**
 * The rim is drawn in the box's own coordinates inside a surface that, with a
 * tip, starts before the box: it is moved back onto the box, and let draw the
 * tip outside its own.
 */
const rimStyle = computed(() =>
  tip.value
    ? {
        top: `${overhang.value.top}px`,
        left: `${overhang.value.left}px`,
        overflow: "visible" as const,
      }
    : undefined,
);

/*
 * Content that runs into a glass surface's rim fades out across it
 * (`glassRimFade`), so a row scrolled past the edge of a sheet dissolves into
 * the bevel rather than stopping at a line.
 *
 * The mask goes on each top-level element of the content that reaches into
 * the rim: the clipped layer, with `clipContent`, and otherwise the slot's own
 * elements, such as the scroller the palette runs to its edge. Not on the
 * squircle, where a mask would make it the Backdrop Root of its own glass, and
 * not on content that keeps clear of where the fade shows (`fadeReach`), as a
 * padded menu's rows do, where it would be a layer that changes nothing, and a
 * Backdrop Root for any glass inside it besides. An element that reaches
 * past the surface's box is left alone too: it is there on purpose, an inline
 * popover the squircle does not clip.
 *
 * Each element gets a mask of its own, because a mask is drawn in the box of
 * the element it is on: the surface's outline, moved into that box. It is in
 * `objectBoundingBox` units, as the glass's own mask is, so a box that resizes
 * refits it until the next measurement rather than being cropped to its old
 * size. Outside the outline it is closed: a scroller's box is a rectangle, and
 * across a rounded corner it would show a row's fill past the curve.
 */
const CHROME_CLASSES = [
  "squircle__shadow",
  "squircle__surface",
  "squircle__strokes",
  "squircle__strokes-fallback",
  "squircle__defs",
];

interface ContentFade {
  readonly element: HTMLElement;
  readonly id: string;
  /** The element's box in the surface's layout px. */
  readonly x: number;
  readonly y: number;
  readonly width: number;
  readonly height: number;
}

/** The level's rung of the fade ladder: how deep it runs at the sides (`x`) and the top and bottom (`y`). */
const fadeDepth = computed(() => glassLevels[props.glass ?? "md"].fade);

/**
 * The outline with its sides moved `x` in and its top and bottom `y`. The
 * corner is the outline's less the smaller of the two, which keeps it inside
 * the outline and carries the band round from one depth to the other.
 */
const insetPathXY = (x: number, y: number) =>
  shape(
    visibleWidth.value - 2 * x,
    height.value - 2 * y,
    offsetRadius(radiusPx.value, -Math.min(x, y)),
    x,
    y,
  );

/** The fade's steps, in the surface's own px: each an inset of the outline, and the alpha it lays. */
const fadeSteps = computed(() =>
  props.glass && measured.value
    ? glassRimFade(fadeDepth.value)
        .map(({ x, y, alpha }) => ({ d: insetPathXY(x, y), alpha }))
        .filter((step) => step.d)
    : [],
);

/**
 * How far in from the outline the fade still shows, at the sides and at the
 * top and bottom: the first step that leaves the band 99% whole. Content
 * further in than that would take a mask the eye cannot see, as a padded `md`
 * menu's would, 4px in. On `lg` a list's 4px inset sits inside the band at its
 * top and bottom, and is masked, but clear of it at its sides.
 */
const fadeReach = computed(() => {
  const steps = glassRimFade(fadeDepth.value);
  let shown = 0;
  for (const step of steps) {
    shown += (1 - shown) * step.alpha;
    if (shown >= 0.99) return step;
  }
  return steps.at(-1)!;
});

const fades = shallowRef<readonly ContentFade[]>([]);
const fadeIds = new WeakMap<HTMLElement, string>();
let fadeCount = 0;
const fadeIdOf = (element: HTMLElement) => {
  let id = fadeIds.get(element);
  if (!id) {
    id = `${clipId}-fade-${fadeCount++}`;
    fadeIds.set(element, id);
  }
  return id;
};
const isOwnFade = (element: HTMLElement, mask: string) => mask.includes(`#${fadeIdOf(element)}`);

const hundredth = (value: number) => Math.round(value * 100) / 100;
const sameFades = (a: readonly ContentFade[], b: readonly ContentFade[]) =>
  a.length === b.length &&
  a.every(
    (fade, index) =>
      fade.element === b[index]!.element &&
      fade.x === b[index]!.x &&
      fade.y === b[index]!.y &&
      fade.width === b[index]!.width &&
      fade.height === b[index]!.height,
  );

const syncFades = () => {
  const root = toElement(props.host);
  if (!props.glass || !measured.value || !root || root.offsetWidth <= 0 || root.offsetHeight <= 0) {
    if (fades.value.length) fades.value = [];
    return;
  }
  // Layout px, not the screen's: a menu opening scales its root, and a mask is
  // drawn in the element's untransformed box.
  const box = root.getBoundingClientRect();
  const scaleX = box.width / root.offsetWidth || 1;
  const scaleY = box.height / root.offsetHeight || 1;
  const surfaceWidth = root.offsetWidth;
  const surfaceHeight = root.offsetHeight;
  const outlineWidth = surfaceWidth - Math.max(0, rightInset.value);
  const reach = fadeReach.value;
  const next: ContentFade[] = [];
  for (const element of root.children) {
    if (!(element instanceof HTMLElement)) continue;
    if (CHROME_CLASSES.some((name) => element.classList.contains(name))) continue;
    const rect = element.getBoundingClientRect();
    const x = hundredth((rect.left - box.left) / scaleX);
    const y = hundredth((rect.top - box.top) / scaleY);
    const w = hundredth(rect.width / scaleX);
    const h = hundredth(rect.height / scaleY);
    if (w < 1 || h < 1) continue;
    const inside =
      x > -0.5 && y > -0.5 && x + w < surfaceWidth + 0.5 && y + h < surfaceHeight + 0.5;
    const reaches =
      x < reach.x ||
      outlineWidth - x - w < reach.x ||
      y < reach.y ||
      surfaceHeight - y - h < reach.y;
    if (!inside || !reaches) continue;
    // A mask of the caller's own stays.
    const mask = getComputedStyle(element).maskImage;
    if (mask && mask !== "none" && !isOwnFade(element, mask)) continue;
    next.push({ element, id: fadeIdOf(element), x, y, width: w, height: h });
  }
  if (!sameFades(fades.value, next)) fades.value = next;
};

/*
 * The masks are set on the elements once their `<mask>`s are in the document,
 * and taken off before those go: a `mask-image` naming no mask hides the
 * element outright.
 */
let faded = new Set<HTMLElement>();
const unfade = (element: HTMLElement) => {
  if (isOwnFade(element, element.style.maskImage)) element.style.removeProperty("mask-image");
};
watch(
  fades,
  (next) => {
    const keep = new Set(next.map((fade) => fade.element));
    for (const element of faded) if (!keep.has(element)) unfade(element);
    for (const { element, id } of next) {
      if (!isOwnFade(element, element.style.maskImage)) element.style.maskImage = `url(#${id})`;
    }
    faded = keep;
  },
  { flush: "post" },
);

/*
 * The content's boxes are watched as well as the surface's: a row list that
 * grows inside a sheet of fixed height moves the elements below it without
 * resizing the sheet. The child list is watched for the slot's own changes.
 */
let contentObserver: ResizeObserver | null = null;
let childObserver: MutationObserver | null = null;
const observeContent = () => {
  contentObserver?.disconnect();
  const root = toElement(props.host);
  if (!props.glass || !root || typeof ResizeObserver === "undefined") return;
  contentObserver ??= new ResizeObserver(syncFades);
  for (const element of root.children) {
    if (CHROME_CLASSES.some((name) => element.classList.contains(name))) continue;
    contentObserver.observe(element);
  }
};
const watchContent = () => {
  childObserver?.disconnect();
  observeContent();
  syncFades();
  const root = toElement(props.host);
  if (!props.glass || !root || typeof MutationObserver === "undefined") return;
  childObserver ??= new MutationObserver(() => {
    observeContent();
    syncFades();
  });
  childObserver.observe(root, { childList: true });
};
onMounted(watchContent);
watch([() => props.glass, () => toElement(props.host)], watchContent, { flush: "post" });
watch([measured, visibleWidth, height, fadeDepth], syncFades, { flush: "post" });
onBeforeUnmount(() => {
  contentObserver?.disconnect();
  childObserver?.disconnect();
  for (const element of faded) unfade(element);
  faded = new Set();
});

const surfaceClasses = computed(() =>
  classNames(
    "squircle__surface",
    props.glass && `squircle__surface--glass squircle__surface--glass-${props.glass}`,
    // Before the squircle has measured itself, the rim is the `.glass`
    // classes' own, lit by the document's filter for the level (`--glass-rim`,
    // see `fallbackStroke`).
    rim.value && !measured.value && "squircle__surface--rim",
    props.surfaceClass,
  ),
);
const resolvedShadow = computed<readonly SquircleShadowLayer[]>(() => {
  const spec = props.shadow === undefined && props.glass ? "glass" : props.shadow;
  if (!spec) return [];
  return typeof spec === "string" ? SHADOW_PRESETS[spec] : spec;
});

/*
 * Before the squircle has measured itself, on the server and in the render
 * that hydrates its page, there is no size to solve the SVG layers at. The
 * chrome is drawn in CSS on a rounded rectangle instead, from the same records:
 * the shadows as the surface's `box-shadow` (cast outside it, inset over its
 * fill, as the SVG layers are), and the border and edge by `fallbackStroke`
 * below. The SVG takes over in the render that measures, on the same flag, so
 * the two are never drawn together. A page drawn in the browser alone measures
 * before its first paint and never shows this.
 */
const shadowCss = ({
  x = 0,
  y = 0,
  blur = 0,
  spread = 0,
  color = "rgb(0 0 0 / 0.1)",
  inset,
}: SquircleShadowLayer) => `${inset ? "inset " : ""}${x}px ${y}px ${blur}px ${spread}px ${color}`;

/**
 * Glass takes its shape as a mask rather than the clip: the same path in the
 * same `objectBoundingBox` units, so it refits the same way. Chromium masks a
 * backdrop blur with the element's own mask wherever the element sits, but
 * with its clip only while no ancestor clips with rounded corners. Under one,
 * a rounded scroller or a card with `overflow: hidden`, the ancestor's corner
 * masks the blur and the surface's clip trims the wash alone: the blur runs out
 * to the surface's box, and each corner shows a square of it, bare, outside the
 * curve. A cut in the fill goes into the mask with the outline.
 */
const surfaceStyle = computed(() => {
  // The surface is the one layer the tip is painted in, so it reaches past the
  // box on the tip's side by the tip's height.
  const reach = tip.value
    ? { [tip.value.side]: `${-overhang.value[tip.value.side]}px` }
    : undefined;
  if (surfacePath.value && props.glass) return { ...reach, maskImage: `url(#${maskId})` };
  if (surfacePath.value) {
    const clip = cutPath.value ? cutId : tip.value ? tipClipId : clipId;
    return { ...reach, clipPath: `url(#${clip})` };
  }
  const boxShadow = measured.value ? "" : resolvedShadow.value.map(shadowCss).join(", ");
  return { borderRadius: radiusCss.value, boxShadow: boxShadow || undefined };
});

/**
 * A layer is cast *by* the surface or *onto* it, and the two are drawn on
 * opposite sides of the fill: a cast shadow lands on the ground under the
 * surface, an inset one on the surface's own floor, under its content — the
 * order `box-shadow` paints them in. Each side gets its own SVG so it can sit
 * at its own layer, and both are padded by the blur's reach so a layer's tail
 * is not cut at the SVG's edge.
 */
const castShadow = computed(() => resolvedShadow.value.filter((layer) => !layer.inset));
const insetShadow = computed(() => resolvedShadow.value.filter((layer) => layer.inset));

const castPad = computed<Pad>(() =>
  overhung(
    castShadow.value.reduce<Pad>((pad, { x = 0, y = 0, blur = 0, spread = 0 }) => {
      const reach = 1.5 * blur;
      return {
        top: Math.max(pad.top, Math.ceil(spread - y + reach) + 1),
        right: Math.max(pad.right, Math.ceil(spread + x + reach) + 1),
        bottom: Math.max(pad.bottom, Math.ceil(spread + y + reach) + 1),
        left: Math.max(pad.left, Math.ceil(spread - x + reach) + 1),
      };
    }, NO_PAD),
  ),
);

/**
 * An inset layer is the plane *around* the shape, so its outer edge is the
 * SVG's own and only the blur decides how far past the box that edge has to
 * run: far enough that the blur is saturated where the shape's edge cuts it,
 * or the shade would fade toward the rim it is meant to be darkest at.
 */
const insetPad = computed<Pad>(() =>
  overhung(
    insetShadow.value.reduce<Pad>((pad, { blur = 0 }) => {
      const reach = Math.ceil(1.5 * blur) + 1;
      return {
        top: Math.max(pad.top, reach),
        right: Math.max(pad.right, reach),
        bottom: Math.max(pad.bottom, reach),
        left: Math.max(pad.left, reach),
      };
    }, NO_PAD),
  ),
);

const paddedSize = (pad: Pad) => ({
  width: visibleWidth.value + pad.left + pad.right,
  height: height.value + pad.top + pad.bottom,
});
const castSvgSize = computed(() => paddedSize(castPad.value));
const insetSvgSize = computed(() => paddedSize(insetPad.value));

const castShadowLayers = computed(() => {
  const pad = castPad.value;
  return castShadow.value
    .map(({ x = 0, y = 0, blur = 0, spread = 0, color = "rgb(0 0 0 / 0.1)" }) => ({
      d: outline(spread, pad.left + x, pad.top + y),
      color,
      deviation: blur / 2,
    }))
    .filter((layer) => layer.d);
});

/**
 * The inverse of a cast layer, with `box-shadow: inset`'s own arithmetic: the
 * fill is everything but a hole the shape of the box, and `spread` grows the
 * *hole* where it grew the cast shape — so a negative spread pulls the shade
 * back from the rim by the same amount it pulls a cast layer in under the
 * box. The offset moves the hole down-right, which uncovers the plane along
 * the top and left: the rim's shadow, from the same light.
 */
const insetShadowLayers = computed(() => {
  const pad = insetPad.value;
  const { width: w, height: h } = insetSvgSize.value;
  return insetShadow.value
    .map(({ x = 0, y = 0, blur = 0, spread = 0, color = "rgb(0 0 0 / 0.1)" }) => {
      const hole = outline(-spread, pad.left + x, pad.top + y);
      return {
        d: hole ? `M 0 0 L ${w} 0 L ${w} ${h} L 0 ${h} Z ${hole}` : "",
        color,
        deviation: blur / 2,
      };
    })
    .filter((layer) => layer.d);
});

const knockoutPath = computed(() => {
  const pad = castPad.value;
  const { width: w, height: h } = castSvgSize.value;
  const cutout = outline(0, pad.left, pad.top);
  return `M 0 0 L ${w} 0 L ${w} ${h} L 0 ${h} Z ${cutout}`;
});

/** The outline itself, in the inset SVG's padded space: what an inset layer is clipped to. */
const wellPath = computed(() => {
  const pad = insetPad.value;
  return outline(0, pad.left, pad.top);
});

const isPerSideBorderStyle = (
  style: SquircleBorderStyle | SquircleBorderSideStyles,
): style is SquircleBorderSideStyles => Array.isArray(style);

const asBorderSides = <T,>(value: T | BorderSides<T>): BorderSides<T> => {
  if (Array.isArray(value)) return value as BorderSides<T>;
  return [value as T, value as T, value as T, value as T];
};

const borderSideStyles = computed(() => asBorderSides<SquircleBorderSideStyle>(props.borderStyle));
const isPerSideBorder = computed(
  () =>
    isPerSideBorderStyle(props.borderStyle) ||
    Array.isArray(borderWidth.value) ||
    Array.isArray(borderColor.value),
);
const borderSideWidths = computed<BorderSides<number>>(() => {
  const givenWidths = asBorderSides<number>(borderWidth.value);
  const explicitWidths = Array.isArray(borderWidth.value);
  const fallbackWidth = !explicitWidths && props.glass ? 1 : 0;
  const resolveWidth = (index: number) => {
    if (borderSideStyles.value[index] === "none") return 0;
    return givenWidths[index]! > 0 ? givenWidths[index]! : fallbackWidth;
  };
  return [resolveWidth(0), resolveWidth(1), resolveWidth(2), resolveWidth(3)];
});
const hasUnequalBorderWidths = computed(() =>
  borderSideWidths.value.some((sideWidth) => sideWidth !== borderSideWidths.value[0]),
);

const sameRenderedBorder = (first: number, second: number) => {
  const widths = borderSideWidths.value;
  const styles = borderSideStyles.value;
  const colors = asBorderSides<string>(resolvedBorderColor.value);
  return (
    widths[first]! > 0 &&
    widths[first] === widths[second] &&
    styles[first] !== "none" &&
    styles[first] === styles[second] &&
    colors[first] === colors[second]
  );
};

const innerBorderPath = computed(() => {
  if (!hasUnequalBorderWidths.value) return "";
  const [top, right, bottom, left] = borderSideWidths.value;
  const innerWidth = visibleWidth.value - left - right;
  const innerHeight = height.value - top - bottom;
  if (innerWidth <= 0 || innerHeight <= 0) return "";

  const outerRadii =
    typeof radiusPx.value === "number"
      ? ([radiusPx.value, radiusPx.value, radiusPx.value, radiusPx.value] as const)
      : radiusPx.value;
  const innerRadii = [
    Math.max(0, outerRadii[0] - Math.max(top, left)),
    Math.max(0, outerRadii[1] - Math.max(top, right)),
    Math.max(0, outerRadii[2] - Math.max(bottom, right)),
    Math.max(0, outerRadii[3] - Math.max(bottom, left)),
  ] as const;

  return shape(innerWidth, innerHeight, innerRadii, left, top);
});

const borderClipPoints = computed(() => {
  const w = visibleWidth.value;
  const h = height.value;
  const [top, right, bottom, left] = borderSideWidths.value;
  const horizontalNeighbors = left + right;
  const verticalNeighbors = top + bottom;
  const halfWidth = w / 2;
  const halfHeight = h / 2;

  const topApex =
    horizontalNeighbors > 0
      ? ([(w * left) / horizontalNeighbors, (w * top) / horizontalNeighbors] as const)
      : undefined;
  const rightApex =
    verticalNeighbors > 0
      ? ([w - (h * right) / verticalNeighbors, (h * top) / verticalNeighbors] as const)
      : undefined;
  const bottomApex =
    horizontalNeighbors > 0
      ? ([(w * left) / horizontalNeighbors, h - (w * bottom) / horizontalNeighbors] as const)
      : undefined;
  const leftApex =
    verticalNeighbors > 0
      ? ([(h * left) / verticalNeighbors, (h * top) / verticalNeighbors] as const)
      : undefined;

  return [
    topApex && topApex[1] <= halfHeight
      ? `0,0 ${w},0 ${topApex[0]},${topApex[1]}`
      : top > 0
        ? `0,0 ${w},0 ${w - (halfHeight * right) / top},${halfHeight} ${(halfHeight * left) / top},${halfHeight}`
        : `0,0 ${w},0 ${w},${halfHeight} 0,${halfHeight}`,
    rightApex && rightApex[0] >= halfWidth
      ? `${w},0 ${w},${h} ${rightApex[0]},${rightApex[1]}`
      : right > 0
        ? `${w},0 ${w},${h} ${halfWidth},${h - (halfWidth * bottom) / right} ${halfWidth},${(halfWidth * top) / right}`
        : `${w},0 ${w},${h} ${halfWidth},${h} ${halfWidth},0`,
    bottomApex && bottomApex[1] >= halfHeight
      ? `${w},${h} 0,${h} ${bottomApex[0]},${bottomApex[1]}`
      : bottom > 0
        ? `${w},${h} 0,${h} ${(halfHeight * left) / bottom},${halfHeight} ${w - (halfHeight * right) / bottom},${halfHeight}`
        : `${w},${h} 0,${h} 0,${halfHeight} ${w},${halfHeight}`,
    leftApex && leftApex[0] <= halfWidth
      ? `0,${h} 0,0 ${leftApex[0]},${leftApex[1]}`
      : left > 0
        ? `0,${h} 0,0 ${halfWidth},${(halfWidth * top) / left} ${halfWidth},${h - (halfWidth * bottom) / left}`
        : `0,${h} 0,0 ${halfWidth},0 ${halfWidth},${h}`,
  ];
});

/**
 * A per-side border is clipped to its side's wedge of the box, and the tip
 * stands outside the box: its border is its side's, so that side's clip takes
 * the strip past the box the tip stands in as well.
 */
const tipSideIndex = computed(() => (tip.value ? borderSides.indexOf(tip.value.side) : -1));
const tipClipPoints = computed(() => {
  if (!tip.value) return undefined;
  const w = visibleWidth.value;
  const h = height.value;
  const reach = overhang.value[tip.value.side] + 1;
  switch (tip.value.side) {
    case "top":
      return `0,0 ${w},0 ${w},${-reach} 0,${-reach}`;
    case "right":
      return `${w},0 ${w + reach},0 ${w + reach},${h} ${w},${h}`;
    case "bottom":
      return `0,${h} ${w},${h} ${w},${h + reach} 0,${h + reach}`;
    default:
      return `0,0 0,${h} ${-reach},${h} ${-reach},0`;
  }
});
/** The strokes' own box, and the box grown to hold the tip: what the unequal-width mask covers. */
const strokeBox = computed(() => {
  const over = overhang.value;
  return {
    x: -over.left,
    y: -over.top,
    width: visibleWidth.value + over.left + over.right,
    height: height.value + over.top + over.bottom,
  };
});

/**
 * Restore a quadrant of the unequal-width knockout where adjacent sides are
 * really one border. Otherwise Chromium antialiases the same corner twice,
 * producing the dark fringe seen on the dashboard's top-left hairline.
 */
const borderMaskRestores = computed(() => {
  const halfWidth = visibleWidth.value / 2;
  const halfHeight = height.value / 2;
  return [
    { sides: [3, 0], x: 0, y: 0, width: halfWidth, height: halfHeight },
    {
      sides: [0, 1],
      x: halfWidth,
      y: 0,
      width: visibleWidth.value - halfWidth,
      height: halfHeight,
    },
    {
      sides: [1, 2],
      x: halfWidth,
      y: halfHeight,
      width: visibleWidth.value - halfWidth,
      height: height.value - halfHeight,
    },
    {
      sides: [2, 3],
      x: 0,
      y: halfHeight,
      width: halfWidth,
      height: height.value - halfHeight,
    },
  ].filter(({ sides: [first, second] }) => sameRenderedBorder(first!, second!));
});

const strokePattern = (style: SquircleBorderStyle, sideWidth: number) =>
  style === "dashed"
    ? { dasharray: `${3 * sideWidth} ${3 * sideWidth}`, linecap: "butt" as const }
    : style === "dotted"
      ? { dasharray: `0 ${2 * sideWidth}`, linecap: "round" as const }
      : { dasharray: undefined, linecap: "butt" as const };

/** The keyline glass draws for itself, `glassStroke()`'s shade and a glass squircle's default. */
const isGlassKeyline = (color: string) => Boolean(props.glass) && color === glassEdge.shade;

const strokes = computed<SquircleStroke[]>(() => {
  const output: SquircleStroke[] = [];
  const styles = borderSideStyles.value;
  const colors = asBorderSides<string>(resolvedBorderColor.value);
  const widths = borderSideWidths.value;
  const widestBorder = Math.max(...widths);

  if (isPerSideBorder.value) {
    const paths = new Map<number, string>();
    const groups = new Map<
      string,
      { style: SquircleBorderStyle; width: number; color: string; sides: number[] }
    >();

    styles.forEach((style, index) => {
      const sideWidth = widths[index]!;
      if (style === "none" || sideWidth <= 0) return;
      const color = colors[index]!;
      const key = JSON.stringify([style, sideWidth, color]);
      const group = groups.get(key);
      if (group) group.sides.push(index);
      else groups.set(key, { style, width: sideWidth, color, sides: [index] });
    });

    for (const { style, width: sideWidth, color, sides } of groups.values()) {
      let path = paths.get(sideWidth);
      if (path === undefined) {
        path = outline(-sideWidth / 2);
        paths.set(sideWidth, path);
      }
      if (!path) continue;

      const names = sides.map((side) => borderSides[side]);
      const ownsWholeOutline = sides.length === borderSides.length;
      const borderClipId =
        sides.length === 1 ? borderClipIds[sides[0]!] : `${clipId}-border-${names.join("-")}`;
      output.push({
        d: path,
        color,
        width: sideWidth,
        ...strokePattern(style, sideWidth),
        clipPath: ownsWholeOutline ? undefined : `url(#${borderClipId})`,
        clipSides: ownsWholeOutline || sides.length === 1 ? undefined : sides,
        mask:
          ownsWholeOutline || !hasUnequalBorderWidths.value ? undefined : `url(#${borderMaskId})`,
        keyline: isGlassKeyline(color),
      });
    }
  } else {
    const style = styles[0];
    const sideWidth = widths[0]!;
    const path = sideWidth > 0 ? outline(-sideWidth / 2) : "";
    if (path && style !== "none") {
      output.push({
        d: path,
        color: colors[0],
        width: sideWidth,
        ...strokePattern(style, sideWidth),
        keyline: isGlassKeyline(colors[0]),
      });
    }
  }

  if (wantsHighlight.value && typeof props.highlight === "string") {
    const path = outline(-(widestBorder + 0.5));
    if (path) output.push({ d: path, color: props.highlight, width: 1 });
  }

  return output;
});

/**
 * The border before the squircle has measured itself (see `surfaceStyle`), on a
 * rounded rectangle at the strokes' depth, above the content, where the SVG
 * strokes are drawn. One solid width and colour all round is an inset ring: the
 * line tokens are translucent, and a CSS border's sides overlap at a rounded
 * corner and come out darker there. A per-side or patterned border is a CSS
 * border, having no ring to become, and so is one with a highlight given as a
 * colour, a one-pixel inset line just inside it. The lit rim is not here: it is
 * on the surface (`squircle__surface--rim`), drawn the way the `.glass` classes
 * draw it, and inside the surface for the reason the measured rim is.
 */
const fallbackStroke = computed(() => {
  if (measured.value) return null;
  const widths = borderSideWidths.value;
  const styles = borderSideStyles.value;
  const colors = asBorderSides<string>(resolvedBorderColor.value);
  const drawn = widths.map((sideWidth, index) => (styles[index] === "none" ? 0 : sideWidth));
  const highlightLine = typeof props.highlight === "string";
  if (!drawn.some((sideWidth) => sideWidth > 0) && !highlightLine) return null;
  const ring =
    !highlightLine &&
    drawn.every((sideWidth) => sideWidth === drawn[0]) &&
    styles.every((style) => style === "solid") &&
    colors.every((color) => color === colors[0]);
  if (ring) {
    return {
      style: { borderRadius: radiusCss.value, boxShadow: `inset 0 0 0 ${drawn[0]}px ${colors[0]}` },
    };
  }
  return {
    style: {
      borderRadius: radiusCss.value,
      borderStyle: styles.join(" "),
      borderWidth: drawn.map((sideWidth) => `${sideWidth}px`).join(" "),
      borderColor: colors.join(" "),
      boxShadow: highlightLine ? `inset 0 0 0 1px ${props.highlight}` : undefined,
    },
  };
});

const combinedBorderClips = computed(() =>
  strokes.value.flatMap((stroke) => {
    if (!stroke.clipPath || !stroke.clipSides) return [];
    const points = stroke.clipSides.map((side) => borderClipPoints.value[side]!);
    if (tipClipPoints.value && stroke.clipSides.includes(tipSideIndex.value)) {
      points.push(tipClipPoints.value);
    }
    return [{ id: stroke.clipPath.slice(5, -1), points }];
  }),
);
</script>

<template>
  <svg
    v-if="measured && castShadowLayers.length"
    class="squircle__shadow"
    :width="castSvgSize.width"
    :height="castSvgSize.height"
    :style="{ top: `${-castPad.top}px`, left: `${-castPad.left}px` }"
    aria-hidden="true"
    focusable="false">
    <defs>
      <clipPath :id="knockoutId" clipPathUnits="userSpaceOnUse">
        <path :d="knockoutPath" clip-rule="evenodd" />
      </clipPath>
      <filter
        v-for="(layer, index) in castShadowLayers"
        :id="`${clipId}-blur-${index}`"
        :key="index"
        filterUnits="userSpaceOnUse"
        x="0"
        y="0"
        :width="castSvgSize.width"
        :height="castSvgSize.height">
        <feGaussianBlur :stdDeviation="layer.deviation" />
      </filter>
    </defs>
    <g :clip-path="`url(#${knockoutId})`">
      <path
        v-for="(layer, index) in castShadowLayers"
        :key="index"
        :d="layer.d"
        :fill="layer.color"
        :filter="`url(#${clipId}-blur-${index})`" />
    </g>
  </svg>

  <!-- The lit rim is drawn inside the surface, over its wash: a black copy of
       the outline that the filter turns into light, added to the surface by
       the layer's `plus-lighter`, with the flat face it cuts away drawn over
       it in red, a channel the filter reads and never paints. Inside, because
       a blend isolates the stacking context it sits in: drawn anywhere else in
       the squircle, it makes the squircle the Backdrop Root of the surface's
       blur, which then samples nothing. Here it blends within the surface's
       own paint, the blurred backdrop included. -->
  <span :class="surfaceClasses" :style="surfaceStyle">
    <svg
      v-if="measured && rim && surfacePath"
      class="squircle__rim"
      :width="visibleWidth"
      :height="height"
      :style="rimStyle"
      aria-hidden="true"
      focusable="false">
      <defs>
        <GlassRimFilter :id="rimId" :width="rimWidth" face="drawn" />
      </defs>
      <g :filter="`url(#${rimId})`">
        <path :d="rimPath" />
        <path v-if="rimFacePath" :d="rimFacePath" fill="rgb(255 0 0)" />
      </g>
    </svg>
  </span>

  <svg
    v-if="measured && insetShadowLayers.length"
    class="squircle__shadow squircle__shadow--inset"
    :width="insetSvgSize.width"
    :height="insetSvgSize.height"
    :style="{ top: `${-insetPad.top}px`, left: `${-insetPad.left}px` }"
    aria-hidden="true"
    focusable="false">
    <defs>
      <clipPath :id="wellId" clipPathUnits="userSpaceOnUse">
        <path :d="wellPath" />
      </clipPath>
      <filter
        v-for="(layer, index) in insetShadowLayers"
        :id="`${clipId}-inset-blur-${index}`"
        :key="index"
        filterUnits="userSpaceOnUse"
        x="0"
        y="0"
        :width="insetSvgSize.width"
        :height="insetSvgSize.height">
        <feGaussianBlur :stdDeviation="layer.deviation" />
      </filter>
    </defs>
    <g :clip-path="`url(#${wellId})`">
      <path
        v-for="(layer, index) in insetShadowLayers"
        :key="index"
        :d="layer.d"
        fill-rule="evenodd"
        :fill="layer.color"
        :filter="`url(#${clipId}-inset-blur-${index})`" />
    </g>
  </svg>

  <span
    v-if="fallbackStroke"
    class="squircle__strokes-fallback"
    :style="fallbackStroke.style"
    aria-hidden="true" />

  <svg
    v-if="measured && strokes.length"
    class="squircle__strokes"
    :width="visibleWidth"
    :height="height"
    :style="tip ? { overflow: 'visible' } : undefined"
    aria-hidden="true"
    focusable="false">
    <defs>
      <mask
        v-if="isPerSideBorder && hasUnequalBorderWidths"
        :id="borderMaskId"
        maskUnits="userSpaceOnUse"
        style="mask-type: luminance"
        :x="strokeBox.x"
        :y="strokeBox.y"
        :width="strokeBox.width"
        :height="strokeBox.height">
        <rect
          :x="strokeBox.x"
          :y="strokeBox.y"
          :width="strokeBox.width"
          :height="strokeBox.height"
          fill="white" />
        <path v-if="innerBorderPath" :d="innerBorderPath" fill="black" />
        <rect
          v-for="(restore, index) in borderMaskRestores"
          :key="index"
          class="squircle__border-mask-restore"
          :x="restore.x"
          :y="restore.y"
          :width="restore.width"
          :height="restore.height"
          fill="white" />
      </mask>
      <clipPath
        v-for="(points, index) in borderClipPoints"
        :id="borderClipIds[index]"
        :key="borderSides[index]"
        clipPathUnits="userSpaceOnUse">
        <polygon :points />
        <polygon v-if="index === tipSideIndex" :points="tipClipPoints" />
      </clipPath>
      <clipPath
        v-for="clip in combinedBorderClips"
        :id="clip.id"
        :key="clip.id"
        clipPathUnits="userSpaceOnUse">
        <polygon v-for="(points, index) in clip.points" :key="index" :points />
      </clipPath>
    </defs>
    <path
      v-for="(stroke, index) in strokes"
      :key="index"
      :class="stroke.keyline && 'squircle__keyline'"
      :d="stroke.d"
      fill="none"
      :stroke="stroke.color"
      :stroke-width="stroke.width"
      :stroke-dasharray="stroke.dasharray"
      :stroke-linecap="stroke.linecap"
      :clip-path="stroke.clipPath"
      :mask="stroke.mask" />
  </svg>

  <svg class="squircle__defs" aria-hidden="true" focusable="false">
    <defs>
      <clipPath :id="clipId" clipPathUnits="objectBoundingBox">
        <path :d="surfacePath" :transform="surfacePathTransform" />
      </clipPath>
      <!-- The fill's clip where there is a tip: the tipped outline, in the
           surface's box, which reaches past the squircle's to paint it. The
           clip above stays the box's own, for the content. -->
      <clipPath v-if="tip" :id="tipClipId" clipPathUnits="objectBoundingBox">
        <path :d="fillPath" :transform="fillPathTransform" />
      </clipPath>
      <clipPath v-if="cutPath" :id="cutId" clipPathUnits="objectBoundingBox">
        <path :d="cutPath" clip-rule="evenodd" :transform="fillPathTransform" />
      </clipPath>
      <mask v-if="glass" :id="maskId" maskContentUnits="objectBoundingBox">
        <path
          :d="cutPath || fillPath"
          fill="white"
          fill-rule="evenodd"
          :transform="fillPathTransform" />
      </mask>
      <!-- The rim fade, one per element of the content that reaches into the
           rim: the steps in the surface's px, moved into that element's box. -->
      <mask v-for="fade in fades" :id="fade.id" :key="fade.id" maskContentUnits="objectBoundingBox">
        <g
          :transform="`scale(${1 / fade.width} ${1 / fade.height}) translate(${-fade.x} ${-fade.y})`">
          <path
            v-for="(step, index) in fadeSteps"
            :key="index"
            :d="step.d"
            fill="white"
            :fill-opacity="step.alpha" />
        </g>
      </mask>
    </defs>
  </svg>
</template>
