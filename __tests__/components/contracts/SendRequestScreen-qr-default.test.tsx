/**
 * The QR code on the send-request screen is shown by default.
 *
 * It used to sit behind a collapsed disclosure, which meant most people never
 * found it — and handing the request over in person by letting someone scan it
 * is a primary path, not an afterthought. The toggle still exists, so this pins
 * the default rather than the ability to collapse.
 */

import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import SendRequestScreen from '@/components/contracts/SendRequestScreen';

const props = {
  paymentLink: 'https://stabledrop.me/contract-pay?c=0xabc',
  amount: '25',
  tokenSymbol: 'USDC',
  description: 'Camera lens',
  copied: false,
  onCopy: jest.fn(),
  onDone: jest.fn(),
};

/** The disclosure that wraps the QR, found by its accessible name. */
const disclosure = () =>
  screen.getByRole('button', { name: /in person, or on paper/i });

/**
 * The visible QR only. The screen also renders an off-screen QRCodeCanvas used
 * to build the PDF, which is `display: none` on purpose — counting that as
 * "visible" would make this test pass even if the disclosure were shut.
 */
const visibleQrCodes = (container: HTMLElement) =>
  Array.from(container.querySelectorAll('svg')).filter(
    (svg) => svg.getAttribute('height') === '180' || svg.getAttribute('width') === '180'
  );

describe('SendRequestScreen — QR visibility', () => {
  it('renders the QR without the user opening anything', () => {
    const { container } = render(<SendRequestScreen {...props} />);
    expect(visibleQrCodes(container)).toHaveLength(1);
  });

  it('reports the section as expanded to assistive tech', () => {
    render(<SendRequestScreen {...props} />);
    expect(disclosure()).toHaveAttribute('aria-expanded', 'true');
  });

  it('can still be collapsed', async () => {
    const user = userEvent.setup();
    const { container } = render(<SendRequestScreen {...props} />);

    await user.click(disclosure());

    expect(disclosure()).toHaveAttribute('aria-expanded', 'false');
    expect(visibleQrCodes(container)).toHaveLength(0);
  });
});
