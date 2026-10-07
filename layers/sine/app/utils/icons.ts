import type { iconSize } from "../../tailwind.config";

/** The shared icon size ladder; choose a native Nucleo cut for UI glyphs. */
export type IconSize = (typeof iconSize)[number];

/** Shared props for generated Nucleo artwork and compatible custom marks. */
export interface NucleoIconProps {
  /** Native grid by default: 18 for UI glyphs, 12 for inline details. */
  size?: number | string;
  /** Opacity of the secondary layer in a duo cut. */
  duoOpacity?: number;
}
