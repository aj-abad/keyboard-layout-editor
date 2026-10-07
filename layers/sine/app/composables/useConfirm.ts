/**
 * Promise-based confirmation for actions that are destructive, hard to walk
 * back, or reach real hardware.
 *
 * Singleton state driving the one `<SharedConfirmDialog />` mounted in
 * `app.vue`, so a call site gates an action with a single `await` instead of
 * carrying its own dialog, open-state ref and cancel path:
 *
 * ```ts
 * if (!(await confirm({ title: "Hard reset 12 stations?", message: … }))) return;
 * ```
 *
 * Reserve it for things that are disruptive or hard to walk back — discarding
 * an edited form, rebooting a charger mid-session, taking sites out of service.
 * Routine, reversible actions should stay one click.
 *
 * A prompt with a third way out — Save beside Discard and Keep editing — passes
 * `alternativeLabel` and gets the choice back by name instead of a boolean:
 *
 * ```ts
 * const choice = await confirm({ …, confirmLabel: "Discard", alternativeLabel: "Save" });
 * if (choice === "cancel") return false;
 * if (choice === "alternative") return await save();
 * ```
 */

export interface ConfirmOptions {
  title: string;
  /** Spell out the blast radius: how many things change, and what breaks. */
  message: string;
  confirmLabel?: string;
  cancelLabel?: string;
  /** Renders the confirm button in the destructive variant. */
  destructive?: boolean;
}

/**
 * A prompt whose question has an answer besides yes and no: Save, where the
 * confirm is Discard. The alternative resolves the situation without doing
 * what the prompt is gating, so it takes the primary weight and the last
 * place; the confirm keeps its own weight beside it, and the dismissal goes
 * to a ghost. Three actions is the padded footer group, never the cells.
 */
export interface ConfirmChoiceOptions extends ConfirmOptions {
  alternativeLabel: string;
}

export type ConfirmChoice = "confirm" | "alternative" | "cancel";

interface Confirm {
  (options: ConfirmChoiceOptions): Promise<ConfirmChoice>;
  (options: ConfirmOptions): Promise<boolean>;
}

const state = reactive({
  isOpen: false,
  title: "",
  message: "",
  confirmLabel: "Confirm",
  cancelLabel: "Cancel",
  alternativeLabel: null as string | null,
  destructive: false,
});

let resolveCurrent: ((choice: ConfirmChoice) => void) | null = null;

const settle = (choice: ConfirmChoice) => {
  state.isOpen = false;
  resolveCurrent?.(choice);
  resolveCurrent = null;
};

const ask = (options: ConfirmOptions | ConfirmChoiceOptions): Promise<ConfirmChoice> => {
  // Nobody can answer on the server, and this prompt would be every request's
  // there: a render that asks is declined at once.
  if (import.meta.server) return Promise.resolve("cancel");
  // Opening a second prompt over a live one would strand the first caller's
  // promise unresolved forever. Decline it before taking the dialog over.
  resolveCurrent?.("cancel");

  state.title = options.title;
  state.message = options.message;
  state.confirmLabel = options.confirmLabel ?? "Confirm";
  state.cancelLabel = options.cancelLabel ?? "Cancel";
  state.alternativeLabel = "alternativeLabel" in options ? options.alternativeLabel : null;
  state.destructive = options.destructive ?? false;
  state.isOpen = true;

  return new Promise<ConfirmChoice>((resolve) => {
    resolveCurrent = resolve;
  });
};

const confirm = ((options: ConfirmOptions | ConfirmChoiceOptions) =>
  "alternativeLabel" in options
    ? ask(options)
    : ask(options).then((choice) => choice === "confirm")) as Confirm;

export const useConfirm = () => ({
  state: readonly(state),
  confirm,
  accept: () => settle("confirm"),
  /** Also the path for Escape, the overlay and the close button. */
  decline: () => settle("cancel"),
  chooseAlternative: () => settle("alternative"),
});
