/**
 * SteadyHeight lets its content get shorter without the page moving. Seen 2026-11-23: pressing
 * the pay page's steps swapped a long panel for a short one, the page got shorter, and the
 * browser pulled it up under the buyer's finger. It holds only the space that prevents that.
 */
import { render, fireEvent } from '@testing-library/react';
import SteadyHeight from '@/components/ui/SteadyHeight';

// jsdom lays nothing out: the test says how tall things are and where the page is scrolled to.
const page = { content: 0, rest: 400, scrollY: 0 };
const VIEWPORT = 800;
let scrolledBackTo: number | null = null;

beforeAll(() => {
  Object.defineProperty(HTMLElement.prototype, 'offsetHeight', { configurable: true, get: () => page.content });
  // The page with nothing held: everything else on it, plus the content. Never less than the screen.
  Object.defineProperty(document.documentElement, 'scrollHeight', {
    configurable: true,
    get: () => Math.max(page.rest + page.content, VIEWPORT),
  });
  Object.defineProperty(window, 'innerHeight', { configurable: true, value: VIEWPORT });
  Object.defineProperty(window, 'scrollY', { configurable: true, get: () => page.scrollY });
  window.scrollTo = ((_: number, y: number) => {
    scrolledBackTo = y;
    page.scrollY = y;
  }) as typeof window.scrollTo;
});
beforeEach(() => {
  Object.assign(page, { content: 0, rest: 400, scrollY: 0 });
  scrolledBackTo = null;
});

const held = (container: HTMLElement) => (container.firstChild as HTMLElement).style.minHeight;
const scrollTo = (y: number) => {
  page.scrollY = y;
  fireEvent.scroll(window);
};

describe('SteadyHeight', () => {
  it('holds nothing while the content is as tall as it has ever been', () => {
    page.content = 770;
    const { container } = render(<SteadyHeight>a long list</SteadyHeight>);
    scrollTo(370);
    expect(held(container)).toBe('');
  });

  it('holds just enough for the page to still reach the bottom of the screen where it is scrolled to', () => {
    page.content = 770;
    const { container, rerender } = render(<SteadyHeight>a long list</SteadyHeight>);
    // The page is 1170 tall; scrolled to its very end.
    scrollTo(370);

    page.content = 40;
    rerender(<SteadyHeight>one line</SteadyHeight>);

    // Without anything held the page would be 800 tall (the screen), 370 short of where it is
    // scrolled to: the content keeps its own 40 and that 370, not the 770 it once was.
    expect(held(container)).toBe('410px');
  });

  it('holds nothing when the page is not scrolled, however much shorter the content gets', () => {
    page.content = 770;
    const { container, rerender } = render(<SteadyHeight>a long list</SteadyHeight>);

    page.content = 40;
    rerender(<SteadyHeight>one line</SteadyHeight>);

    expect(held(container)).toBe('');
  });

  it('holds less when only part of the height is needed', () => {
    page.rest = 900;
    page.content = 770;
    const { container, rerender } = render(<SteadyHeight>a long list</SteadyHeight>);
    scrollTo(300);

    page.content = 40;
    rerender(<SteadyHeight>one line</SteadyHeight>);

    // 940 tall with nothing held, and the screen ends at 1100: 160 short.
    expect(held(container)).toBe('200px');
  });

  it('hands the space back as the page is scrolled up, and all of it at the top', () => {
    page.content = 770;
    const { container, rerender } = render(<SteadyHeight>a long list</SteadyHeight>);
    scrollTo(370);
    page.content = 40;
    rerender(<SteadyHeight>one line</SteadyHeight>);
    expect(held(container)).toBe('410px');

    scrollTo(200);
    expect(held(container)).toBe('240px');
    scrollTo(0);
    expect(held(container)).toBe('');
  });

  it('puts the page back where it was if measuring let the browser pull it up', () => {
    page.content = 770;
    const { rerender } = render(<SteadyHeight>a long list</SteadyHeight>);
    scrollTo(370);

    // What a browser does when the page gets shorter than where it is scrolled to.
    page.content = 40;
    page.scrollY = 0;
    rerender(<SteadyHeight>one line</SteadyHeight>);

    expect(scrolledBackTo).toBe(370);
  });

  // A partner mounts the pay page in their own app, where a box may scroll rather than the page.
  describe('inside a box that scrolls, on a page that does not', () => {
    const box = { scrollTop: 0, rest: 300 };
    const BOX_SHOWS = 500;
    const inABox = (children: React.ReactNode) => (
      <div data-testid="box" style={{ overflowY: 'auto', height: BOX_SHOWS }}>
        {children}
      </div>
    );
    const theBox = (container: HTMLElement) => container.querySelector('[data-testid="box"]') as HTMLElement;
    const wire = (element: HTMLElement) => {
      Object.defineProperty(element, 'clientHeight', { configurable: true, get: () => BOX_SHOWS });
      Object.defineProperty(element, 'scrollHeight', {
        configurable: true,
        get: () => Math.max(box.rest + page.content, BOX_SHOWS),
      });
      Object.defineProperty(element, 'scrollTop', {
        configurable: true,
        get: () => box.scrollTop,
        set: (y: number) => {
          box.scrollTop = y;
        },
      });
    };
    const heldIn = (container: HTMLElement) => (theBox(container).firstChild as HTMLElement).style.minHeight;

    beforeEach(() => Object.assign(box, { scrollTop: 0, rest: 300 }));

    it('holds what keeps the box where it is scrolled to, and puts it back there', () => {
      page.content = 770;
      const { container, rerender } = render(inABox(<SteadyHeight>a long list</SteadyHeight>));
      wire(theBox(container));
      // The box's content is 1070 tall; scrolled to its end.
      box.scrollTop = 570;
      fireEvent.scroll(theBox(container));

      // Shorter, and the browser pulls the box up as it would.
      page.content = 40;
      box.scrollTop = 0;
      rerender(inABox(<SteadyHeight>one line</SteadyHeight>));

      // 500 tall with nothing held (the box's own height), 570 short of where it was scrolled to.
      expect(heldIn(container)).toBe('610px');
      expect(box.scrollTop).toBe(570);
      // The window was never scrolled, and is left alone.
      expect(scrolledBackTo).toBeNull();

      box.scrollTop = 0;
      fireEvent.scroll(theBox(container));
      expect(heldIn(container)).toBe('');
    });
  });

  it('stops holding when taller content comes back', () => {
    page.content = 770;
    const { container, rerender } = render(<SteadyHeight>a long list</SteadyHeight>);
    scrollTo(370);
    page.content = 40;
    rerender(<SteadyHeight>one line</SteadyHeight>);

    page.content = 770;
    rerender(<SteadyHeight>a long list</SteadyHeight>);
    expect(held(container)).toBe('');
  });
});
