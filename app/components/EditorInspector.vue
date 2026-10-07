<script setup lang="ts">
import { computed, nextTick, ref, useId, useTemplateRef } from "vue";
import Collapsible from "#layers/sine/app/components/UI/Collapsible.vue";
import CollapsibleContent from "#layers/sine/app/components/UI/CollapsibleContent.vue";
import CollapsibleTrigger from "#layers/sine/app/components/UI/CollapsibleTrigger.vue";
import Divider from "#layers/sine/app/components/UI/Divider.vue";
import FieldLabel from "#layers/sine/app/components/UI/FieldLabel.vue";
import InlineInput from "#layers/sine/app/components/UI/InlineInput.vue";
import Input from "#layers/sine/app/components/UI/Input.vue";
import ScrollArea from "#layers/sine/app/components/UI/ScrollArea.vue";
import Select from "#layers/sine/app/components/UI/Select.vue";
import Toggle from "#layers/sine/app/components/UI/Toggle.vue";
import type { Key, Layout } from "../utils/layout";
import { layoutBounds } from "../utils/layout";
import { legendName, LEGEND_SLOTS } from "../utils/legends";

/**
 * The inspector describes what is selected, as a native editor's does: the
 * keys' legends, appearance, geometry and options while keys are selected,
 * and the layout itself while nothing is. Every field commits on `change`
 * (Enter, a step or leaving it), so one edit is one undo step.
 */
const props = defineProps<{ selected: Key[]; layout: Layout }>();
const emit = defineEmits<{
  update: [patch: Partial<Key>];
  legend: [index: number, text: string];
  defaults: [property: "textColor" | "textSize", value: string | number];
  meta: [patch: Record<string, string>];
}>();

const first = computed(() => props.selected[0]);
const heading = computed(() => {
  const count = props.selected.length;
  return count === 0 ? "Layout" : count === 1 ? "Key" : `${count} keys`;
});

// -- Reading a selection ----------------------------------------------------

/** The selection's value, or `undefined` where the keys disagree. */
function shared<T>(read: (key: Key) => T): T | undefined {
  const initial = first.value && read(first.value);
  return props.selected.every((key) => read(key) === initial) ? initial : undefined;
}
const valueOf = (field: keyof Key) => shared((key) => key[field]);
const display = (value: unknown) => (value === undefined ? "" : String(value));

// -- Legends ------------------------------------------------------------------

/** The twelve slots in KLE's order, laid out as they sit on the cap. */
const FACE = LEGEND_SLOTS.slice(0, 9);
const FRONT = LEGEND_SLOTS.slice(9);

const legendOf = (index: number) => shared((key) => key.labels[index] ?? "");
function legendChange(index: number, event: Event) {
  emit("legend", index, (event.target as HTMLInputElement).value);
}

const legends = useTemplateRef<HTMLElement>("legends");
/** Put the caret in the first legend the keys use, or the top left one: a double-click's edit. */
async function focusLegends() {
  await nextTick();
  const used = [...FACE, ...FRONT].find(({ index }) => legendOf(index));
  const input = legends.value?.querySelector<HTMLInputElement>(
    `[data-legend="${used?.index ?? 0}"]`,
  );
  input?.focus();
  input?.select();
}
defineExpose({ focusLegends });

// -- Numbers ------------------------------------------------------------------

/**
 * A number commits when it is one: finite, and over the field's floor. A step
 * that isn't a quarter unit is still a position KLE can hold, so the field's
 * `step` sets the arrows' increment and refuses nothing.
 */
function numberChange(field: keyof Key, event: Event, min?: number) {
  const input = event.target as HTMLInputElement;
  const next = Number(input.value);
  if (input.value.trim() !== "" && Number.isFinite(next) && (min === undefined || next >= min))
    emit("update", { [field]: next });
  else input.value = display(valueOf(field));
}

const GEOMETRY = [
  { field: "x", label: "X", step: 0.25 },
  { field: "y", label: "Y", step: 0.25 },
  { field: "width", label: "Width", step: 0.25, min: 0.25 },
  { field: "height", label: "Height", step: 0.25, min: 0.25 },
] as const;
/** `name` is the field's whole name, where its pill can only hold the end of it. */
const ROTATION = [
  { field: "rotation_angle", label: "Angle", name: "Rotation angle", step: 1 },
  { field: "rotation_x", label: "X", name: "Rotation origin X", step: 0.25 },
  { field: "rotation_y", label: "Y", name: "Rotation origin Y", step: 0.25 },
] as const;
const SECONDARY = [
  { field: "x2", label: "X", name: "Second rectangle X", step: 0.25 },
  { field: "y2", label: "Y", name: "Second rectangle Y", step: 0.25 },
  { field: "width2", label: "Width", name: "Second rectangle width", step: 0.25, min: 0.25 },
  { field: "height2", label: "Height", name: "Second rectangle height", step: 0.25, min: 0.25 },
] as const;
const secondaryOpen = ref(false);

// -- Appearance ---------------------------------------------------------------

const PROFILES = ["DCS", "DSA", "SA", "OEM", "CHICKLET", "FLAT"] as const;
const PROFILE_OPTIONS = [
  { value: "default", label: "Default" },
  ...PROFILES.map((value) => ({
    value,
    label: value.length > 3 ? value[0] + value.slice(1).toLowerCase() : value,
  })),
];
/** A profile names its family and may carry a row (`DCS R1`); the select shows the family. */
const profileOf = (key: Key) =>
  new RegExp(`\\b(${PROFILES.join("|")})\\b`, "i").exec(key.profile)?.[1]?.toUpperCase() ??
  "default";
const profile = computed(() => shared(profileOf) ?? "");
function profileChange(value: string) {
  if (value && value !== profile.value) emit("update", { profile: value === "default" ? "" : value });
}

const legendSize = computed(() => shared((key) => key.default.textSize));
function legendSizeChange(event: Event) {
  const input = event.target as HTMLInputElement;
  const size = Number(input.value);
  if (Number.isInteger(size) && size >= 1 && size <= 9) emit("defaults", "textSize", size);
  else input.value = display(legendSize.value);
}

const FLAGS = [
  { field: "nub", label: "Homing marker" },
  { field: "ghost", label: "Ghost key" },
  { field: "stepped", label: "Stepped key" },
  { field: "decal", label: "Decal" },
] as const;

// -- The layout ---------------------------------------------------------------

const notesId = useId();
const metaChange = (field: string, event: Event) =>
  emit("meta", { [field]: (event.target as HTMLInputElement).value });
const bounds = computed(() => layoutBounds(props.layout));
const formatUnits = (value: number) => String(Math.round(value * 100) / 100);
</script>

<template>
  <div class="flex h-full min-h-0 flex-col">
    <header class="flex h-12 shrink-0 items-center gap-3 border-b px-4">
      <h2 class="type-label min-w-0 flex-1 truncate text-ink">{{ heading }}</h2>
      <p v-if="!selected.length" class="type-caption flex shrink-0 gap-3 tabular-nums">
        <span>{{ layout.keys.length }} {{ layout.keys.length === 1 ? "key" : "keys" }}</span>
        <span v-if="layout.keys.length">{{ formatUnits(bounds.width) }} × {{ formatUnits(bounds.height) }} u</span>
      </p>
    </header>
    <ScrollArea root-class="min-h-0 flex-1" label="Inspector">
      <!-- The selection's keys. -->
      <div v-if="selected.length" class="flex flex-col pb-4">
        <section class="flex flex-col gap-3 p-4" aria-labelledby="inspector-legends">
          <h3 id="inspector-legends" class="type-label">Legends</h3>
          <div ref="legends" class="flex flex-col gap-3">
            <div class="grid grid-cols-3 gap-1">
              <Input
                v-for="slot in FACE"
                :key="slot.index"
                size="sm"
                :data-legend="slot.index"
                :aria-label="legendName(slot.index)"
                :model-value="legendOf(slot.index) ?? ''"
                :placeholder="legendOf(slot.index) === undefined ? 'Mixed' : undefined"
                :class="slot.align"
                autocomplete="off"
                @change="legendChange(slot.index, $event)" />
            </div>
            <div class="flex flex-col gap-1">
              <p class="type-caption">Front</p>
              <div class="grid grid-cols-3 gap-1">
                <Input
                  v-for="slot in FRONT"
                  :key="slot.index"
                  size="sm"
                  :data-legend="slot.index"
                  :aria-label="legendName(slot.index)"
                  :model-value="legendOf(slot.index) ?? ''"
                  :placeholder="legendOf(slot.index) === undefined ? 'Mixed' : undefined"
                  :class="slot.align"
                  autocomplete="off"
                  @change="legendChange(slot.index, $event)" />
              </div>
            </div>
          </div>
        </section>

        <Divider inset="none" />

        <section class="flex flex-col gap-3 p-4" aria-labelledby="inspector-appearance">
          <h3 id="inspector-appearance" class="type-label">Appearance</h3>
          <div class="grid grid-cols-2 gap-x-2 gap-y-3">
            <ColorField
              label="Keycap"
              :value="String(first?.color ?? '')"
              :mixed="valueOf('color') === undefined"
              @change="emit('update', { color: $event })" />
            <ColorField
              label="Legends"
              :value="first?.default.textColor ?? ''"
              :mixed="shared((key) => key.default.textColor) === undefined"
              @change="emit('defaults', 'textColor', $event)" />
            <Input
              label="Legend size"
              size="sm"
              type="number"
              spin-buttons
              min="1"
              max="9"
              step="1"
              :model-value="display(legendSize)"
              :placeholder="legendSize === undefined ? 'Mixed' : undefined"
              @change="legendSizeChange" />
            <Select
              label="Profile"
              size="sm"
              :options="PROFILE_OPTIONS"
              :model-value="profile"
              placeholder="Mixed"
              @update:model-value="profileChange" />
          </div>
        </section>

        <Divider inset="none" />

        <section class="flex flex-col gap-3 p-4" aria-labelledby="inspector-geometry">
          <h3 id="inspector-geometry" class="type-label">Position and size</h3>
          <div class="number-pills grid grid-cols-2 gap-2 text-sm tabular-nums">
            <InlineInput
              v-for="control in GEOMETRY"
              :key="control.field"
              :label="control.label"
              type="number"
              :step="control.step"
              :min="'min' in control ? control.min : undefined"
              :model-value="display(valueOf(control.field))"
              :placeholder="valueOf(control.field) === undefined ? 'Mixed' : undefined"
              class="w-0 min-w-0"
              @change="numberChange(control.field, $event, 'min' in control ? control.min : undefined)" />
          </div>
          <h4 class="type-caption pt-1">Rotation, in degrees, about an origin in units</h4>
          <div class="number-pills grid grid-cols-2 gap-2 text-sm tabular-nums">
            <!-- The angle on its own row, its origin's two coordinates under it. -->
            <div
              v-for="control in ROTATION"
              :key="control.field"
              :class="control.field === 'rotation_angle' && 'col-span-2'">
              <InlineInput
                :label="control.label"
                :aria-label="control.name"
                type="number"
                :step="control.step"
                :model-value="display(valueOf(control.field))"
                :placeholder="valueOf(control.field) === undefined ? 'Mixed' : undefined"
                class="w-0 min-w-0"
                @change="numberChange(control.field, $event)" />
            </div>
          </div>
          <Collapsible v-model:open="secondaryOpen">
            <CollapsibleTrigger variant="quiet" size="sm">Second rectangle</CollapsibleTrigger>
            <CollapsibleContent>
              <div class="number-pills grid grid-cols-2 gap-2 pt-2 text-sm tabular-nums">
                <InlineInput
                  v-for="control in SECONDARY"
                  :key="control.field"
                  :label="control.label"
                  :aria-label="control.name"
                  type="number"
                  :step="control.step"
                  :min="'min' in control ? control.min : undefined"
                  :model-value="display(valueOf(control.field))"
                  :placeholder="valueOf(control.field) === undefined ? 'Mixed' : undefined"
                  class="w-0 min-w-0"
                  @change="numberChange(control.field, $event, 'min' in control ? control.min : undefined)" />
              </div>
            </CollapsibleContent>
          </Collapsible>
        </section>

        <Divider inset="none" />

        <section class="flex flex-col gap-1 p-4" aria-labelledby="inspector-options">
          <h3 id="inspector-options" class="type-label pb-2">Options</h3>
          <div
            v-for="flag in FLAGS"
            :key="flag.field"
            class="flex min-h-8 items-center justify-between gap-3">
            <span class="type-body-sm">{{ flag.label }}</span>
            <Toggle
              size="sm"
              :aria-label="flag.label"
              :checked="valueOf(flag.field) === true"
              @update:checked="emit('update', { [flag.field]: $event })" />
          </div>
        </section>
      </div>

      <!-- Nothing selected: the layout itself. -->
      <div v-else class="flex flex-col pb-4">
        <section class="fields p-4 pb-0" aria-labelledby="inspector-details">
          <h3 id="inspector-details" class="type-label pb-2">Details</h3>
          <Input
            label="Name"
            size="sm"
            :model-value="layout.meta.name"
            placeholder="Untitled layout"
            autocomplete="off"
            @change="metaChange('name', $event)" />
          <Input
            label="Author"
            size="sm"
            :model-value="layout.meta.author"
            autocomplete="off"
            @change="metaChange('author', $event)" />
          <div class="group flex flex-col">
            <FieldLabel label="Notes" :for="notesId" class="px-3" />
            <textarea
              :id="notesId"
              class="min-h-28 resize-y rounded-lg bg-surface px-3 py-2 type-body-sm text-ink outline-none ring-1 ring-inset ring-line placeholder:text-ink-4 focus:ring-2 focus:ring-surface-inverse"
              :value="layout.meta.notes"
              @change="metaChange('notes', $event)" />
          </div>
        </section>
        <section class="flex flex-col gap-3 p-4" aria-labelledby="inspector-plate">
          <h3 id="inspector-plate" class="type-label">Plate</h3>
          <ColorField
            label="Background"
            :value="layout.meta.backcolor"
            @change="emit('meta', { backcolor: $event })" />
        </section>
        <p class="type-caption px-4 pt-2">
          Select keys to edit their legends, colors and shape. Shift-click or drag a box to select
          several.
        </p>
      </div>
    </ScrollArea>
  </div>
</template>

<style scoped>
/* A pill's room is its value's: the arrow keys step it, so the browser's own
   spinner isn't drawn, as Sine's `Input` hides it too. */
.number-pills :deep(input[type="number"]) {
  appearance: textfield;
}
.number-pills :deep(input[type="number"]::-webkit-inner-spin-button),
.number-pills :deep(input[type="number"]::-webkit-outer-spin-button) {
  appearance: none;
  margin: 0;
}
</style>
