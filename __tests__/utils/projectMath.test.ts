import {
  amountsToBps,
  bpsToPercentString,
  fromBaseUnits,
  percentToBps,
  splitByBps,
  toBaseUnits,
} from '@/utils/projectMath';

const b = (n: number | string) => BigInt(n);

describe('projectMath', () => {
  describe('toBaseUnits / fromBaseUnits', () => {
    it('converts USDC amounts exactly', () => {
      expect(toBaseUnits(1000, 6)).toBe(b('1000000000'));
      expect(toBaseUnits(0.000001, 6)).toBe(b(1));
      expect(toBaseUnits(123.456789, 6)).toBe(b('123456789'));
    });

    it('avoids float artifacts', () => {
      expect(toBaseUnits(0.1 + 0.2, 6)).toBe(b('300000'));
    });

    it('round-trips', () => {
      expect(fromBaseUnits(b('123456789'), 6)).toBe('123.456789');
      expect(fromBaseUnits(b('1000000000'), 6)).toBe('1000');
      expect(fromBaseUnits(b(10), 6)).toBe('0.00001');
    });
  });

  describe('splitByBps', () => {
    it('mirrors the contract: floor division, last recipient absorbs dust', () => {
      // 100 units split 3333/3333/3334: floor gives 33.33 each; the last takes the rest.
      const shares = splitByBps(b(10000), [3333, 3333, 3334]);
      expect(shares).toEqual([b(3333), b(3333), b(3334)]);
      expect(shares.reduce((a, c) => a + c, b(0))).toBe(b(10000));
    });

    it('gives everything to a single recipient', () => {
      expect(splitByBps(b(999), [10000])).toEqual([b(999)]);
    });

    it('assigns dust to the last recipient, not proportionally', () => {
      // 1001 units, 50/50: floor(1001*5000/10000)=500, last gets 501.
      expect(splitByBps(b(1001), [5000, 5000])).toEqual([b(500), b(501)]);
    });

    it('handles empty input', () => {
      expect(splitByBps(b(1000), [])).toEqual([]);
    });
  });

  describe('amountsToBps', () => {
    it('converts even splits', () => {
      expect(amountsToBps([50, 50])).toEqual([5000, 5000]);
    });

    it('sums to exactly 10000 with rounding residue on the largest share', () => {
      const bps = amountsToBps([33.33, 33.33, 33.34]);
      expect(bps.reduce((a, c) => a + c, 0)).toBe(10000);
    });

    it('rejects shares that round to zero bps', () => {
      expect(() => amountsToBps([10000, 0.001])).toThrow(/at least 1 basis point/);
    });

    it('rejects a non-positive total', () => {
      expect(() => amountsToBps([0, 0])).toThrow(/positive/);
    });
  });

  describe('percent conversions', () => {
    it('parses percentages to bps', () => {
      expect(percentToBps(25.5)).toBe(2550);
      expect(percentToBps(100)).toBe(10000);
    });

    it('rejects out-of-range percentages', () => {
      expect(() => percentToBps(0)).toThrow();
      expect(() => percentToBps(100.01)).toThrow();
    });

    it('renders bps as percent strings', () => {
      expect(bpsToPercentString(2550)).toBe('25.5');
      expect(bpsToPercentString(10000)).toBe('100');
    });
  });
});
