<template>
  <div ref="root" class="select-root group relative" :class="containerClass" data-select>
    <SelectRoot v-model="model" :open="isOpen" :disabled="disabled" @update:open="handleOpenChange">
      <FieldLabel
        v-if="label"
        :label="label"
        :id="labelId"
        :optional="optional"
        class="select-label" />
      <div class="relative" :class="label && 'mt-1'">
        <SelectTrigger
          :primitive="SelectTriggerPrimitive"
          :size="size"
          :rounded="rounded"
          :disabled="disabled"
          :trigger-class="triggerClass"
          :position="position"
          :focus-returning="returning"
          :sizing-labels="sizingLabels"
          :aria-label="ariaLabel"
          :aria-labelledby="label ? labelId : undefined"
          :aria-invalid="field.invalid.value"
          :aria-required="field.ariaRequired.value"
          :aria-describedby="field.describedBy.value">
          <SelectValue
            :placeholder="placeholder || 'Select…'"
            :class="cn('block truncate', selectedText === null && 'text-ink-4')">
            {{ selectedText ?? (placeholder || "Select…") }}
          </SelectValue>
        </SelectTrigger>
        <SelectPortal>
          <!-- The listbox is the shared `UI/MenuSurface.vue` squircle in both
               positions, and the scroll lives on the viewport inside it rather
               than on the surface: a scrolling surface would scroll the
               squircle's own stroke and shadow layers away from the items. The
               viewport is Reka's own rather than `ScrollArea`: it hides the
               native scrollbar itself, pages with the scroll buttons, and the
               aligned positioner reads its scroll geometry.

               Which positioner runs is the only difference, and `contentProps`
               below is where the two are spelled out — including the fact that
               only one of them honours `as-child`, so in `aligned` the squircle
               is a child of Reka's own menu element rather than being it.

               The list is not modal: a click outside it closes it and lands
               where it was aimed, so a click on the next trigger in a filter bar
               opens that one in the same click. Reka's select is modal twice
               over, through its layer and its body scroll lock, and both are
               switched off here; `useOutsideClickFocus` keeps the focus where
               the click landed. -->
          <SelectContent
            v-bind="contentProps"
            :body-lock="false"
            :disable-outside-pointer-events="false"
            @pointer-down-outside="onPointerDownOutside"
            @close-auto-focus="onCloseAutoFocus">
            <!-- Glass at `lg`, the level for a list of text: its blur and wash
                 keep a row's ink above 4.5:1 over whatever the list opens on. -->
            <MenuSurface
              level="lg"
              :rounded="rounded"
              :padded="false"
              :z="MENU_Z"
              :class="
                cn(
                  'flex min-h-0 flex-col outline-none',
                  aligned ? 'flex-1' : 'min-w-[var(--reka-select-trigger-width)]',
                )
              ">
              <!-- Reka hides the viewport's scrollbar unconditionally
                   (`[data-reka-select-viewport]{scrollbar-width:none}`), so these
                   are a scrolling list's only affordance — the same arrows a
                   native pop-up menu grows when it outruns the screen. Each
                   renders only while there is something to scroll to, which is
                   also what keeps them off the viewport's flush top and bottom
                   edges until there is scrolled content to clip there; and the
                   first one to mount asks the aligned positioner to re-solve and
                   re-focus the selected row. -->
              <SelectScrollUpButton class="flex h-5 items-center justify-center text-ink-4">
                <IconNucleoChevronUp12 :size="12" />
              </SelectScrollUpButton>
              <!-- The surface's inset lives here rather than on the surface —
                   see `padded` on `UI/MenuSurface.vue`. A `max-h-*` is Popper's
                   alone: the aligned positioner sets a height on the fixed
                   wrapper it adds and gives the menu `max-height: 100%` of it, so
                   a cap here would hold the box short of the height the
                   alignment was solved for and slide every row off the trigger.
                   `overscroll-contain` keeps a scroll that reaches the list's
                   end from running on into the page, which would close it. -->
              <SelectViewport :class="cn('overscroll-contain p-1', !aligned && 'max-h-60')">
                <template v-if="clearable">
                  <!-- The empty value's row, in the muted ink a list on glass
                       takes: `ink-4` falls under 4.5:1 there once the backdrop
                       darkens, `ink-3` holds. Chosen, it keeps that ink and takes
                       the check and the weight. -->
                  <SelectItem
                    :value="CLEAR_VALUE"
                    :class="
                      cn(
                        'menu-item relative cursor-pointer select-none pr-8 text-ink-3 data-[state=checked]:font-medium data-[state=checked]:text-ink-3',
                        selectRowInset[size],
                      )
                    ">
                    <SelectItemIndicator class="absolute right-2 inline-flex items-center">
                      <IconNucleoCheck12 :size="12" />
                    </SelectItemIndicator>
                    <SelectItemText class="block truncate">{{ clearLabel }}</SelectItemText>
                  </SelectItem>
                  <SelectSeparator v-if="options?.length" class="mx-1 my-1 h-px bg-line" />
                </template>
                <SelectItem
                  v-for="option in options"
                  :key="option.value"
                  :value="option.value"
                  :disabled="option.disabled"
                  :class="
                    cn(
                      'menu-item relative cursor-pointer select-none pr-8 data-[disabled]:pointer-events-none data-[state=checked]:font-medium data-[disabled]:opacity-50',
                      selectRowInset[size],
                    )
                  ">
                  <SelectItemIndicator class="absolute right-2 inline-flex items-center">
                    <IconNucleoCheck12 :size="12" />
                  </SelectItemIndicator>
                  <SelectItemText class="block truncate">{{ option.label }}</SelectItemText>
                </SelectItem>
              </SelectViewport>
              <SelectScrollDownButton class="flex h-5 items-center justify-center text-ink-4">
                <IconNucleoChevronDown12 :size="12" />
              </SelectScrollDownButton>
            </MenuSurface>
          </SelectContent>
        </SelectPortal>
      </div>
    </SelectRoot>
    <FieldChin
      :description="description"
      :error="error"
      :description-id="field.descriptionId"
      :error-id="field.errorId" />
  </div>
</template>

<script setup lang="ts">
import {
  SelectContent,
  SelectItem,
  SelectItemIndicator,
  SelectItemText,
  SelectPortal,
  SelectRoot,
  SelectScrollDownButton,
  SelectScrollUpButton,
  SelectSeparator,
  SelectTrigger as SelectTriggerPrimitive,
  SelectValue,
  SelectViewport,
} from "reka-ui";
import { useEventListener } from "@vueuse/core";
import IconNucleoCheck12 from "../Icon/Nucleo/Check12.vue";
import IconNucleoChevronDown12 from "../Icon/Nucleo/ChevronDown12.vue";
import IconNucleoChevronUp12 from "../Icon/Nucleo/ChevronUp12.vue";
import { pushShortcutBlocker, popShortcutBlocker } from "../../composables/commandRegistry";
import { selectRowInset, type SelectTriggerVariants } from "../../utils/selectVariants";
import FieldLabel from "./FieldLabel.vue";
import SelectTrigger from "./SelectTrigger.vue";
import { cn } from "../../utils/cn";
import MenuSurface from "./MenuSurface.vue";
import FieldChin from "./FieldChin.vue";
import { useField } from "../../utils/field";
import { useOutsideClickFocus } from "../../composables/useOutsideClickFocus";

type SelectVariants = SelectTriggerVariants;

export interface SelectOption {
  value: string;
  label: string;
  disabled?: boolean;
}

interface Props {
  options?: SelectOption[];
  placeholder?: string;
  error?: string;
  disabled?: boolean;
  size?: NonNullable<SelectVariants["size"]>;
  /** Pill instead of `rounded-lg`, matching `UI/Input.vue`'s `rounded`. */
  rounded?: boolean;
  containerClass?: string;
  triggerClass?: string;
  label?: string;
  /** Standing help under the trigger — see `UI/FieldChin.vue`. */
  description?: string;
  /** Draw the "Optional" marker beside the label — see `UI/FieldLabel.vue`. */
  optional?: boolean;
  /** `aria-required` on the trigger. A filter select is neither required nor optional. */
  required?: boolean;
  /**
   * Which edge of the trigger the menu lines up with — Reka's `align` on the
   * anchored menu, and what `.dropdown-content` reads as `data-align` to grow
   * the menu from the right corner. `start` is the house default; `end` is for
   * a trigger sitting against the right edge of a toolbar, where a menu wider
   * than it would otherwise run off.
   *
   * `position="aligned"` has no use for it and is not given it: that positioner
   * lays the selected row's text under the trigger's value text, which is one
   * placement rather than three. Reka drops it there in any case.
   */
  align?: "start" | "center" | "end";
  /**
   * Where the listbox opens, which is also what the trigger's caret says.
   *
   * `aligned` is the house default and the macOS pop-up button: the menu opens
   * *over* the trigger with the current value's row sitting on top of it, so the
   * choice the operator is about to change never moves, and the keyboard focus
   * that lands on that row lands where they were already looking. Reka solves
   * the rest — it clamps to the viewport and scrolls the selected row as close
   * to the trigger as the screen allows, which is what the arrows are for. The
   * list runs above the trigger as well as below it, so the caret is the pop-up
   * button's pair of chevrons, and it holds still: the list covers it. The
   * trigger's ring goes while the list lies on it.
   *
   * `popper` is the anchored menu below the trigger, under a down chevron that
   * turns while the list is open, and the trigger keeps its ring. Reach for it
   * where the trigger's surroundings must stay visible while the list is open —
   * a filter sitting over a map or a chart the operator is reading against.
   *
   * `UI/MultiSelect.vue` is `popper` and only `popper`: aligning a listbox on
   * "the selected row" needs there to be exactly one.
   */
  position?: "aligned" | "popper";
  clearable?: boolean;
  clearLabel?: string;
  ariaLabel?: string;
}

const {
  options = [],
  placeholder,
  error,
  disabled,
  size = "md",
  rounded = false,
  containerClass,
  triggerClass,
  label,
  description,
  optional = false,
  required = false,
  align = "start",
  position = "aligned",
  clearable = false,
  clearLabel = "None",
  ariaLabel,
} = defineProps<Props>();

// Defaulted rather than left optional so the emitted value stays a plain
// `string` — callers bind `@update:model-value` to `(value: string) => …`.
const modelValue = defineModel<string>({ default: "" });

const CLEAR_VALUE = "__clear__";

const aligned = computed(() => position === "aligned");

/** `z-modal-menu` — a select opens from inside dialogs. See `UI/MenuSurface.vue`. */
const MENU_Z = 250;

/**
 * Every string the trigger can show, so it is as wide as the widest and holds
 * that width: the options, the placeholder, and the clear row's label.
 */
const sizingLabels = computed(() => [
  placeholder || "Select…",
  ...options.map((option) => option.label),
  ...(clearable ? [clearLabel] : []),
]);

/**
 * The two positioners, and everything that differs between them.
 *
 * `popper`: the squircle *is* the menu element through `as-child`, so it
 * carries `data-side`/`data-align` for `.dropdown-content`'s scale origin and
 * reads Popper's `--reka-select-trigger-width`.
 *
 * `item-aligned` ignores `as-child` — reka-ui 2.10.1's `SelectContentImpl`
 * forwards the positioner's own props only when `position === "popper"`, so
 * `asChild` is dropped on the floor there — which means the menu element is a
 * plain div of Reka's and the squircle is inside it. That div takes the layer,
 * and `.dropdown-aligned` marks it for the entrance, which is declared on its
 * parent: see the rule in `sine.css` for why it has to be. It takes
 * `.dropdown-content` from neither end — the squircle inside still carries it,
 * and putting it here as well would run that class's corner scale on the way
 * out, beside the fade. It needs neither of Popper's two: the positioner sets
 * `min-width` on the fixed wrapper it adds from the trigger's own rect, and
 * there is no side to grow from when the menu is on top of its anchor.
 */
const contentProps = computed(() =>
  aligned.value
    ? {
        position: "item-aligned" as const,
        class: "dropdown-aligned flex min-h-0 flex-col",
        style: { zIndex: MENU_Z },
      }
    : { position: "popper" as const, asChild: true, sideOffset: 4, align },
);

const model = computed({
  get: () => {
    const v = modelValue.value ?? "";
    return clearable && v === "" ? CLEAR_VALUE : v;
  },
  set: (value) => {
    modelValue.value = value === CLEAR_VALUE ? "" : (value ?? "");
  },
});

/**
 * What the trigger says, or null for the placeholder. Reka reads a label off
 * the option's own row, which exists only once the list has been drawn, and
 * the list is drawn in the browser only: a server-rendered page would say the
 * placeholder until it hydrated. The options carry their labels already.
 */
const selectedText = computed(() => {
  const value = modelValue.value ?? "";
  if (value === "") return clearable ? clearLabel : null;
  return options.find((option) => option.value === value)?.label ?? null;
});

const field = useField(() => ({ description, error, required }));
const labelId = field.labelId;

const root = useTemplateRef<HTMLElement>("root");
const { returning, onOpenChange, onPointerDownOutside, onCloseAutoFocus } = useOutsideClickFocus(
  () => root.value?.querySelector(".select-trigger-button"),
);

const isOpen = shallowRef(false);
const handleOpenChange = (open: boolean) => {
  if (open === isOpen.value) return;
  isOpen.value = open;
  onOpenChange(open);
  if (open) pushShortcutBlocker();
  else popShortcutBlocker();
};

onUnmounted(() => {
  if (isOpen.value) popShortcutBlocker();
});

/**
 * Without the scroll lock the page can scroll under an open list. A popper list
 * follows its trigger; the aligned one is fixed where it opened, so a scroll
 * anywhere but inside a list closes it.
 */
useEventListener(
  "scroll",
  (event: Event) => {
    if (!isOpen.value || !aligned.value) return;
    if (event.target instanceof Element && event.target.closest("[role='listbox']")) return;
    handleOpenChange(false);
  },
  { capture: true, passive: true },
);
</script>

<style scoped lang="postcss">
/* `UI/FieldLabel.vue` already brightens the name on `group-focus-within`. This
   covers the case it cannot see: the menu is portalled, so while it is open the
   focus has left this root entirely, and it comes back only once the list's
   exit ends. */
.select-root:has(.select-trigger-button[data-state="open"]) .select-label,
.select-root:has(.select-trigger--returning) .select-label {
  @apply text-ink;
}
</style>
