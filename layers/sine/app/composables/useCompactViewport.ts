import { useMediaQuery } from "@vueuse/core";
import { COMPACT_VIEWPORT_QUERY } from "../utils/viewport";

/**
 * Whether the viewport is narrower than Tailwind's `md` — a phone, or a window
 * narrowed to one. One query, so every surface that changes shape below it
 * (the map explorer, a context menu becoming a sheet) changes on the same
 * line rather than on a number each of them remembers differently.
 */
export const useCompactViewport = () => useMediaQuery(COMPACT_VIEWPORT_QUERY);
