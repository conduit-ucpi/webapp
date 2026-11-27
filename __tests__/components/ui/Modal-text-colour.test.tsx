/**
 * The panel is white in dark mode too, and html.dark sets `color-scheme: dark`, which turns the
 * browser's default text white. Anything in it with no colour of its own, like the wallet address
 * in ExpandableHash, came out white on white until the panel set its own text colour.
 */
import { render, screen } from '@testing-library/react';
import Modal from '@/components/ui/Modal';

describe('Modal', () => {
  it('gives its white panel a dark text colour for its content to inherit', async () => {
    render(
      <Modal isOpen onClose={jest.fn()} title="Details">
        <span>0x78a6...afbd</span>
      </Modal>
    );

    const panel = (await screen.findByText('0x78a6...afbd')).closest('.bg-white');

    expect(panel).not.toBeNull();
    expect(panel).toHaveClass('text-gray-900');
  });
});
