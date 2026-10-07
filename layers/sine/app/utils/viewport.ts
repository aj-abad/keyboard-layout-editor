/**
 * Below Tailwind's `md` (768px): a phone, or a window narrowed to one. The
 * map explorer goes compact on the same line, and a context menu becomes a
 * sheet — see `useCompactViewport()`.
 */
export const COMPACT_VIEWPORT_QUERY = "(max-width: 767px)";

/**
 * The bottom safe-area inset — the home indicator's strip on a phone without
 * a home button — as a number. CSS can read `env(safe-area-inset-bottom)`
 * and JavaScript cannot, so `assets/sine.css` copies it onto a custom
 * property on the root and this reads that back. Zero everywhere the browser
 * reports none.
 */
export const safeAreaInsetBottom = (): number => {
  if (typeof document === "undefined") return 0;
  const value = getComputedStyle(document.documentElement).getPropertyValue(
    "--safe-area-inset-bottom",
  );
  const px = Number.parseFloat(value);
  return Number.isFinite(px) ? px : 0;
};
