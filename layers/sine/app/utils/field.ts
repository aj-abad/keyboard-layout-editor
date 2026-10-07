/**
 * The field contract — the wiring every labelled control shares.
 *
 * A *field* is a name, a control, and a chin: the description that tells the
 * operator what to put in, and the error that says why what they put in was
 * refused. Before this, only `UI/Input.vue` had all three, `UI/Select.vue` had
 * two of them spelled differently, and `UI/Checkbox.vue`, `UI/OTPInput.vue` and
 * `UI/InlineInput.vue` had none — so a description under a select was a
 * hand-written `<p>` at the call site, described to nobody. There are 133 of
 * those paragraphs in `app/components`.
 *
 * What has to be identical between controls is not the layout — a checkbox's
 * name sits beside it and an input's sits above — but the *relationships*: which
 * node names the control, which nodes describe it, and what a screen reader is
 * told when an error appears. Those are ids and ARIA attributes, which is
 * exactly what this composable owns. Presentation lives in `UI/FieldLabel.vue`
 * and `UI/FieldChin.vue`; a control composes all three.
 *
 * See `docs/design-system.md` § Fields.
 */

export interface FieldState {
  /** Standing help: what to put in the control. Shown until the value is refused. */
  description?: string;
  /** Why the current value was refused. Shown in the description's place. */
  error?: string;
  /** The control's `chin` slot has content — a rich description. */
  chin?: boolean;
  /**
   * The value is required. States the constraint to assistive technology; it
   * draws nothing, because the house marks the *optional* fields (see
   * `UI/FieldLabel.vue`). A filter is neither required nor optional.
   */
  required?: boolean;
}

/**
 * Ids and ARIA for one field.
 *
 * `state` is a getter rather than an object so it stays reactive through
 * `defineProps` destructuring, which is how every control in `UI/` reads its
 * props.
 */
export const useField = (state: () => FieldState) => {
  const attrs = useAttrs();
  const id = useId();

  const labelId = `${id}-label`;
  const descriptionId = `${id}-description`;
  const errorId = `${id}-error`;

  const hasDescription = computed(() => Boolean(state().description) || Boolean(state().chin));
  const hasError = computed(() => Boolean(state().error));
  const hasChin = computed(() => hasDescription.value || hasError.value);

  /**
   * The caller's own `aria-describedby` is *merged*, never replaced. A field can
   * legitimately point at something outside itself — a shared note under a group
   * of fields, a live availability check — and `UI/Select.vue` used to drop that
   * on the floor by assigning its error id over the top.
   *
   * Of the field's own two it names the one on screen: the error while the
   * value is refused, the description otherwise. The error covers the
   * description in the chin (`UI/FieldChin.vue`), so a screen reader hears what
   * the screen shows, and the error carries what the description said.
   */
  const describedBy = computed(() => {
    const ids = [
      attrs["aria-describedby"] as string | undefined,
      hasError.value ? errorId : hasDescription.value ? descriptionId : undefined,
    ].filter(Boolean);

    return ids.length > 0 ? ids.join(" ") : undefined;
  });

  /**
   * Absent rather than `"false"` when the field is fine. `aria-invalid="false"`
   * is the default state, so writing it out adds a node to the accessibility
   * tree that says nothing.
   */
  const invalid = computed(() => (hasError.value ? ("true" as const) : undefined));

  /**
   * `aria-required` only — never the native `required` attribute. The native one
   * hands the browser its own validation bubble, drawn in Chrome's chrome rather
   * than in this system's, and fired at a moment the app does not control. The
   * app validates and passes `error`; this is the same fact told to assistive
   * technology.
   */
  const ariaRequired = computed(() => (state().required ? ("true" as const) : undefined));

  return {
    id,
    labelId,
    descriptionId,
    errorId,
    hasDescription,
    hasError,
    hasChin,
    describedBy,
    invalid,
    ariaRequired,
  };
};

export type Field = ReturnType<typeof useField>;
