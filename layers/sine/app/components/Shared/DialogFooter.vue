<script lang="ts">
import { Comment, Fragment, Text, cloneVNode, defineComponent, h, isVNode, type VNode } from "vue";
import Button from "../UI/Button.vue";
import { RADIUS } from "../../utils/controlSquircle";
import type { SquircleRadius } from "../../utils/squircle";

// Count rendered actions, including v-if/v-for fragments, without counting
// comments or whitespace. Slot functions are evaluated during render only.
const actions = (nodes: VNode[]): VNode[] =>
  nodes.flatMap((node) => {
    if (node.type === Comment || (node.type === Text && !String(node.children).trim())) return [];
    if (node.type === Fragment && Array.isArray(node.children))
      return actions(node.children.filter(isVNode));
    return [node];
  });

/**
 * The corners a cell inherits from the sheet it is cut from: the sheet's own at
 * the strip's two ends, square where a cell meets its neighbour.
 *
 * The shape belongs to the cells rather than to the strip because a cell draws
 * its own fill *and* its own focus stroke on it. A strip that clipped them
 * instead could keep a fill inside the sheet's corner, but not a ring — an
 * outline is a rectangle whatever the box beneath it is, so the corner arrived
 * cut off rather than curved.
 */
const cellRadius = (index: number, count: number): SquircleRadius => [
  "none",
  "none",
  index === count - 1 ? RADIUS.sheet : "none",
  index === 0 ? RADIUS.sheet : "none",
];

export default defineComponent({
  name: "DialogFooter",
  setup(_, { slots }) {
    return () => {
      const nodes = actions(slots.default?.() ?? []);
      if (!nodes.length) return null;
      const segmented = nodes.length <= 2 && nodes.every((node) => node.type === Button);

      if (!segmented)
        return h(
          "div",
          {
            class: "flex shrink-0 flex-wrap items-center justify-end gap-2 border-t p-4",
            "data-dialog-footer": "group",
          },
          nodes,
        );

      return h(
        "div",
        {
          class: "relative grid h-12 shrink-0 grid-flow-col auto-cols-fr border-t",
          "data-dialog-footer": "segmented",
        },
        [
          // The divider belongs to the strip, not to either cell: a CSS border
          // on a cell would sit outside that cell's padding box, which is where
          // a `Squircle` positions the surface and stroke layers it clips to —
          // so the fill and the focus ring would land a pixel off the box they
          // are drawn for.
          //
          // It is drawn *before* the cells, and that ordering is the whole of
          // its z-order: a cell is a `Squircle`, so it stacks at `z-index: 0`,
          // and a positioned sibling at `auto` paints in tree order with it.
          // Last, the hairline covered the outer pixel of the right cell's
          // focus stroke, leaving a 2px ring reading as 1px down that edge.
          // First, it shows through cells that are transparent until they are
          // pointed at, and the ring covers it instead.
          nodes.length > 1
            ? h("span", {
                key: "divider",
                "data-dialog-divider": "",
                class: "pointer-events-none absolute inset-y-0 left-1/2 w-px bg-line",
                "aria-hidden": "true",
              })
            : null,
          // The strip owns the sheet's metrics — 48px, 14px text, an 18px icon —
          // so it states the size rather than leaving them to a call site's
          // `size`.
          nodes.map((node, index) =>
            cloneVNode(node, {
              shape: "cell",
              size: "sm",
              cellRadius: cellRadius(index, nodes.length),
            }),
          ),
        ],
      );
    };
  },
});
</script>
