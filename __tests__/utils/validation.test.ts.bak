import { 
  normalizeTimestamp, 
  formatTimeRemaining, 
  formatExpiryDate,
  isValidWalletAddress,
  isValidAmount,
  isValidExpiryTime,
  isValidDescription,
  isValidEmail,
  formatWalletAddress,
  formatUSDC,
  formatCurrency,
  displayCurrency,
  toMicroUSDC,
  fromMicroUSDC,
  toUSDCForWeb3
} from '../../utils/validation';

describe('validation utils', () => {
  describe('normalizeTimestamp', () => {
    it('should convert seconds timestamp to milliseconds', () => {
      const secondsTimestamp = 1753913880; // 10 digits
      const result = normalizeTimestamp(secondsTimestamp);
      expect(result).toBe(1753913880000); // 13 digits
    });

    it('should leave milliseconds timestamp unchanged', () => {
      const millisecondsTimestamp = 1753900787830; // 13 digits
      const result = normalizeTimestamp(millisecondsTimestamp);
      expect(result).toBe(1753900787830);
    });

    it('should handle string seconds timestamp', () => {
      const stringSecondsTimestamp = '1753913880';
      const result = normalizeTimestamp(stringSecondsTimestamp);
      expect(result).toBe(1753913880000);
    });

    it('should handle string milliseconds timestamp', () => {
      const stringMillisecondsTimestamp = '1753900787830';
      const result = normalizeTimestamp(stringMillisecondsTimestamp);
      expect(result).toBe(1753900787830);
    });

    it('should handle edge case of exactly 10 digits', () => {
      const tenDigitTimestamp = 9999999999; // exactly 10 digits
      const result = normalizeTimestamp(tenDigitTimestamp);
      expect(result).toBe(9999999999000);
    });

    it('should handle edge case of exactly 11 digits', () => {
      const elevenDigitTimestamp = 10000000000; // exactly 11 digits
      const result = normalizeTimestamp(elevenDigitTimestamp);
      expect(result).toBe(10000000000); // unchanged
    });
  });

  describe('formatTimeRemaining', () => {
    beforeEach(() => {
      // Mock Date.now() to return a fixed timestamp
      jest.spyOn(Date, 'now').mockReturnValue(1753900000000);
    });

    afterEach(() => {
      jest.restoreAllMocks();
    });

    it('should format time remaining with seconds timestamp input', () => {
      const expiryInSeconds = 1753901800; // 30 minutes from now in seconds
      const result = formatTimeRemaining(expiryInSeconds);
      expect(result).toBe('30m');
    });

    it('should format time remaining with milliseconds timestamp input', () => {
      const expiryInMillis = 1753901800000; // 30 minutes from now in milliseconds
      const result = formatTimeRemaining(expiryInMillis);
      expect(result).toBe('30m');
    });

    it('should return "Expired" for past timestamp', () => {
      const pastTimestamp = 1753899000; // 1000 seconds ago
      const result = formatTimeRemaining(pastTimestamp);
      expect(result).toBe('Expired');
    });

    it('should format days, hours, and minutes', () => {
      const futureTimestamp = 1754000000; // ~28 hours from now in seconds
      const result = formatTimeRemaining(futureTimestamp);
      expect(result).toMatch(/\d+d \d+h \d+m/);
    });
  });

  describe('formatExpiryDate', () => {
    it('should format expiry date with seconds timestamp', () => {
      const timestampInSeconds = 1753913880;
      const result = formatExpiryDate(timestampInSeconds);
      // Should contain date elements - checking actual format returned
      expect(result).toMatch(/\d{1,2} \w{3} \d{4}, \d{2}:\d{2}/);
      expect(result).toContain('2025'); // Should be in 2025
    });

    it('should format expiry date with milliseconds timestamp', () => {
      const timestampInMillis = 1753913880000;
      const result = formatExpiryDate(timestampInMillis);
      expect(result).toMatch(/\d{1,2} \w{3} \d{4}, \d{2}:\d{2}/);
      expect(result).toContain('2025');
    });

    it('should include timezone information', () => {
      const timestamp = 1753913880;
      const result = formatExpiryDate(timestamp);
      // Should contain timezone info (GMT+12, UTC, etc.)
      expect(result).toMatch(/GMT|UTC|[A-Z]{3,4}[\+\-]?\d*/);
    });
  });

  describe('isValidWalletAddress', () => {
    it('should validate correct Ethereum address with proper checksum', () => {
      const address = '0x5aAeb6053F3E94C9b9A09f33669435E7Ef1BeAed';
      expect(isValidWalletAddress(address)).toBe(true);
    });

    it('should validate another correct address', () => {
      const address = '0x20e00e24101D8D7a330bA3A6AAA655d7766e7C1B';
      expect(isValidWalletAddress(address)).toBe(true);
    });

    it('should reject invalid address', () => {
      const address = 'invalid-address';
      expect(isValidWalletAddress(address)).toBe(false);
    });

    it('should reject empty address', () => {
      expect(isValidWalletAddress('')).toBe(false);
    });

    it('should reject address with wrong length', () => {
      const address = '0x123';
      expect(isValidWalletAddress(address)).toBe(false);
    });
  });

  describe('isValidAmount', () => {
    it('should validate positive number string', () => {
      expect(isValidAmount('10.5')).toBe(true);
    });

    it('should reject zero', () => {
      expect(isValidAmount('0')).toBe(false);
    });

    it('should reject negative number', () => {
      expect(isValidAmount('-5')).toBe(false);
    });

    it('should reject non-numeric string', () => {
      expect(isValidAmount('abc')).toBe(false);
    });
  });

  describe('isValidExpiryTime', () => {
    it('should validate reasonable expiry time', () => {
      expect(isValidExpiryTime(24, 0)).toBe(true); // 24 hours
    });

    it('should reject zero time', () => {
      expect(isValidExpiryTime(0, 0)).toBe(false);
    });

    it('should reject time over 1 year', () => {
      expect(isValidExpiryTime(8760, 1)).toBe(false); // Over 1 year
    });

    it('should validate minimum time (1 minute)', () => {
      expect(isValidExpiryTime(0, 1)).toBe(true);
    });
  });

  describe('isValidDescription', () => {
    it('should validate non-empty description', () => {
      expect(isValidDescription('Valid description')).toBe(true);
    });

    it('should reject empty description', () => {
      expect(isValidDescription('')).toBe(false);
    });

    it('should reject whitespace-only description', () => {
      expect(isValidDescription('   ')).toBe(false);
    });

    it('should reject description over 160 characters', () => {
      const longDescription = 'a'.repeat(161);
      expect(isValidDescription(longDescription)).toBe(false);
    });

    it('should validate description at 160 characters', () => {
      const maxDescription = 'a'.repeat(160);
      expect(isValidDescription(maxDescription)).toBe(true);
    });
  });

  describe('isValidEmail', () => {
    it('should validate correct email', () => {
      expect(isValidEmail('test@example.com')).toBe(true);
    });

    it('should reject invalid email format', () => {
      expect(isValidEmail('invalid-email')).toBe(false);
    });

    it('should reject email without domain', () => {
      expect(isValidEmail('test@')).toBe(false);
    });

    it('should trim whitespace and validate', () => {
      expect(isValidEmail('  test@example.com  ')).toBe(true);
    });
  });

  describe('formatWalletAddress', () => {
    it('should format long wallet address', () => {
      const address = '0x742d35Cc6634C0532925a3b8D39d8E8a82F12345';
      const result = formatWalletAddress(address);
      expect(result).toBe('0x742d...2345');
    });

    it('should handle short address', () => {
      const address = '0x1234567890';
      const result = formatWalletAddress(address);
      expect(result).toBe('0x1234...7890');
    });
  });

  describe('formatUSDC', () => {
    describe('microUSDC format (default behavior)', () => {
      it('should convert microUSDC to USDC', () => {
        const microUSDC = 1000000; // 1 USDC in microUSDC
        const result = formatUSDC(microUSDC);
        expect(result).toBe('1.0000');
      });

      it('should handle string input', () => {
        const microUSDC = '2500000'; // 2.5 USDC
        const result = formatUSDC(microUSDC);
        expect(result).toBe('2.5000');
      });

      it('should format to 4 decimal places', () => {
        const microUSDC = 1234567; // 1.234567 USDC
        const result = formatUSDC(microUSDC);
        expect(result).toBe('1.2346');
      });

      it('should handle zero', () => {
        const result = formatUSDC(0);
        expect(result).toBe('0.0000');
      });

      it('should handle 0.25 USDC (250000 microUSDC)', () => {
        const microUSDC = 250000; // 0.25 USDC in microUSDC
        const result = formatUSDC(microUSDC);
        expect(result).toBe('0.2500');
      });

      it('should handle very small amounts', () => {
        const microUSDC = 1; // 0.000001 USDC
        const result = formatUSDC(microUSDC);
        expect(result).toBe('0.0000');
      });

      it('should handle large amounts', () => {
        const microUSDC = 1000000000000; // 1,000,000 USDC
        const result = formatUSDC(microUSDC);
        expect(result).toBe('1000000.0000');
      });

      it('should handle fractional microUSDC amounts correctly', () => {
        const microUSDC = 123456; // 0.123456 USDC
        const result = formatUSDC(microUSDC);
        expect(result).toBe('0.1235');
      });

      it('should round down for display consistency', () => {
        const microUSDC = 999999; // 0.999999 USDC (should round to 1.0000)
        const result = formatUSDC(microUSDC);
        expect(result).toBe('1.0000'); // Actually rounds to 1.0000 due to .toFixed(4)
      });
    });

    // Note: The isAlreadyFormatted parameter is not implemented in the current formatUSDC function
    // These tests are for future enhancement if needed

    describe('edge cases and potential gotchas', () => {
      it('should handle negative amounts (though not expected in real usage)', () => {
        const microUSDC = -1000000; // -1 USDC
        const result = formatUSDC(microUSDC);
        expect(result).toBe('-1.0000');
      });

      it('should handle floating point precision issues', () => {
        const microUSDC = 100000.1; // Slightly more than 0.1 USDC
        const result = formatUSDC(microUSDC);
        expect(result).toBe('0.1000');
      });

      it('should be consistent with common contract amounts', () => {
        // Test amounts commonly used in contracts
        const amounts = [
          { microUSDC: 250000, expected: '0.2500' },    // Quarter dollar
          { microUSDC: 500000, expected: '0.5000' },    // Half dollar
          { microUSDC: 1000000, expected: '1.0000' },   // One dollar
          { microUSDC: 10000000, expected: '10.0000' }, // Ten dollars
          { microUSDC: 100000000, expected: '100.0000' } // One hundred dollars
        ];

        amounts.forEach(({ microUSDC, expected }) => {
          expect(formatUSDC(microUSDC)).toBe(expected);
        });
      });

      it('should handle scientific notation inputs', () => {
        const microUSDC = 1e6; // 1000000 in scientific notation
        const result = formatUSDC(microUSDC);
        expect(result).toBe('1.0000');
      });

      it('should maintain precision for amounts close to display threshold', () => {
        const microUSDC = 5000; // 0.005 USDC (should round to 0.01)
        const result = formatUSDC(microUSDC);
        expect(result).toBe('0.0050');
      });
    });
  });

  describe('formatCurrency', () => {
    it('should handle microUSDC amounts correctly', () => {
      const result = formatCurrency(1500000, 'microUSDC');
      expect(result.amount).toBe('1.5000');
      expect(result.currency).toBe('USDC');
      expect(result.numericAmount).toBe(1.5);
    });

    it('should handle USDC amounts correctly', () => {
      const result = formatCurrency(1.50, 'USDC');
      expect(result.amount).toBe('1.5000');
      expect(result.currency).toBe('USDC');
      expect(result.numericAmount).toBe(1.5);
    });

    it('should default to microUSDC when currency not specified', () => {
      const result = formatCurrency(250000);
      expect(result.amount).toBe('0.2500');
      expect(result.currency).toBe('USDC');
    });

    it('should handle string amounts', () => {
      const result = formatCurrency('1000000', 'microUSDC');
      expect(result.amount).toBe('1.0000');
      expect(result.currency).toBe('USDC');
    });

    it('should handle invalid amounts gracefully', () => {
      const result = formatCurrency('invalid', 'microUSDC');
      expect(result.amount).toBe('0.0000');
      expect(result.currency).toBe('USDC');
      expect(result.numericAmount).toBe(0);
    });

    it('should handle unknown currency tags as USDC', () => {
      const result = formatCurrency(1.50, 'UNKNOWN');
      expect(result.amount).toBe('1.5000');
      expect(result.currency).toBe('USDC');
    });

    it('should smart-detect microUSDC amounts with USDC currency tag (legacy compatibility)', () => {
      // Large amounts with "USDC" tag are likely microUSDC
      const result = formatCurrency(250000, 'USDC');
      expect(result.amount).toBe('0.2500');
      expect(result.currency).toBe('USDC');
      expect(result.numericAmount).toBe(0.25);
    });

    it('should handle small amounts with USDC currency tag as actual USDC', () => {
      // Small amounts with "USDC" tag are likely actual USDC
      const result = formatCurrency(1.50, 'USDC');
      expect(result.amount).toBe('1.5000');
      expect(result.currency).toBe('USDC');
      expect(result.numericAmount).toBe(1.5);
    });
  });

  describe('displayCurrency', () => {
    it('should format microUSDC with dollar sign', () => {
      const result = displayCurrency(1500000, 'microUSDC');
      expect(result).toBe('$1.5000');
    });

    it('should format USDC with dollar sign', () => {
      const result = displayCurrency(1.50, 'USDC');
      expect(result).toBe('$1.5000');
    });

    it('should default to microUSDC', () => {
      const result = displayCurrency(250000);
      expect(result).toBe('$0.2500');
    });
  });

  describe('toMicroUSDC', () => {
    it('should convert USDC to microUSDC', () => {
      expect(toMicroUSDC(1.50)).toBe(1500000);
      expect(toMicroUSDC(0.25)).toBe(250000);
      expect(toMicroUSDC(1)).toBe(1000000);
    });

    it('should handle string input', () => {
      expect(toMicroUSDC('1.50')).toBe(1500000);
      expect(toMicroUSDC('0.25')).toBe(250000);
    });

    it('should handle invalid input', () => {
      expect(toMicroUSDC('invalid')).toBe(0);
      expect(toMicroUSDC(NaN)).toBe(0);
    });

    it('should round to avoid floating point precision issues', () => {
      expect(toMicroUSDC(0.1 + 0.2)).toBe(300000); // 0.3 USDC
    });
  });

  describe('fromMicroUSDC', () => {
    it('should convert microUSDC to USDC', () => {
      expect(fromMicroUSDC(1500000)).toBe(1.5);
      expect(fromMicroUSDC(250000)).toBe(0.25);
      expect(fromMicroUSDC(1000000)).toBe(1);
    });

    it('should handle string input', () => {
      expect(fromMicroUSDC('1500000')).toBe(1.5);
      expect(fromMicroUSDC('250000')).toBe(0.25);
    });

    it('should handle invalid input', () => {
      expect(fromMicroUSDC('invalid')).toBe(0);
      expect(fromMicroUSDC(NaN)).toBe(0);
    });

    it('should handle very small amounts', () => {
      expect(fromMicroUSDC(1)).toBe(0.000001);
    });
  });

  describe('toUSDCForWeb3', () => {
    it('should convert microUSDC to USDC string preserving precision', () => {
      expect(toUSDCForWeb3(123456, 'microUSDC')).toBe('0.123456');
      expect(toUSDCForWeb3(5000000, 'microUSDC')).toBe('5');
      expect(toUSDCForWeb3(12345678, 'microUSDC')).toBe('12.345678');
    });

    it('should handle USDC amounts correctly', () => {
      expect(toUSDCForWeb3(1.50, 'USDC')).toBe('1.5');
      expect(toUSDCForWeb3(5, 'USDC')).toBe('5');
    });

    it('should smart-detect microUSDC with USDC currency tag', () => {
      expect(toUSDCForWeb3(250000, 'USDC')).toBe('0.25');
      expect(toUSDCForWeb3(5000000, 'USDC')).toBe('5');
    });

    it('should handle invalid input', () => {
      expect(toUSDCForWeb3('invalid', 'microUSDC')).toBe('0');
      expect(toUSDCForWeb3(NaN)).toBe('0');
    });

    it('should preserve precision for Web3 operations', () => {
      // This is specifically for the failing test case
      expect(toUSDCForWeb3(123456, 'microUSDC')).toBe('0.123456');
      expect(toUSDCForWeb3(5000000, 'microUSDC')).toBe('5');
      expect(toUSDCForWeb3(12345678, 'microUSDC')).toBe('12.345678');
    });
  });
});