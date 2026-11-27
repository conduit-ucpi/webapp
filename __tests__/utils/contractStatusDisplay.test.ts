import { contractStatusDisplay } from '@/utils/contractStatusDisplay';

describe('contractStatusDisplay', () => {
  it('names a sanctions refusal plainly, in the error colours', () => {
    const shown = contractStatusDisplay('SANCTIONS_REFUSED', false);
    expect(shown.label).toBe('REFUSED: SANCTIONS CHECK');
    expect(shown.color).toContain('error');
  });

  it('leaves the other statuses as they were', () => {
    expect(contractStatusDisplay('AWAITING_FUNDING', false).label).toBe('AWAITING_FUNDING');
    expect(contractStatusDisplay(undefined, true).label).toBe('PENDING FUNDING');
  });
});

describe('a payment returned to the buyer', () => {
  it('reads as returned to the buyer, in the finished colours, not as unknown', () => {
    const shown = contractStatusDisplay('REFUNDED', false);
    expect(shown.label).toBe('RETURNED TO BUYER');
    expect(shown.color).toBe(contractStatusDisplay('CLAIMED', false).color);
  });
});
