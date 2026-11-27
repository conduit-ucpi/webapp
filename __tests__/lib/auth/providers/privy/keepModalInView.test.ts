/**
 * In a partner's frame, Privy's modal is confined to the part of the frame the window is showing.
 */
import { keepModalInView } from '@/lib/auth/providers/privy/keepModalInView';

type Callback = (entries: Array<{ intersectionRect: { top: number; height: number } }>) => void;

let report: Callback;
const disconnect = jest.fn();

beforeEach(() => {
  document.body.innerHTML = '';
  disconnect.mockClear();
  (window as any).IntersectionObserver = class {
    constructor(callback: Callback) {
      report = callback;
    }
    observe() {}
    disconnect = disconnect;
  };
  window.requestAnimationFrame = ((fn: FrameRequestCallback) => setTimeout(() => fn(0), 0)) as any;
  window.cancelAnimationFrame = ((id: number) => clearTimeout(id)) as any;
});

/** Privy's markup, as far as this cares: a fixed full-frame container around the modal content. */
function mountModal(): HTMLElement {
  const container = document.createElement('div');
  container.style.position = 'fixed';
  container.innerHTML = '<div><div id="privy-modal-content"></div></div>';
  document.body.appendChild(container);
  return container;
}

it('confines the modal to the visible slice of the frame', () => {
  const container = mountModal();
  const stop = keepModalInView();

  report([{ intersectionRect: { top: 120, height: 400 } }]);

  expect(container.style.top).toBe('120px');
  expect(container.style.height).toBe('400px');
  expect(container.style.bottom).toBe('auto');
  expect(container.style.minHeight).toBe('0');
  stop();
});

it('follows the parent page as it scrolls', () => {
  const container = mountModal();
  const stop = keepModalInView();

  report([{ intersectionRect: { top: 0, height: 500 } }]);
  report([{ intersectionRect: { top: 260, height: 500 } }]);

  expect(container.style.top).toBe('260px');
  stop();
});

it('applies a slice reported before the modal has mounted', async () => {
  const stop = keepModalInView();
  report([{ intersectionRect: { top: 80, height: 300 } }]);

  const container = mountModal();
  await new Promise((resolve) => setTimeout(resolve, 20));

  expect(container.style.top).toBe('80px');
  stop();
});

it('leaves the modal alone when none of the frame is on screen', () => {
  const container = mountModal();
  const stop = keepModalInView();

  report([{ intersectionRect: { top: 0, height: 0 } }]);

  expect(container.style.top).toBe('');
  stop();
});

it('stops watching and removes its marker when the modal closes', () => {
  const stop = keepModalInView();
  expect(document.querySelector('[aria-hidden="true"]')).not.toBeNull();

  stop();

  expect(disconnect).toHaveBeenCalled();
  expect(document.querySelector('[aria-hidden="true"]')).toBeNull();
});
