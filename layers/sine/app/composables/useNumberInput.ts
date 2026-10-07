import { computed, onScopeDispose, type Ref } from "vue";

type Direction = -1 | 1;

/**
 * A held control repeats after a pause, then at a steady rate — the native
 * spinner's own cadence, close enough that a hold on ours feels like a hold
 * on the browser's. The pause is what separates a click from a hold.
 */
export const HOLD_DELAY_MS = 400;
export const HOLD_INTERVAL_MS = 60;

interface NumberInputOptions {
  enabled: boolean;
  disabled: boolean;
  readonly: boolean;
  value: string | number | undefined;
  min?: string | number;
  max?: string | number;
  step?: string | number;
}

const decimals = (text: string): number => {
  const dot = text.indexOf(".");
  return dot === -1 ? 0 : text.length - dot - 1;
};

/**
 * The stepped value, padded to the decimal places the step is written with:
 * `step="0.50"` writes "25.00" where the native algorithm hands back "25",
 * so a money field keeps reading as money. Only ever pads — a value already
 * finer than the step is left as native alignment produced it.
 */
const padToStep = (value: string, step: string | number | undefined): string => {
  const want = decimals(String(step ?? ""));
  return decimals(value) >= want ? value : Number(value).toFixed(want);
};

/** Native stepping owns decimal rounding, step alignment and bounds. */
export const useNumberInput = (
  input: Ref<HTMLInputElement | null>,
  options: () => NumberInputOptions,
) => {
  const nextValues = computed<Record<Direction, string | null>>(() => {
    const state = options();
    const values: Record<Direction, string | null> = { [-1]: null, 1: null };
    if (!state.enabled || state.disabled || state.readonly || !input.value) return values;

    // Probe a detached copy so checking a boundary never edits the real input
    // or publishes an intermediate value. Props may be ahead of Vue's DOM patch.
    const probe = input.value.cloneNode(false) as HTMLInputElement;
    probe.type = "number";
    probe.min = String(state.min ?? "");
    probe.max = String(state.max ?? "");
    probe.step = String(state.step ?? "");
    if (probe.step.toLowerCase() === "any") return values;

    for (const direction of [-1, 1] as const) {
      probe.value = String(state.value ?? "");
      const previous = probe.value;
      if (direction === 1) probe.stepUp();
      else probe.stepDown();
      if (probe.value !== "" && (previous === "" || Number(probe.value) !== Number(previous))) {
        values[direction] = padToStep(probe.value, state.step);
      }
    }
    return values;
  });

  const spin = (direction: Direction) => {
    const element = input.value;
    const value = nextValues.value[direction];
    if (!element || value === null) return;
    element.focus({ preventScroll: true });
    element.value = value;
    // The same model, input and change listeners as a native edit, once each.
    element.dispatchEvent(new Event("input", { bubbles: true }));
    element.dispatchEvent(new Event("change", { bubbles: true }));
  };

  const onKeydown = (event: KeyboardEvent) => {
    if (!options().enabled || event.altKey || event.ctrlKey || event.metaKey || event.shiftKey)
      return;
    if (event.key !== "ArrowUp" && event.key !== "ArrowDown") return;
    event.preventDefault();
    spin(event.key === "ArrowUp" ? 1 : -1);
  };

  // A held control: one step at once, then the rest on a timer. The release
  // is read off `window`, not the control — the pointer may leave it, and the
  // control goes disabled the moment a boundary is reached, after which the
  // browser sends it no pointer events at all. The loop also stops itself
  // there, so a hold at the edge never spins on nothing.
  let holdTimer: ReturnType<typeof setTimeout> | null = null;
  const RELEASE_EVENTS = ["pointerup", "pointercancel", "blur"] as const;

  const endHold = () => {
    if (holdTimer !== null) clearTimeout(holdTimer);
    holdTimer = null;
    for (const type of RELEASE_EVENTS) window.removeEventListener(type, endHold);
  };

  const startHold = (direction: Direction) => {
    endHold();
    spin(direction);
    if (nextValues.value[direction] === null) return;
    for (const type of RELEASE_EVENTS) window.addEventListener(type, endHold);
    const repeat = () => {
      if (nextValues.value[direction] === null) return endHold();
      spin(direction);
      holdTimer = setTimeout(repeat, HOLD_INTERVAL_MS);
    };
    holdTimer = setTimeout(repeat, HOLD_DELAY_MS);
  };

  onScopeDispose(endHold);

  return { nextValues, spin, startHold, endHold, onKeydown };
};
