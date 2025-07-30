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
  formatUSDC
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
    it('should convert microUSDC to USDC', () => {
      const microUSDC = 1000000; // 1 USDC in microUSDC
      const result = formatUSDC(microUSDC);
      expect(result).toBe('1.00');
    });

    it('should handle string input', () => {
      const microUSDC = '2500000'; // 2.5 USDC
      const result = formatUSDC(microUSDC);
      expect(result).toBe('2.50');
    });

    it('should format to 2 decimal places', () => {
      const microUSDC = 1234567; // 1.234567 USDC
      const result = formatUSDC(microUSDC);
      expect(result).toBe('1.23');
    });

    it('should handle zero', () => {
      const result = formatUSDC(0);
      expect(result).toBe('0.00');
    });
  });
});