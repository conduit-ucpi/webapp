/**
 * Keeps Privy's modal inside the part of our page a visitor can actually see, when the page is
 * in a partner's iframe.
 *
 * ⚠️ WHY IT GOES MISSING. Privy lays its modal out against the frame's own viewport: centred in
 *    it on a wide frame, and pinned to its BOTTOM edge on a narrow one (a drawer). A partner's
 *    frame is a fixed 760px or more, usually taller than the window showing it, so the middle or
 *    the bottom of the frame is often scrolled out of sight — and the modal with it. The visitor
 *    presses "Continue with email" and nothing appears to happen.
 *
 * A framed page cannot read the parent's scroll position, but an IntersectionObserver with no
 * root reports how much of an element the top-level window is showing, across origins. Watching
 * a marker the size of the frame gives the visible slice in the frame's own coordinates; the
 * modal's container is then confined to that slice, and Privy centres (or bottom-pins) within it.
 *
 * Imports nothing from Privy: it knows only the id Privy gives its modal's content.
 */

const MODAL_CONTENT_ID = 'privy-modal-content';
/** How long to keep looking for the modal after it is said to be open: it mounts a moment later. */
const FIND_MODAL_FOR_MS = 2000;
/** Fine steps, so the observer reports again as the parent page scrolls. */
const THRESHOLDS = Array.from({ length: 51 }, (_, i) => i / 50);

interface Slice {
  top: number;
  height: number;
}

/** Privy's full-frame container: the nearest fixed-position ancestor of the modal's content. */
function modalContainer(): HTMLElement | null {
  let node = document.getElementById(MODAL_CONTENT_ID)?.parentElement ?? null;
  while (node && node !== document.body) {
    if (window.getComputedStyle(node).position === 'fixed') return node;
    node = node.parentElement;
  }
  return null;
}

function confine(container: HTMLElement, slice: Slice): void {
  // Important, because Privy's own rules are `inset: 0` and `min-height: 100dvh`.
  container.style.setProperty('top', `${slice.top}px`, 'important');
  container.style.setProperty('bottom', 'auto', 'important');
  container.style.setProperty('height', `${slice.height}px`, 'important');
  container.style.setProperty('min-height', '0', 'important');
}

/**
 * Start keeping the modal in view. Call when the modal opens; call the returned function when it
 * closes. Does nothing where there is no IntersectionObserver.
 */
export function keepModalInView(): () => void {
  if (typeof window === 'undefined' || typeof IntersectionObserver === 'undefined') return () => {};

  // The size of the frame's viewport, and invisible. What is seen of it is what is seen of us.
  const marker = document.createElement('div');
  marker.setAttribute('aria-hidden', 'true');
  marker.style.cssText = 'position:fixed;inset:0;pointer-events:none;opacity:0;z-index:-1';
  document.body.appendChild(marker);

  let slice: Slice | null = null;
  let stopped = false;
  let frame = 0;

  const apply = (): void => {
    const container = modalContainer();
    if (container && slice) confine(container, slice);
  };

  const observer = new IntersectionObserver(
    (entries) => {
      const rect = entries[entries.length - 1]?.intersectionRect;
      // Nothing of the frame on screen: leave the modal where Privy put it.
      if (!rect || rect.height < 1) return;
      slice = { top: rect.top, height: rect.height };
      apply();
    },
    { threshold: THRESHOLDS }
  );
  observer.observe(marker);

  // The first report can arrive before Privy has mounted the modal; keep trying until it has.
  const started = Date.now();
  const waitForModal = (): void => {
    if (stopped) return;
    apply();
    if (!modalContainer() && Date.now() - started < FIND_MODAL_FOR_MS) {
      frame = window.requestAnimationFrame(waitForModal);
    }
  };
  frame = window.requestAnimationFrame(waitForModal);

  return () => {
    stopped = true;
    window.cancelAnimationFrame(frame);
    observer.disconnect();
    marker.remove();
  };
}
