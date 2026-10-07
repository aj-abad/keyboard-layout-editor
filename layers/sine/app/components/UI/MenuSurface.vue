<template>
  <Squircle
    :class="cn('dropdown-content', padded && 'p-1')"
    :radius="radius"
    :glass="level"
    v-bind="glassStroke()"
    :style="{ zIndex: z }">
    <slot />
  </Squircle>
</template>

<script setup lang="ts">
import { Squircle } from "../../utils/squircle";
import { glassStroke, menuRadius } from "../../utils/controlSquircle";
import { cn } from "../../utils/cn";

/**
 * The floating surface every menu in the app is drawn on — dropdown menus,
 * context menus, the Select/MultiSelect listboxes and the place-search
 * combobox — as a squircle.
 *
 * ## Use it as the menu's own element, via `as-child`
 *
 * ```vue
 * <DropdownMenuContent as-child :side-offset="6" align="end">
 *   <MenuSurface class="w-64">…</MenuSurface>
 * </DropdownMenuContent>
 * ```
 *
 * Reka's `asChild` merges the content's attrs, handlers and ref onto the first
 * child vnode, so the squircle root *is* the menu element: it carries
 * `data-state`/`data-side`/`data-align`, and `usePrimitiveElement` reaches the
 * real DOM node through `$el`. Wrapping the items in a squircle *inside* the
 * content element would work too, but then the shape and the open/close
 * animation live on two different elements and the layout classes have to be
 * split by hand between them — one element is both smaller and harder to get
 * wrong.
 *
 * The exception is a menu that scrolls: a scrolling root would scroll the
 * squircle's own absolutely-positioned stroke and shadow layers along with the
 * items. The scroller goes *inside* the surface instead, and it is
 * `ScrollArea` with the `max-h-*` on its `viewport-class`
 * (`ChargingStations/FilterChip.vue`, `Overview/AttentionRow.vue`) — never a
 * bare `overflow-auto`, which draws the browser's scrollbar. `UI/Select.vue`
 * and the combobox are the one exception, on Reka's own viewport; see
 * CLAUDE.md § Scrolling.
 *
 * ## Never put `will-change: opacity` (or `filter`) on this
 *
 * The glass is painted on a child layer, so a `will-change` here naming either
 * makes this element a **Backdrop Root** *above* it — permanently, not just
 * while something animates — and the blur then samples an empty backdrop and
 * reads flat. The context menus carried `will-change-[opacity,transform]` from
 * when `.dropdown-content` put the `backdrop-filter` on this same element,
 * where it was harmless (an element is not its own Backdrop Root); moving the
 * filter onto the surface layer is what turned it into a bug. Same rule as the
 * `opacity` one in `sine.css`, and it costs nothing to obey — the open
 * animation is 100ms of `transform`, which Chrome composites anyway.
 *
 * ## `z`, not a `z-*` class
 *
 * `Squircle`'s root carries `z-0` to contain its own negative-z decoration
 * layers, and a fallthrough `z-modal-menu` merely lands *next to* it in the class
 * list — which of the two wins is then down to Tailwind's emit order, not the
 * author's intent. An inline `z-index` outranks both, so the stacking order is
 * stated here as a number instead. The default matches the `z-50` the old
 * `.dropdown-content` carried; menus that must clear a modal (`z-modal`) pass
 * `:z="250"`.
 */

const {
  level = "md",
  rounded = false,
  padded = true,
  z = 50,
} = defineProps<{
  /**
   * The glass level: a blurred, saturated backdrop under a white wash, with the
   * glass shadow, the keyline and the lit rim. `md` is the house menu, for a few
   * commands. `lg` is the level the glass page gives a sheet carrying a list
   * of text, and a list of options is one: its heavier blur and wash keep a
   * row's ink above 4.5:1 at the thin corner even over black, where `md` needs
   * a ground lighter than 18% gray. The select and multi-select lists open at
   * `lg`.
   */
  level?: "md" | "lg";
  /** Match a pill-shaped trigger; steps the radius from `xl` up to `2xl`. */
  rounded?: boolean;
  /**
   * The 4px the surface keeps between its own edge and its items. `false` hands
   * that responsibility inward, to a scroll viewport or a list that pads itself.
   *
   * The one caller that needs it is `UI/Select.vue`'s item-aligned listbox:
   * Reka solves that placement from the `padding-top` of the menu *element*
   * plus the selected row's offset inside the viewport, so an inset sitting
   * between the two is invisible to the arithmetic and lands as a straight
   * vertical offset of the whole menu. Moving the same 4px onto the viewport
   * puts it on the side of that boundary Reka can see across.
   */
  padded?: boolean;
  /** Inline `z-index`. See the note above on why this isn't a class. */
  z?: number;
}>();

const radius = computed(() => menuRadius(rounded));
</script>
