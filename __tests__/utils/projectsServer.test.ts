import { draftToCreateRequest } from '@/utils/projectsServer';
import { ProjectDraft } from '@/types/projects';

const baseDraft = (overrides: Partial<ProjectDraft> = {}): ProjectDraft => ({
  sellerAddress: '0xSeller',
  totalAmount: 100,
  currency: 'USDC',
  expiryTimestamp: 4102444800,
  description: 'test',
  splitMode: 'amount',
  recipients: [
    { address: '0xA', value: 60 },
    { address: '0xB', value: 40 },
  ],
  serviceLink: 'https://app.example.com',
  ...overrides,
});

describe('draftToCreateRequest', () => {
  it('converts dollar amounts to bps summing to 10000', () => {
    const req = draftToCreateRequest(baseDraft());
    const bps = req.root.recipients.map((r) => r.bps);
    expect(bps).toEqual([6000, 4000]);
    expect(bps.reduce((a, b) => a + b, 0)).toBe(10000);
  });

  it('converts percentages to bps', () => {
    const req = draftToCreateRequest(
      baseDraft({
        splitMode: 'percent',
        recipients: [
          { address: '0xA', value: 25.5 },
          { address: '0xB', value: 74.5 },
        ],
      })
    );
    expect(req.root.recipients.map((r) => r.bps)).toEqual([2550, 7450]);
  });

  it('forces the bps to sum to exactly 10000 despite rounding', () => {
    const req = draftToCreateRequest(
      baseDraft({
        splitMode: 'percent',
        recipients: [
          { address: '0xA', value: 33.33 },
          { address: '0xB', value: 33.33 },
          { address: '0xC', value: 33.34 },
        ],
      })
    );
    expect(req.root.recipients.map((r) => r.bps).reduce((a, b) => a + b, 0)).toBe(10000);
  });

  it('carries through node fields and nulls optionals', () => {
    const req = draftToCreateRequest(baseDraft({ verifierAddress: null, sellerEmail: 'x@y.z' }));
    expect(req.root.sellerAddress).toBe('0xSeller');
    expect(req.root.verifierAddress).toBeNull();
    expect(req.root.sellerEmail).toBe('x@y.z');
    expect(req.root.recipients[0].child).toBeNull();
  });

  it('rejects an empty recipient list', () => {
    expect(() => draftToCreateRequest(baseDraft({ recipients: [] }))).toThrow(/at least one recipient/i);
  });
});
