import { useEffect, useLayoutEffect, useRef, type ReactNode } from 'react';

/**
 * Lets its content get shorter without the page moving under whoever pressed the thing that
 * shortened it.
 *
 * ⚠️ FOR CONTENT THAT IS SWAPPED IN PLACE BY A PRESS: steps, tabs, one answer or another. A page
 *    that gets shorter under a buyer who has scrolled down is pulled up by the browser (there is
 *    no longer anything that far down to show), and the buttons they were pressing move from
 *    under their finger; pressing back makes it longer again and leaves them somewhere else. On
 *    the pay page the three steps did exactly that, the first being a long list of companies and
 *    the third one line: the row of steps moved by up to 588px a press (measured 2026-11-23).
 *
 * ⚠️ ONLY AS MUCH SPACE AS KEEPS THE VIEW WHERE IT IS, AND ONLY FOR AS LONG. It first kept the
 *    height of the tallest thing it had shown, for good, which left a screenful of nothing under
 *    a one-line step. What is needed is far less: enough that what scrolls still reaches the
 *    bottom of its own view at the place it is scrolled to. That is often nothing at all
 *    (nothing scrolled needs none), and it is handed back as the buyer scrolls up, when the
 *    space being removed is below the bottom of the view and nothing they can see moves.
 *
 * ⚠️ WHATEVER SCROLLS, NOT ONLY THE WINDOW. A partner mounts the pay page in their own app, and
 *    there it may sit in a box that scrolls (a checkout panel, a drawer) rather than on a page
 *    that does. Every scrolling thing this is inside is looked after, the window included: each
 *    is pulled up the same way when its content gets shorter than where it is scrolled to. (In
 *    a partner's iframe the frame's own window is what scrolls, which is the ordinary case.)
 */

/** Something that scrolls: the window, or an element with its own scrollbar. */
interface Scroller {
  /** What its scroll events arrive on. */
  target: Window | HTMLElement;
  at: () => number;
  /** How much of the content it shows at once. */
  shows: () => number;
  /** How tall its content is. */
  holds: () => number;
  moveTo: (y: number) => void;
}

const theWindow = (): Scroller => ({
  target: window,
  at: () => window.scrollY,
  shows: () => window.innerHeight,
  holds: () => document.documentElement.scrollHeight,
  moveTo: (y) => window.scrollTo(0, y),
});

const theElement = (element: HTMLElement): Scroller => ({
  target: element,
  at: () => element.scrollTop,
  shows: () => element.clientHeight,
  holds: () => element.scrollHeight,
  moveTo: (y) => {
    element.scrollTop = y;
  },
});

/** Everything `from` is inside that scrolls up and down, nearest first, the window last. */
function scrollersAround(from: HTMLElement): Scroller[] {
  const found: Scroller[] = [];
  for (let parent = from.parentElement; parent && parent !== document.body && parent !== document.documentElement; parent = parent.parentElement) {
    if (/^(auto|scroll|overlay)$/.test(getComputedStyle(parent).overflowY)) found.push(theElement(parent));
  }
  return [...found, theWindow()];
}

export default function SteadyHeight({ children, className }: { children: ReactNode; className?: string }) {
  const outer = useRef<HTMLDivElement>(null);
  const content = useRef<HTMLDivElement>(null);
  /** What scrolls around this, each with where it was before the content last changed (where it
   *  is to stay) and how tall its content is with nothing held, as last measured. */
  const around = useRef<{ scroller: Scroller; scrolledTo: number; natural: number }[] | null>(null);

  /** Hold exactly what keeps every scroller reaching the bottom of its view where it is. */
  const hold = () => {
    const box = outer.current;
    const inner = content.current;
    if (!box || !inner || !around.current) return;
    let missing = 0;
    for (const { scroller, scrolledTo, natural } of around.current) {
      if (scrolledTo > 0) missing = Math.max(missing, scrolledTo + scroller.shows() - natural);
    }
    // More than a pixel: scroll positions are fractional, and something scrolled to its own end
    // comes out a fraction "short" of itself.
    const wanted = missing > 1 ? `${inner.offsetHeight + missing}px` : '';
    if (box.style.minHeight !== wanted) box.style.minHeight = wanted;
  };

  /** The content changed: measure with nothing held, then hold what is needed. */
  const settle = () => {
    const box = outer.current;
    if (!box) return;
    if (!around.current) {
      around.current = scrollersAround(box).map((scroller) => ({ scroller, scrolledTo: scroller.at(), natural: 0 }));
    }
    box.style.minHeight = '';
    for (const each of around.current) each.natural = each.scroller.holds();
    hold();
    // Measuring let the browser pull things up; put them back before anything is painted.
    for (const { scroller, scrolledTo } of around.current) {
      if (scroller.at() !== scrolledTo) scroller.moveTo(scrolledTo);
    }
  };

  // Before the browser paints the new content: a swap is a render.
  useLayoutEffect(settle);

  useEffect(() => {
    const scrollers = around.current ?? [];
    // Scrolling up hands the held space back; nothing is measured, so nothing can move.
    const onScroll = () => {
      for (const each of scrollers) each.scrolledTo = each.scroller.at();
      hold();
    };
    for (const { scroller } of scrollers) scroller.target.addEventListener('scroll', onScroll, { passive: true });
    window.addEventListener('resize', settle);
    // Content also changes height with no render here: a list that arrives, an image that loads.
    const observer = typeof ResizeObserver === 'undefined' || !content.current ? null : new ResizeObserver(settle);
    if (observer && content.current) observer.observe(content.current);
    return () => {
      for (const { scroller } of scrollers) scroller.target.removeEventListener('scroll', onScroll);
      window.removeEventListener('resize', settle);
      observer?.disconnect();
    };
    // The handlers read refs only.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div ref={outer} className={className}>
      <div ref={content}>{children}</div>
    </div>
  );
}
