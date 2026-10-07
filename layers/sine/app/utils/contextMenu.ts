import type { ComputedRef, FunctionalComponent, InjectionKey, Ref } from "vue";
import type { ReferenceElement } from "reka-ui";
import { safeAreaInsetBottom } from "./viewport";

/**
 * The rules every context menu in the app shares, and the seam between
 * `UI/ContextMenu.vue` (the root) and `UI/ContextMenuContent.vue` (the
 * surface).
 *
 * The decisions here are about the *browser's* menu as much as ours: an
 * operator right-clicking a text field wants cut, paste and the spellchecker,
 * and one right-clicking a selection wants Copy and "Search for…" — neither of
 * which this app can draw. So the rule is that text keeps the browser's menu
 * and everything else gets one of ours, and these helpers are how a
 * `contextmenu` handler tells the two apart.
 */

/**
 * An entity a link stands for, as the host app's entity chips carry it. The
 * portal defines it beside its digest entities; the menu only needs its shape.
 */
export interface EntityReference {
  kind: string;
  id: string;
  label: string;
}

export type AppContextMenuTarget =
  | { kind: "page" }
  | { kind: "link"; href: string }
  | { kind: "entity"; href: string; entity: EntityReference };

export const ENTITY_LINK_SELECTOR = "a[data-entity-kind][data-entity-id]";

/** Render a canonical menu's rows inside an already-mounted menu surface. */
export const ContextMenuItems: FunctionalComponent = (_, { slots }) => slots.default?.();

/**
 * What a `ContextMenu` hands its `beforeOpen` listener: the right-click, and
 * a way to leave it alone. A list reads the row off `event.target` here and
 * declines when there is nothing under the pointer, so the event carries on
 * to an enclosing menu, or to the app's own.
 */
export interface ContextMenuOpenRequest {
  event: MouseEvent;
  decline: () => void;
}

/** What the root provides to its content. */
export interface ContextMenuContext {
  /** A zero-size element at the point the menu grows from. */
  anchor: ComputedRef<ReferenceElement>;
  /** Drawn as a sheet from the bottom edge rather than a popper at the point. */
  sheet: Ref<boolean>;
  isOpen: Ref<boolean>;
  /** For the content's `close-auto-focus`: back to where focus was, unless a click took it elsewhere. */
  restoreFocus: (event: Event) => void;
  /** For the content's `interact-outside`. */
  noteInteractOutside: () => void;
}

export const CONTEXT_MENU_KEY: InjectionKey<ContextMenuContext> = Symbol("ContextMenu");

/** What `ContextMenuSub` provides to its content: the way back out of it. */
export interface ContextMenuSubContext {
  close: () => void;
}

export const CONTEXT_MENU_SUB_KEY: InjectionKey<ContextMenuSubContext> = Symbol("ContextMenuSub");

/**
 * The sheet's geometry. A sheet is an inset card — the iOS action sheet, not
 * the flush Android one — so it needs no corner treatment and no overhang
 * below the viewport: `SHEET_GUTTER` either side and below, plus the safe-area
 * inset underneath, and at most `SHEET_HEIGHT_RATIO` of the viewport before
 * its body scrolls.
 */
export const SHEET_GUTTER = 12;
export const SHEET_HEIGHT_RATIO = 0.7;

/** The sheet's bottom edge, measured up from the viewport's. */
export const sheetBottomInset = () => SHEET_GUTTER + safeAreaInsetBottom();

/**
 * Where a sheet anchors: the band the gutter leaves along the bottom of the
 * viewport, so `side="top"` sits a sheet on it and `align="center"` fits a
 * sheet of the band's width between the gutters. Read at every measurement,
 * so a rotation or a keyboard moves the sheet with the viewport.
 */
export const sheetReference = (
  viewportWidth: number,
  viewportHeight: number,
): ReferenceElement => ({
  getBoundingClientRect: () => {
    const bottom = sheetBottomInset();
    return {
      x: SHEET_GUTTER,
      y: viewportHeight - bottom,
      width: viewportWidth - SHEET_GUTTER * 2,
      height: bottom,
      top: viewportHeight - bottom,
      bottom: viewportHeight,
      left: SHEET_GUTTER,
      right: viewportWidth - SHEET_GUTTER,
    };
  },
});

/**
 * A submenu's sheet cannot be told where to sit — Reka pins a submenu to the
 * right of, and level with, its reference — so it is handed a one-pixel
 * reference at the sheet's bottom-left corner and Reka's own collision
 * shifting does the rest: level with the corner overflows the bottom, and the
 * content is shifted up until it fits the padded boundary, which lands it
 * exactly on the gutter. See `ContextMenuSubContent`.
 */
export const sheetSubReference = (viewportHeight: number): ReferenceElement => ({
  getBoundingClientRect: () => {
    const y = viewportHeight - sheetBottomInset() - 1;
    return {
      x: SHEET_GUTTER - 1,
      y,
      width: 1,
      height: 1,
      top: y,
      bottom: y + 1,
      left: SHEET_GUTTER - 1,
      right: SHEET_GUTTER,
    };
  },
});

/**
 * Reka's own marker on every menu content it renders — dropdowns, context
 * menus, this one — which is what makes "an open menu" one selector.
 */
export const MENU_CONTENT_SELECTOR = "[data-reka-menu-content]";

/**
 * The `<input>` types that hold no text. Every other type — including the
 * dates and numbers, whose menus carry paste and undo like any field — keeps
 * the browser's menu.
 */
const BUTTON_LIKE_INPUTS = new Set([
  "button",
  "submit",
  "reset",
  "checkbox",
  "radio",
  "range",
  "color",
  "file",
  "image",
]);

/** Whether the element is, or sits inside, something the operator types into. */
export const isTextField = (element: Element): boolean => {
  // `isContentEditable` is inherited, so a paragraph inside a rich-text
  // editor's root answers for the root.
  if (element instanceof HTMLElement && element.isContentEditable) return true;
  const field = element.closest("input, textarea");
  if (field instanceof HTMLTextAreaElement) return true;
  return field instanceof HTMLInputElement && !BUTTON_LIKE_INPUTS.has(field.type);
};

/**
 * Whether a viewport point falls on the current text selection. Tested against
 * the selection's own boxes rather than its ancestor, since a right-click
 * beside a selected word — on the card that holds it — is a right-click on the
 * card, and the browser's own menu draws the same distinction.
 */
export const isPointInSelection = (x: number, y: number): boolean => {
  const selection = window.getSelection();
  if (!selection || selection.isCollapsed) return false;
  for (let index = 0; index < selection.rangeCount; index++) {
    for (const rect of selection.getRangeAt(index).getClientRects()) {
      if (x >= rect.left && x <= rect.right && y >= rect.top && y <= rect.bottom) return true;
    }
  }
  return false;
};

/**
 * Whether a right-click is the browser's to answer: Shift held (the escape
 * hatch to Inspect and "Save as…"), a text field, or a selection under the
 * pointer. Every `ContextMenu` asks this before opening, so the answer is
 * the same on a station row as on the page.
 */
export const keepsNativeContextMenu = (event: MouseEvent): boolean => {
  if (event.shiftKey) return true;
  const target = event.target instanceof Element ? event.target : null;
  if (target && isTextField(target)) return true;
  return isPointInSelection(event.clientX, event.clientY);
};

/**
 * The link under an element: the nearest `<a href>` whose target a new tab
 * could open. `href` is the resolved absolute URL, which is what a new tab and
 * the clipboard both want.
 */
export const linkAt = (element: Element): string | null => {
  const anchor = element.closest("a[href]");
  if (!(anchor instanceof HTMLAnchorElement)) return null;
  return anchor.protocol === "http:" || anchor.protocol === "https:" ? anchor.href : null;
};

export const contextMenuTarget = (element: Element | null): AppContextMenuTarget => {
  const href = element ? linkAt(element) : null;
  const chip = element?.closest<HTMLElement>(ENTITY_LINK_SELECTOR);
  const kind = chip?.dataset.entityKind;
  const id = chip?.dataset.entityId;
  if (href && id && (kind === "station" || kind === "location")) {
    return {
      kind: "entity",
      href,
      entity: { kind, id, label: chip.dataset.entityLabel ?? chip.textContent?.trim() ?? id },
    };
  }
  return href ? { kind: "link", href } : { kind: "page" };
};

/**
 * Where a menu anchors: the pointer, or — when the keyboard opened it with
 * Shift+F10 or the Menu key, which some browsers report at (0, 0) — the
 * bottom-left corner of the focused element, where a native menu would land.
 */
export const contextMenuAnchor = (event: MouseEvent): { x: number; y: number } => {
  if (event.clientX || event.clientY) return { x: event.clientX, y: event.clientY };
  const rect = event.target instanceof Element ? event.target.getBoundingClientRect() : null;
  return rect ? { x: rect.left, y: rect.bottom } : { x: 0, y: 0 };
};

/**
 * At most one context menu is open, anywhere — the invariant the browser's own
 * menus have and independent Reka roots could not keep (2026-09-14: the map's,
 * a location row's and the app's were all open at once). A root registers
 * itself as it opens, which closes whichever was open; it unregisters as it
 * closes. `close` is told it is yielding, so the menu it closes does not put
 * focus back on the row it came from — the new menu is about to take it.
 */
export interface OpenContextMenu {
  close: (reason: "yielded") => void;
}

let openMenu: OpenContextMenu | null = null;

export const registerOpenContextMenu = (menu: OpenContextMenu) => {
  if (openMenu === menu) return;
  openMenu?.close("yielded");
  openMenu = menu;
};

export const unregisterOpenContextMenu = (menu: OpenContextMenu) => {
  if (openMenu === menu) openMenu = null;
};
