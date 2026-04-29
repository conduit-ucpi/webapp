import { render } from '@testing-library/react';
import DisputeModal from '@/components/contracts/DisputeModal';

describe('DisputeModal opacity', () => {
  const defaultProps = {
    isOpen: true,
    onClose: jest.fn(),
    onSubmit: jest.fn(),
  };

  // Headless UI's Dialog renders into a portal on document.body. The
  // Dialog.Panel is the element wrapping the title "Raise a Dispute" — find it
  // by walking up from the title heading.
  const queryDialogPanel = () => {
    const headings = document.body.querySelectorAll('h3');
    for (const h of Array.from(headings)) {
      if (h.textContent === 'Raise a Dispute') {
        // Walk up to the Dialog.Panel (the element that has the panel surface
        // classes like rounded-2xl).
        let el: HTMLElement | null = h.parentElement;
        while (el && !el.className.includes('rounded-2xl')) {
          el = el.parentElement;
        }
        return el;
      }
    }
    return null;
  };

  const queryBackdrop = () => {
    // The backdrop is the fixed inset-0 element that is NOT the dialog itself
    // and contains the bg-black class.
    const candidates = document.body.querySelectorAll('div.fixed.inset-0');
    for (const el of Array.from(candidates)) {
      if (el.className.includes('bg-black')) {
        return el as HTMLElement;
      }
    }
    return null;
  };

  it('renders an opaque panel background in light mode (bg-white)', () => {
    render(<DisputeModal {...defaultProps} />);
    const panel = queryDialogPanel();
    expect(panel).not.toBeNull();
    // The panel must have a solid light-mode background class. Translucent
    // classes like bg-white/50 or bg-opacity-* on the panel would let dashboard
    // content bleed through and obscure the form fields.
    expect(panel!.className).toMatch(/\bbg-white\b/);
    expect(panel!.className).not.toMatch(/bg-white\/\d+/);
    expect(panel!.className).not.toMatch(/bg-opacity-/);
  });

  it('renders an opaque panel background in dark mode (dark:bg-secondary-800)', () => {
    render(<DisputeModal {...defaultProps} />);
    const panel = queryDialogPanel();
    expect(panel).not.toBeNull();
    // Without an explicit dark-mode background, the panel falls through to a
    // transparent default and the dashboard underneath is visible through the
    // form. Require an explicit dark surface class.
    expect(panel!.className).toMatch(/\bdark:bg-secondary-800\b/);
  });

  it('darkens the dashboard behind the modal with at least 50% backdrop opacity', () => {
    render(<DisputeModal {...defaultProps} />);
    const backdrop = queryBackdrop();
    expect(backdrop).not.toBeNull();
    // bg-opacity-25 left the dashboard too visible behind the modal. Require
    // at least 50% so the form stands out clearly in both light and dark mode.
    const match = backdrop!.className.match(/bg-opacity-(\d+)/);
    expect(match).not.toBeNull();
    expect(parseInt(match![1], 10)).toBeGreaterThanOrEqual(50);
  });
});
