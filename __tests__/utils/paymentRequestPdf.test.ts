/**
 * The payment-request PDF says what the request actually is: its token, and — for an instant
 * payment — that there is no holding period and no dispute. The escrow wording on an instant
 * request would promise the buyer recourse the contract cannot give.
 */
const written: string[] = [];
jest.mock('jspdf', () => ({
  jsPDF: jest.fn().mockImplementation(() => {
    const record = (text: string | string[]) => written.push(([] as string[]).concat(text).join(' '));
    return {
      setTextColor: jest.fn(),
      setFillColor: jest.fn(),
      setDrawColor: jest.fn(),
      setFont: jest.fn(),
      setFontSize: jest.fn(),
      // One "line" per call is enough to read the words back.
      splitTextToSize: (text: string) => [text],
      text: record,
      textWithLink: record,
      rect: jest.fn(),
      roundedRect: jest.fn(),
      circle: jest.fn(),
      line: jest.fn(),
      addImage: jest.fn(),
      save: jest.fn(),
    };
  }),
}));

import { downloadPaymentRequestPdf } from '@/utils/paymentRequestPdf';

const doc = {
  formattedAmount: '25 USDT',
  tokenSymbol: 'USDT',
  description: 'Camera lens',
  paymentLink: 'https://stabledrop.me/contract-pay?contractId=req-1',
  payoutDate: '8 Oct 2026, 12:00 UTC',
  siteName: 'Stabledrop.me',
};

const page = () => written.join('\n');

beforeEach(() => {
  written.length = 0;
});

it('names the token the request is in, not USDC regardless', async () => {
  await downloadPaymentRequestPdf(doc);
  expect(page()).toContain('paid in USDT');
  expect(page()).not.toContain('USDC');
});

it('describes an escrow payment as held until its date, with a dispute window', async () => {
  await downloadPaymentRequestPdf(doc);
  expect(page()).toContain('8 Oct 2026, 12:00 UTC');
  expect(page()).toContain('raise a dispute');
});

it('says an instant payment is instant and cannot be disputed', async () => {
  await downloadPaymentRequestPdf({ ...doc, instant: true, payoutDate: undefined });
  expect(page()).toContain('Instantly, when you pay');
  expect(page()).toContain('cannot be disputed or reversed');
  expect(page()).not.toMatch(/raise a dispute|held by a smart contract|payout date/);
});

it('carries no leftover product name under the brand', async () => {
  await downloadPaymentRequestPdf(doc);
  expect(page()).not.toContain('Conduit UCPI');
});
