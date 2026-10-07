import { durationMs } from "./motion";

/**
 * The house exit for a surface that carries `.dropdown-content` outside Reka:
 * the shell’s tool popover and its dock. Reka flips `data-state` to `closed`
 * and unmounts after the animation; a `<Transition :css="false">` leave hook
 * does the same here. A surface on its way out is already gone to the
 * keyboard and the screen reader, so it is made inert and hidden for the
 * frames it is still drawn. Reduced motion turns the keyframes off, and the
 * timeout then ends the leave on its own.
 */
export const exitDropdownContent = (element: Element, done: () => void): void => {
  let finished = false;
  const finish = () => {
    if (finished) return;
    finished = true;
    done();
  };
  element.setAttribute("data-state", "closed");
  element.setAttribute("aria-hidden", "true");
  element.setAttribute("inert", "");
  element.addEventListener("animationend", finish, { once: true });
  window.setTimeout(finish, durationMs.base + 50);
};
