<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, onMounted, ref, useId, useTemplateRef, watch } from "vue";
import { useElementSize } from "@vueuse/core";
import { colors, surface } from "#layers/sine/tailwind.config";
import Squircle from "#layers/sine/app/components/UI/Squircle.vue";
import type { Key, Layout } from "../utils/layout";
import { legendName } from "../utils/legends";
import { keyResizeBounds, resizeCursor, resizeKeyGeometry } from "../utils/resize";
import type { KeyGeometryPatch, ResizeEdge } from "../utils/resize";
import {
  canvasFrame,
  KEYCAP_EDGE,
  KEYCAP_NUB,
  KEYCAP_TOP_EDGE,
  keyGeometry,
  keyIntersectsRect,
  keyRing,
  legendColor,
  legendSlotAt,
  legendSlots,
  PLATE_FALLBACK,
  rotatedPoint,
  safeColor,
  SYSTEM_FONT,
  UNIT,
} from "../utils/svg";
import { clampScale, fitScale, type Zoom } from "../utils/zoom";

/**
 * The stage: the layout on a canvas of its plate's color that fills the
 * stage, at the zoom its document keeps, with the gestures of an object
 * editor (Sine: Overview › Product intent). A key selects on a click and
 * moves on a drag, an edge resizes it, Alt-drag duplicates, a drag anywhere
 * else on the canvas draws a lasso, and a double-click types the legend under
 * the pointer in place. Space or the middle button pans, and Ctrl or ⌘ with
 * the wheel (a pinch on a trackpad) zooms at the pointer.
 */
const {
  layout,
  selectedIds,
  zoom = "fit",
} = defineProps<{
  layout: Layout;
  selectedIds: string[];
  zoom?: Zoom;
}>();
const emit = defineEmits<{
  select: [id: string, additive: boolean];
  clear: [];
  move: [dx: number, dy: number];
  duplicate: [ids: string[], dx: number, dy: number];
  resize: [id: string, geometry: KeyGeometryPatch];
  marquee: [ids: string[], additive: boolean];
  /** One key's legend, typed in place. */
  legend: [id: string, index: number, text: string];
  "update:zoom": [zoom: Zoom];
  scale: [scale: number];
  /** Edit the legends of several keys at once, which the inspector does. */
  edit: [id: string];
}>();

/** The room a fitted layout keeps from the canvas's edges. */
const STAGE_INSET = 48;
/**
 * The three channels a key is marked by, which never borrow each other's
 * colors (Sine: Foundations › Color › Selection and tint). Hover is the
 * neutral fill. The selection is the selection's green, the one the text
 * selection takes, on a white keyline so it reads on a cap of any color.
 * Focus is the ring in the system's one dark, 2px outside the cap.
 */
const HOVER = colors.fill[2];
const SELECTION = colors.brand;
const INK = surface.inverse;
const HALO = surface.DEFAULT;

const svg = useTemplateRef<SVGSVGElement>("canvas");
const stage = useTemplateRef<HTMLDivElement>("stage");
const stageSize = ref({ width: 0, height: 0 });
let observer: ResizeObserver | undefined;
const prefix = useId().replace(/:/g, "");

// A gesture locks the frame and the scale, so the canvas holds still under it.
const lockedFrame = ref<ReturnType<typeof canvasFrame> | null>(null);
const lockedScale = ref<number | null>(null);
const frame = computed(() => lockedFrame.value ?? canvasFrame(layout));
const liveScale = computed(() =>
  zoom === "fit"
    ? stageSize.value.width
      ? fitScale(frame.value, stageSize.value, STAGE_INSET)
      : 1
    : clampScale(zoom),
);
const scale = computed(() => lockedScale.value ?? liveScale.value);
/**
 * The canvas is the whole stage, in the plate's color edge to edge. The layout
 * sits in its middle with room around it, and once the layout at this zoom
 * needs more than the stage has, the canvas grows past it and the stage
 * scrolls. Exports keep to the layout's own frame.
 */
function viewAt(at: number) {
  const width = Math.max(frame.value.width * at + STAGE_INSET * 2, stageSize.value.width) / at;
  const height = Math.max(frame.value.height * at + STAGE_INSET * 2, stageSize.value.height) / at;
  return {
    x: frame.value.x - (width - frame.value.width) / 2,
    y: frame.value.y - (height - frame.value.height) / 2,
    width,
    height,
  };
}
const view = computed(() => viewAt(scale.value));
const viewBox = computed(
  () => `${view.value.x} ${view.value.y} ${view.value.width} ${view.value.height}`,
);
const plate = computed(() => safeColor(layout.meta.backcolor, PLATE_FALLBACK));

const resizing = ref<{
  id: string;
  geometry: KeyGeometryPatch;
  /** The key's bounds when the drag began, which the readout measures from. */
  before: ReturnType<typeof keyResizeBounds>;
} | null>(null);
const keys = computed(() =>
  layout.keys.map((original) => {
    const key =
      resizing.value?.id === original.id ? { ...original, ...resizing.value.geometry } : original;
    return { key, shape: keyGeometry(key), handles: resizeHandles(key) };
  }),
);
const selection = computed(() => new Set(selectedIds));
const preview = ref({ dx: 0, dy: 0 });
const duplicating = ref(false);
const marquee = ref<{ x: number; y: number; width: number; height: number; additive: boolean } | null>(
  null,
);
const movingIds = ref<string[]>([]);
/** A press is being dragged: the pointer is the gesture's until it lets go. */
const dragging = ref(false);
/** Where the pointer is while a key is dragged, for the readout that follows it. */
const pointer = ref<{ x: number; y: number } | null>(null);
/** Alt-drag has taken its copies off the originals; the drop selects the copies. */
const placingCopies = computed(() => duplicating.value && Boolean(preview.value.dx || preview.value.dy));
/** A drag has lifted its keys off their places. */
const lifting = computed(() => !duplicating.value && Boolean(preview.value.dx || preview.value.dy));
/**
 * The keys in their places, then what a drag carries: the copies being
 * placed, or the keys themselves, lifted. Drawn last, carried keys pass over
 * the others. A lifted key's own element stays in its place unseen, so it
 * keeps the focus, and with it the Escape that cancels the drag.
 */
const renderedKeys = computed(() => {
  const carried = placingCopies.value ? "copy" : lifting.value ? "lift" : null;
  return [
    ...keys.value.map((item) => ({ ...item, carried: null as "copy" | "lift" | null })),
    ...(carried
      ? keys.value
          .filter((item) => movingIds.value.includes(item.key.id))
          .map((item) => ({ ...item, carried }))
      : []),
  ];
});

/**
 * The selection as drawn, which shows what letting go will select, as a
 * native editor does. A lasso shows the keys it touches, with the selection
 * they join when Shift or Control is held; copies being placed show as the
 * selection, and the keys they were copied from as left behind.
 */
const shown = computed(() => {
  const box = marquee.value;
  if (box) {
    const caught = layout.keys.filter((key) => keyIntersectsRect(key, box)).map((key) => key.id);
    return new Set(box.additive ? [...selectedIds, ...caught] : caught);
  }
  if (placingCopies.value) return new Set(selectedIds.filter((id) => !movingIds.value.includes(id)));
  return selection.value;
});
const hoveredId = ref<string | null>(null);

/** The focused key's ring, mounted on that key alone, 2px outside its edge at any zoom. */
const focusedId = ref<string | null>(null);
const focusRing = computed(() => {
  const item = keys.value.find(({ key }) => key.id === focusedId.value);
  return item && { ...item, path: keyRing(item.key, 3 / scale.value) };
});

let gesture: {
  pointerId: number;
  kind: "move" | "marquee" | "resize";
  start: { x: number; y: number };
  clientX: number;
  clientY: number;
  additive: boolean;
  moved: boolean;
  matrix: DOMMatrix;
  /** The key pressed, for a move: a press that doesn't travel is a click on it. */
  id?: string;
  /** The press was on one key of several selected: a click narrows the selection to it. */
  narrows?: boolean;
  original?: Key;
  edge?: ResizeEdge;
} | null = null;

function point(event: PointerEvent) {
  const matrix = gesture?.matrix ?? svg.value?.getScreenCTM()?.inverse();
  if (!matrix || !svg.value) return null;
  const position = svg.value.createSVGPoint();
  position.x = event.clientX;
  position.y = event.clientY;
  return position.matrixTransform(matrix);
}

function additive(event: MouseEvent | KeyboardEvent) {
  return event.shiftKey || event.ctrlKey || event.metaKey;
}

function blurInspector() {
  // Commit an inspector field's pending change while its selection is still the one shown.
  const active = document.activeElement;
  if (active instanceof HTMLElement && active.matches('input, textarea, [contenteditable="true"]'))
    active.blur();
}

function capture(event: PointerEvent) {
  if (!svg.value) return null;
  const matrix = svg.value.getScreenCTM()?.inverse();
  if (!matrix) return null;
  lockedFrame.value = { ...frame.value };
  lockedScale.value = scale.value;
  dragging.value = true;
  svg.value.setPointerCapture(event.pointerId);
  return matrix;
}

function keyElement(id: string) {
  return Array.from(svg.value?.querySelectorAll<SVGGElement>("[data-key-id]") ?? []).find(
    (element) => element.dataset.keyId === id,
  );
}

// Two clicks on one key, close in time and place, edit it. A double-click is
// two whole clicks, so a click and then a quick drag still drags. Pointer
// capture sends the browser's own `dblclick` to the stage rather than the key.
// A click that doesn't pair with the one before it can start a pair of its own.
let lastClick: { id: string; time: number; x: number; y: number } | null = null;
function isDoubleClick(event: PointerEvent, id: string) {
  const previous = lastClick;
  const click = { id, time: event.timeStamp, x: event.clientX, y: event.clientY };
  const double =
    !!previous &&
    previous.id === id &&
    click.time - previous.time <= 500 &&
    Math.hypot(click.x - previous.x, click.y - previous.y) < 4;
  lastClick = double ? null : click;
  return double;
}

function begin(event: PointerEvent, id?: string) {
  if (event.button !== 0 || gesture) return;
  blurInspector();
  const start = point(event);
  if (!start || !svg.value) return;
  event.preventDefault();
  const copying = Boolean(id && event.altKey);
  const adding = !copying && additive(event);
  let narrows = false;
  if (id) {
    const alreadySelected = selection.value.has(id);
    focusPressed(id);
    if (adding || !alreadySelected) emit("select", id, adding);
    // A modifier click on a selected key deselects it without starting a drag.
    if (adding && alreadySelected) return;
    // A drag from one of several selected keys moves them all; a click picks it out.
    narrows = alreadySelected && !adding && !copying && selectedIds.length > 1;
    movingIds.value = alreadySelected ? [...selectedIds] : adding ? [...selectedIds, id] : [id];
  }
  const matrix = capture(event);
  if (!matrix) return;
  duplicating.value = copying;
  gesture = {
    pointerId: event.pointerId,
    kind: id ? "move" : "marquee",
    id: copying || adding ? undefined : id,
    narrows,
    start,
    clientX: event.clientX,
    clientY: event.clientY,
    additive: adding,
    moved: false,
    matrix,
  };
}

function beginResize(event: PointerEvent, id: string, edge: ResizeEdge) {
  // Alt-drag takes priority over resize targets, including edges and corners.
  if (event.altKey) return begin(event, id);
  if (event.button !== 0 || gesture) return;
  blurInspector();
  const original = layout.keys.find((key) => key.id === id);
  const start = point(event);
  if (!original || !start || !svg.value) return;
  event.preventDefault();
  focusPressed(id);
  const matrix = capture(event);
  if (!matrix) return;
  gesture = {
    pointerId: event.pointerId,
    kind: "resize",
    start,
    clientX: event.clientX,
    clientY: event.clientY,
    additive: false,
    moved: false,
    matrix,
    original: structuredClone(original),
    edge,
  };
}

function update(event: PointerEvent) {
  if (!gesture || gesture.pointerId !== event.pointerId) return;
  const current = point(event);
  if (!current) return;
  gesture.moved ||=
    Math.hypot(event.clientX - gesture.clientX, event.clientY - gesture.clientY) >= 3;
  if (!gesture.moved) return;
  if (gesture.kind !== "marquee") pointer.value = { x: event.clientX, y: event.clientY };
  if (gesture.kind === "move") {
    preview.value = {
      dx: Math.round(((current.x - gesture.start.x) / UNIT) * 4) / 4,
      dy: Math.round(((current.y - gesture.start.y) / UNIT) * 4) / 4,
    };
  } else if (gesture.kind === "resize" && gesture.original && gesture.edge) {
    resizing.value = {
      id: gesture.original.id,
      geometry: resizeKeyGeometry(
        gesture.original,
        gesture.edge,
        (current.x - gesture.start.x) / UNIT,
        (current.y - gesture.start.y) / UNIT,
      ),
      before: keyResizeBounds(gesture.original),
    };
  } else {
    marquee.value = {
      x: Math.min(gesture.start.x, current.x),
      y: Math.min(gesture.start.y, current.y),
      width: Math.abs(current.x - gesture.start.x),
      height: Math.abs(current.y - gesture.start.y),
      additive: gesture.additive,
    };
  }
}

function resetGesture() {
  const pointerId = gesture?.pointerId;
  gesture = null;
  preview.value = { dx: 0, dy: 0 };
  movingIds.value = [];
  duplicating.value = false;
  resizing.value = null;
  marquee.value = null;
  pointer.value = null;
  dragging.value = false;
  lockedFrame.value = null;
  lockedScale.value = null;
  if (pointerId !== undefined && svg.value?.hasPointerCapture(pointerId))
    svg.value.releasePointerCapture(pointerId);
}

function cancelWithEscape(event: KeyboardEvent) {
  if (!gesture) return;
  event.preventDefault();
  event.stopPropagation();
  resetGesture();
}

function finish(event: PointerEvent) {
  if (!gesture || gesture.pointerId !== event.pointerId) return;
  update(event);
  let edit: { id: string; slot: number } | null = null;
  if (gesture.kind === "move") {
    const { dx, dy } = preview.value;
    if (!gesture.moved && gesture.id) {
      if (gesture.narrows) emit("select", gesture.id, false);
      if (isDoubleClick(event, gesture.id)) edit = { id: gesture.id, slot: legendUnder(event, gesture.id) };
    }
    if (dx || dy) {
      if (duplicating.value) emit("duplicate", [...movingIds.value], dx, dy);
      else emit("move", dx, dy);
    }
  } else if (gesture.kind === "resize") {
    if (resizing.value) emit("resize", resizing.value.id, resizing.value.geometry);
  } else if (marquee.value) {
    const box = marquee.value;
    const ids = layout.keys.filter((key) => keyIntersectsRect(key, box)).map((key) => key.id);
    emit("marquee", ids, gesture.additive);
  } else if (!gesture.additive) emit("clear");
  resetGesture();
  if (edit) editLegend(edit.id, edit.slot);
}

function resizeHandles(key: Key) {
  const box = keyResizeBounds(key);
  const left = box.x * UNIT,
    right = (box.x + box.width) * UNIT;
  const top = box.y * UNIT,
    bottom = (box.y + box.height) * UNIT;
  const centerX = (left + right) / 2,
    centerY = (top + bottom) / 2;
  // Targets in screen pixels, so an edge is as easy to catch at 25% as at 400%.
  const hitSize = Math.min(6 / scale.value, (box.width * UNIT) / 5, (box.height * UNIT) / 5);
  const hitStrokeWidth = Math.min(10, (Math.min(box.width, box.height) * UNIT * scale.value) / 3);
  const handles = [
    { edge: "left", x1: left, y1: top, x2: left, y2: bottom, x: left, y: centerY },
    { edge: "right", x1: right, y1: top, x2: right, y2: bottom, x: right, y: centerY },
    { edge: "top", x1: left, y1: top, x2: right, y2: top, x: centerX, y: top },
    { edge: "bottom", x1: left, y1: bottom, x2: right, y2: bottom, x: centerX, y: bottom },
    { edge: "top-left", x1: left, y1: top, x2: left, y2: top, x: left, y: top },
    { edge: "top-right", x1: right, y1: top, x2: right, y2: top, x: right, y: top },
    { edge: "bottom-left", x1: left, y1: bottom, x2: left, y2: bottom, x: left, y: bottom },
    { edge: "bottom-right", x1: right, y1: bottom, x2: right, y2: bottom, x: right, y: bottom },
  ] satisfies {
    edge: ResizeEdge;
    x1: number;
    y1: number;
    x2: number;
    y2: number;
    x: number;
    y: number;
  }[];
  // 7px on screen, but never more than a quarter of a small key's shorter side.
  const size = Math.min(7, (Math.min(box.width, box.height) * UNIT * scale.value) / 4) / scale.value;
  return handles.map((handle) => ({ ...handle, hitSize, hitStrokeWidth, size }));
}

function keyLabel(key: Layout["keys"][number]) {
  return `${key.labels.filter(Boolean).join(", ") || "Blank key"}, ${key.width} by ${key.height} units`;
}

function keyboardSelect(event: KeyboardEvent, id: string) {
  if (event.key !== "Enter" && event.key !== " ") return;
  event.preventDefault();
  event.stopPropagation();
  if (event.key === "Enter" && selection.value.has(id) && !additive(event)) {
    // One key's legends are typed on it; several keys' are typed once, for all of them.
    if (selectedIds.length === 1) editLegend(id);
    else emit("edit", id);
    return;
  }
  emit("select", id, additive(event));
}

/**
 * A key pressed takes focus, so the keyboard carries on from it, without the
 * ring: the ring says the keyboard is here. Chrome matches `:focus-visible`
 * on a focus a script gives during a press it was told to ignore, so a press
 * says so itself.
 */
let pressing = false;
function focusPressed(id: string) {
  focusedId.value = null;
  pressing = true;
  keyElement(id)?.focus({ preventScroll: true });
  pressing = false;
}
function trackFocus(event: FocusEvent, id: string) {
  focusedId.value = !pressing && (event.target as Element).matches(":focus-visible") ? id : null;
}

// -- Legends in place ----------------------------------------------------------

/** The legend being typed: one slot of one key, and its text so far. */
const editing = ref<{ id: string; slot: number; text: string } | null>(null);
const legendField = useTemplateRef<{ focus: () => void }>("legend-field");

/** The slot under the pointer on a key, read in the cap's own unrotated coordinates. */
function legendUnder(event: PointerEvent, id: string) {
  const key = layout.keys.find((key) => key.id === id);
  const at = point(event);
  if (!key || !at) return 0;
  const local = rotatedPoint({ ...key, rotation_angle: -key.rotation_angle }, at);
  const drawn: Record<number, DOMRect> = {};
  for (const text of keyElement(id)?.querySelectorAll<SVGTextElement>("text[data-slot]") ?? [])
    drawn[Number(text.dataset.slot)] = text.getBBox();
  return legendSlotAt(key, local, drawn);
}

/**
 * Type one of a key's legends where it is drawn: the slot asked for, else the
 * first the key has written, else the top left one.
 */
async function editLegend(id: string, slot?: number) {
  const key = layout.keys.find((key) => key.id === id);
  if (!key) return;
  const slots = legendSlots(key);
  const index =
    slot !== undefined && slots[slot] ? slot : (slots.find(({ slot }) => key.labels[slot])?.slot ?? 0);
  editing.value = { id, slot: index, text: key.labels[index] ?? "" };
  await nextTick();
  legendField.value?.focus();
}

/** Where the open legend is drawn, from the text it holds now, so the field sits where the legend will. */
const legendPlacement = computed(() => {
  const open = editing.value;
  const original = open && layout.keys.find((key) => key.id === open.id);
  if (!open || !original) return null;
  const labels = [...original.labels];
  labels[open.slot] = open.text;
  const key = { ...original, labels };
  const slot = legendSlots(key)[open.slot];
  if (!slot) return null;
  const anchor = rotatedPoint(key, slot);
  // Never smaller than 12px to type in, however far out the stage is zoomed.
  const size = Math.max(12, slot.size * scale.value);
  return {
    x: (anchor.x - view.value.x) * scale.value,
    y: (anchor.y - view.value.y) * scale.value,
    angle: key.rotation_angle,
    size,
    color: legendColor(key, open.slot),
    anchor: slot.anchor,
    minWidth: Math.max(slot.area.width * scale.value, size * 1.5),
    name: legendName(open.slot),
  };
});

/** Keep what was typed: one undo step, and only when it changed. */
function keepLegend() {
  const open = editing.value;
  if (!open) return;
  const key = layout.keys.find((key) => key.id === open.id);
  if (key && (key.labels[open.slot] ?? "") !== open.text) emit("legend", open.id, open.slot, open.text);
}

/** Close the field; from the keyboard, the caret goes back to the key it was on. */
function closeLegend(keep: boolean, returnFocus: boolean) {
  const open = editing.value;
  if (!open) return;
  if (keep) keepLegend();
  editing.value = null;
  if (returnFocus) keyElement(open.id)?.focus({ preventScroll: true });
}

/** Tab and Shift-Tab: keep this legend and go round the cap's slots, in KLE's order. */
async function stepLegend(direction: 1 | -1) {
  const open = editing.value;
  const key = open && layout.keys.find((key) => key.id === open.id);
  if (!open || !key) return;
  keepLegend();
  const count = legendSlots(key).length;
  const slot = (open.slot + direction + count) % count;
  editing.value = { id: open.id, slot, text: key.labels[slot] ?? "" };
  await nextTick();
  legendField.value?.focus();
}

// -- The readout ---------------------------------------------------------------

const readoutBox = useTemplateRef<HTMLElement>("readout-box");
const readoutSize = useElementSize(readoutBox, undefined, { box: "border-box" });

/** What a drag has done so far, in units: the move, or the resize's change to the key's bounds. */
const readout = computed(() => {
  if (!pointer.value) return null;
  const change = resizing.value;
  if (change) {
    const after = keyResizeBounds(change.geometry);
    return {
      title: "",
      values: [
        ["Δx", after.x - change.before.x],
        ["Δy", after.y - change.before.y],
        ["Δw", after.width - change.before.width],
        ["Δh", after.height - change.before.height],
      ] as const,
    };
  }
  if (!movingIds.value.length) return null;
  const count = movingIds.value.length;
  return {
    title: duplicating.value ? `Duplicating ${count} ${count === 1 ? "key" : "keys"}` : "",
    values: [
      ["Δx", preview.value.dx],
      ["Δy", preview.value.dy],
    ] as const,
  };
});

/** Below and right of the pointer, and over to its other side near the window's edge. */
const readoutPosition = computed(() => {
  const at = pointer.value;
  if (!at) return undefined;
  const width = readoutSize.width.value,
    height = readoutSize.height.value;
  const left = at.x + 16 + width > window.innerWidth - 8 ? at.x - 12 - width : at.x + 16;
  const top = at.y + 20 + height > window.innerHeight - 8 ? at.y - 12 - height : at.y + 20;
  return { left: `${Math.max(8, left)}px`, top: `${Math.max(8, top)}px` };
});

/** A change in units, signed, to three places at most: “+1.25”, “−0.5”, “0”. */
function signed(value: number) {
  const rounded = Math.round(value * 1000) / 1000;
  if (!rounded) return "0";
  return `${rounded > 0 ? "+" : "−"}${Math.abs(rounded)}`;
}

// -- Zoom and pan ------------------------------------------------------------

/** Where the last zoom was asked for; the drawing under it stays under it. */
let anchor: { clientX: number; clientY: number } | null = null;

function onWheel(event: WheelEvent) {
  // A plain wheel scrolls the stage; with Ctrl or ⌘, and in a trackpad's
  // pinch, it zooms at the pointer instead of zooming the page.
  if (!(event.ctrlKey || event.metaKey) || !layout.keys.length) return;
  event.preventDefault();
  const delta = event.deltaMode === 1 ? event.deltaY * 16 : event.deltaY;
  const next = clampScale(scale.value * Math.exp(-delta * 0.0025));
  if (Math.abs(next - scale.value) < 0.001 || gesture) return;
  anchor = { clientX: event.clientX, clientY: event.clientY };
  emit("update:zoom", Math.round(next * 1000) / 1000);
}

watch(
  scale,
  (next, previous) => {
    emit("scale", next);
    const point = anchor;
    anchor = null;
    if (previous === undefined || gesture || !svg.value || !stage.value) return;
    const before = svg.value.getBoundingClientRect();
    const box = stage.value.getBoundingClientRect();
    const at = point ?? { clientX: box.left + box.width / 2, clientY: box.top + box.height / 2 };
    // The point of the drawing under it, which the canvas's own edge no longer marks.
    const from = viewAt(previous);
    const x = from.x + (at.clientX - before.left) / previous,
      y = from.y + (at.clientY - before.top) / previous;
    nextTick(() => {
      if (!svg.value || !stage.value) return;
      const after = svg.value.getBoundingClientRect();
      stage.value.scrollLeft += after.left + (x - view.value.x) * next - at.clientX;
      stage.value.scrollTop += after.top + (y - view.value.y) * next - at.clientY;
    });
  },
  { flush: "pre", immediate: true },
);

const spaceHeld = ref(false);
const panning = ref(false);
let pointerOver = false;
const hover = (over: boolean) => {
  pointerOver = over;
};
let pan: { pointerId: number; x: number; y: number; left: number; top: number } | null = null;

function beginPan(event: PointerEvent) {
  if (!stage.value || !(event.button === 1 || (event.button === 0 && spaceHeld.value))) return;
  event.preventDefault();
  event.stopPropagation();
  pan = {
    pointerId: event.pointerId,
    x: event.clientX,
    y: event.clientY,
    left: stage.value.scrollLeft,
    top: stage.value.scrollTop,
  };
  panning.value = true;
  stage.value.setPointerCapture(event.pointerId);
}
function updatePan(event: PointerEvent) {
  if (!pan || !stage.value || event.pointerId !== pan.pointerId) return;
  stage.value.scrollLeft = pan.left - (event.clientX - pan.x);
  stage.value.scrollTop = pan.top - (event.clientY - pan.y);
}
function endPan(event: PointerEvent) {
  if (!pan || event.pointerId !== pan.pointerId) return;
  if (stage.value?.hasPointerCapture(pan.pointerId)) stage.value.releasePointerCapture(pan.pointerId);
  pan = null;
  panning.value = false;
}

function isTyping(target: EventTarget | null) {
  return target instanceof HTMLElement && !!target.closest("input, textarea, select, [contenteditable='true']");
}
/**
 * Held over the stage, Space is the hand. It is read on the way down, before a
 * focused key answers it, and left to that key: a keyboard user's Space still
 * selects, and a press that starts while it is held pans instead of dragging.
 */
function onKeyDown(event: KeyboardEvent) {
  if (event.key !== " " || !pointerOver || isTyping(event.target)) return;
  spaceHeld.value = true;
}
function onKeyUp(event: KeyboardEvent) {
  if (event.key === " ") spaceHeld.value = false;
}
function releaseSpace() {
  spaceHeld.value = false;
}

const cursor = computed(() =>
  panning.value ? "grabbing" : spaceHeld.value ? "grab" : duplicating.value ? "copy" : undefined,
);

watch(
  () => selectedIds,
  (ids) => {
    if (
      gesture?.kind === "move" &&
      (ids.length !== movingIds.value.length || ids.some((id) => !movingIds.value.includes(id)))
    )
      resetGesture();
    if (gesture?.kind === "resize") resetGesture();
  },
);
/**
 * A change under a gesture ends it when the keys it holds have gone or, for a
 * resize, changed shape. Anything else leaves it be: a press that commits a
 * field it took focus from, a legend typed in place most often, changes the
 * layout as the gesture starts, and that is no reason to drop the drag.
 */
const GEOMETRY = ["x", "y", "x2", "y2", "width", "height", "width2", "height2"] as const;
function gestureOutdated() {
  if (gesture?.kind === "resize") {
    const original = gesture.original;
    const key = original && layout.keys.find((key) => key.id === original.id);
    return !key || GEOMETRY.some((field) => key[field] !== original[field]);
  }
  return gesture?.kind === "move" && movingIds.value.some((id) => !layout.keys.some((key) => key.id === id));
}

watch(
  () => layout,
  () => {
    if (gestureOutdated()) resetGesture();
    // A key deleted or replaced under its open legend takes the field with it.
    const open = editing.value;
    if (open && !layout.keys.some((key) => key.id === open.id)) editing.value = null;
  },
);
watch(
  () => zoom,
  () => {
    if (gesture) resetGesture();
  },
);

onMounted(() => {
  window.addEventListener("keydown", onKeyDown, true);
  window.addEventListener("keyup", onKeyUp, true);
  window.addEventListener("blur", releaseSpace);
  if (!stage.value) return;
  stageSize.value = { width: stage.value.clientWidth, height: stage.value.clientHeight };
  observer = new ResizeObserver(([entry]) => {
    if (entry)
      stageSize.value = { width: entry.contentRect.width, height: entry.contentRect.height };
  });
  observer.observe(stage.value);
});
onBeforeUnmount(() => {
  resetGesture();
  observer?.disconnect();
  window.removeEventListener("keydown", onKeyDown, true);
  window.removeEventListener("keyup", onKeyUp, true);
  window.removeEventListener("blur", releaseSpace);
});

/** The stage's own scroll, for a caller that moves the view, and a key's legend to type in place. */
defineExpose({ element: stage, editLegend });
</script>

<template>
  <!-- The caller positions the stage; it fills whatever box it is given. -->
  <div class="min-h-0 min-w-0">
    <div
      ref="stage"
      class="keyboard-stage h-full w-full overflow-auto bg-surface outline-none"
      :style="{ cursor }"
      @pointerdown.capture="beginPan"
      @pointermove="updatePan"
      @pointerup="endPan"
      @pointercancel="endPan"
      @pointerenter="hover(true)"
      @pointerleave="hover(false)"
      @wheel="onWheel">
      <!-- The canvas, the size of the stage or of the layout at this zoom, whichever
           is larger, and over it the legend being typed, in the canvas's own pixels. -->
      <div class="relative" :style="{ width: `${view.width * scale}px`, height: `${view.height * scale}px` }">
        <svg
          ref="canvas"
          :viewBox="viewBox"
          :width="view.width * scale"
          :height="view.height * scale"
          :font-family="SYSTEM_FONT"
          role="group"
          aria-label="Keyboard layout"
          :aria-describedby="`${prefix}-help`"
          class="keyboard-plate block touch-none overflow-visible"
          @pointerdown="begin($event)"
          @pointermove="update"
          @pointerup="finish"
          @pointercancel="resetGesture"
          @lostpointercapture="resetGesture"
          @keydown.esc="cancelWithEscape">
          <rect :x="view.x" :y="view.y" :width="view.width" :height="view.height" :fill="plate" />
          <g
            v-for="({ key, shape, carried }, index) in renderedKeys"
            :key="carried ? `${carried}-${key.id}` : key.id"
            :data-key-id="carried ? undefined : key.id"
            :data-key-copy-id="carried === 'copy' ? key.id : undefined"
            :transform="carried ? `translate(${preview.dx * UNIT} ${preview.dy * UNIT})` : undefined"
            :opacity="!carried && lifting && movingIds.includes(key.id) ? 0 : undefined"
            :aria-label="carried ? undefined : keyLabel(key)"
            :aria-pressed="carried ? undefined : selection.has(key.id)"
            :aria-hidden="carried ? true : undefined"
            :tabindex="carried ? undefined : 0"
            :role="carried ? undefined : 'button'"
            class="keycap outline-none"
            :class="carried ? 'pointer-events-none' : cursor ? undefined : 'cursor-grab active:cursor-grabbing'"
            @pointerdown.stop="begin($event, key.id)"
            @pointerenter="hoveredId = key.id"
            @pointerleave="hoveredId = hoveredId === key.id ? null : hoveredId"
            @keydown="keyboardSelect($event, key.id)"
            @focus="trackFocus($event, key.id)"
            @blur="focusedId = null">
            <g :transform="shape.transform">
              <defs>
                <clipPath :id="`${prefix}-legend-${index}`"><path :d="shape.hit" /></clipPath>
              </defs>
              <path :d="shape.hit" fill="transparent" />
              <g :opacity="key.ghost ? 0.45 : 1" pointer-events="none">
                <path
                  v-if="!key.decal"
                  :d="shape.outer"
                  :fill="shape.color"
                  :stroke="KEYCAP_EDGE"
                  stroke-width="1"
                  :stroke-dasharray="key.ghost ? '3 3' : undefined" />
                <path
                  v-if="!key.decal && !key.ghost"
                  :d="shape.inner"
                  :fill="shape.topColor"
                  :stroke="KEYCAP_TOP_EDGE"
                  stroke-width="0.8" />
                <g :clip-path="`url(#${prefix}-legend-${index})`">
                  <text
                    v-for="label in shape.labels"
                    :key="label.slot"
                    :data-slot="carried ? undefined : label.slot"
                    :x="label.x"
                    :y="label.y"
                    :text-anchor="label.anchor"
                    :font-size="label.size"
                    :fill="label.color"
                    :visibility="
                      !carried && editing?.id === key.id && editing.slot === label.slot
                        ? 'hidden'
                        : undefined
                    ">
                    <tspan
                      v-for="(line, lineIndex) in label.lines"
                      :key="lineIndex"
                      :x="label.x"
                      :dy="lineIndex ? label.size : 0">
                      {{ line }}
                    </tspan>
                  </text>
                  <line
                    v-if="key.nub && !key.ghost && !key.decal"
                    :x1="shape.nub.x1"
                    :x2="shape.nub.x2"
                    :y1="shape.nub.y"
                    :y2="shape.nub.y"
                    :stroke="KEYCAP_NUB"
                    stroke-width="2"
                    stroke-linecap="round" />
                </g>
              </g>
              <!-- Hover: the neutral fill over the cap, on a key the pointer could pick up. -->
              <path
                v-if="!carried && !dragging && hoveredId === key.id && !shown.has(key.id)"
                :d="shape.outer"
                :fill="HOVER"
                pointer-events="none" />
              <!-- The selection, and a copy's dashed outline while Alt-drag places it. -->
              <g v-if="shown.has(key.id) || carried === 'copy'" pointer-events="none">
                <path
                  :d="shape.outer"
                  fill="none"
                  :stroke="HALO"
                  stroke-width="4"
                  vector-effect="non-scaling-stroke" />
                <path
                  :d="shape.outer"
                  fill="none"
                  :stroke="SELECTION"
                  stroke-width="2"
                  :stroke-dasharray="carried === 'copy' ? '4 3' : undefined"
                  vector-effect="non-scaling-stroke" />
              </g>
            </g>
          </g>
          <!-- The focus ring: Sine's, 2px in the one dark, 2px outside the cap's edge. -->
          <path
            v-if="focusRing"
            :d="focusRing.path"
            :transform="`${movingIds.includes(focusRing.key.id) && !duplicating ? `translate(${preview.dx * UNIT} ${preview.dy * UNIT}) ` : ''}${focusRing.shape.transform}`"
            fill="none"
            :stroke="INK"
            stroke-width="2"
            vector-effect="non-scaling-stroke"
            pointer-events="none" />
          <!-- Handles on a single selection, as a native editor draws them; a
               group of keys is shown by its outlines alone, and a key whose
               legend is being typed by its outline. -->
          <g
            v-for="{ key, shape, handles } in selectedIds.length === 1 && !marquee && !editing
              ? keys.filter((item) => selection.has(item.key.id))
              : []"
            :key="`resize-${key.id}`"
            :transform="`${movingIds.includes(key.id) ? `translate(${preview.dx * UNIT} ${preview.dy * UNIT}) ` : ''}${shape.transform}`"
            :data-resize-key-id="key.id"
            :pointer-events="duplicating || spaceHeld ? 'none' : undefined"
            aria-hidden="true">
            <g
              v-for="handle in handles"
              :key="handle.edge"
              :data-resize-edge="handle.edge"
              :style="{ cursor: duplicating ? 'copy' : resizeCursor(handle.edge, key.rotation_angle) }"
              @pointerdown.stop="beginResize($event, key.id, handle.edge)">
              <line
                :x1="handle.x1"
                :y1="handle.y1"
                :x2="handle.x2"
                :y2="handle.y2"
                stroke="transparent"
                :stroke-width="handle.hitStrokeWidth"
                vector-effect="non-scaling-stroke" />
              <rect
                :x="handle.x - handle.hitSize"
                :y="handle.y - handle.hitSize"
                :width="handle.hitSize * 2"
                :height="handle.hitSize * 2"
                fill="transparent" />
              <rect
                :x="handle.x - handle.size / 2"
                :y="handle.y - handle.size / 2"
                :width="handle.size"
                :height="handle.size"
                :rx="handle.size / 4"
                :fill="HALO"
                :stroke="SELECTION"
                stroke-width="1.5"
                pointer-events="none"
                vector-effect="non-scaling-stroke" />
            </g>
          </g>
          <!-- Sine's lasso: a fill-4 field inside a half-strength line of the one dark. -->
          <rect
            v-if="marquee"
            :x="marquee.x"
            :y="marquee.y"
            :width="marquee.width"
            :height="marquee.height"
            :fill="colors.fill[4]"
            :stroke="INK"
            stroke-opacity="0.5"
            stroke-width="1.5"
            vector-effect="non-scaling-stroke"
            pointer-events="none" />
        </svg>
        <!-- The legend being typed, on the cap's anchor for it and turned with the cap. -->
        <div
          v-if="legendPlacement && editing"
          class="absolute left-0 top-0"
          :style="{
            transform: `translate(${legendPlacement.x}px, ${legendPlacement.y}px) rotate(${legendPlacement.angle}deg)`,
            transformOrigin: '0 0',
          }">
          <LegendEditor
            ref="legend-field"
            v-model="editing.text"
            :size="legendPlacement.size"
            :color="legendPlacement.color"
            :anchor="legendPlacement.anchor"
            :min-width="legendPlacement.minWidth"
            :aria-label="legendPlacement.name"
            :aria-describedby="`${prefix}-legend-help`"
            @done="closeLegend(true, true)"
            @cancel="closeLegend(false, true)"
            @step="stepLegend"
            @leave="closeLegend(true, false)" />
        </div>
      </div>
      <p :id="`${prefix}-help`" class="sr-only">
        Select a key, then drag its center to move it or its edges to resize it. Alt-drag duplicates
        keys, and Shift or Control selects several. Enter types the selected key’s legends in place,
        and the inspector edits the selection.
      </p>
      <p :id="`${prefix}-legend-help`" class="sr-only">
        Enter keeps the legend and Escape puts it back. Tab and Shift-Tab go to the cap’s next and
        previous legends.
      </p>
    </div>
    <!-- What the drag has done so far, beside the pointer. -->
    <Teleport to="body">
      <div
        v-if="readout"
        ref="readout-box"
        class="pointer-events-none fixed z-tooltip"
        :style="readoutPosition"
        aria-hidden="true">
        <Squircle
          radius="md"
          shadow="md"
          surface-class="bg-surface-inverse"
          class="flex flex-col gap-0.5 px-2 py-1 text-xs tabular-nums text-ink-inverse">
          <p v-if="readout.title" class="text-ink-inverse-2">{{ readout.title }}</p>
          <dl class="grid grid-cols-[auto_auto_auto_auto] gap-x-1.5 gap-y-0.5">
            <template v-for="[name, value] in readout.values" :key="name">
              <dt class="text-ink-inverse-3">{{ name }}</dt>
              <dd class="min-w-[3em]">{{ signed(value) }}</dd>
            </template>
          </dl>
        </Squircle>
      </div>
    </Teleport>
  </div>
</template>

<style scoped>
.keyboard-stage {
  /* Thin tracks in the scrollbar thumb's own token, as Sine's scroll areas draw. */
  scrollbar-width: thin;
  scrollbar-color: theme("colors.fill.4") transparent;
}
</style>
