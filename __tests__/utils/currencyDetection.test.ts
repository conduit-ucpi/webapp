import {
  detectUserCurrency,
  getCurrencyInfo,
  formatCurrencyOption,
  getPopularCurrencies,
  SUPPORTED_CURRENCIES
} from '@/utils/currencyDetection';

describe('currencyDetection', () => {
  describe('detectUserCurrency', () => {
    const originalNavigator = global.navigator;

    beforeEach(() => {
      // Reset navigator before each test
      Object.defineProperty(global, 'navigator', {
        value: { ...originalNavigator },
        writable: true,
        configurable: true
      });
    });

    afterEach(() => {
      jest.restoreAllMocks();
    });

    it('should detect EUR from European locale', () => {
      Object.defineProperty(global.navigator, 'language', {
        value: 'fr-FR',
        writable: true,
        configurable: true
      });

      const currency = detectUserCurrency();
      expect(currency).toBe('EUR');
    });

    it('should detect GBP from UK locale', () => {
      Object.defineProperty(global.navigator, 'language', {
        value: 'en-GB',
        writable: true,
        configurable: true
      });

      const currency = detectUserCurrency();
      expect(currency).toBe('GBP');
    });

    it('should detect USD from US locale', () => {
      Object.defineProperty(global.navigator, 'language', {
        value: 'en-US',
        writable: true,
        configurable: true
      });

      const currency = detectUserCurrency();
      expect(currency).toBe('USD');
    });

    it('should detect CAD from Canadian locale', () => {
      Object.defineProperty(global.navigator, 'language', {
        value: 'en-CA',
        writable: true,
        configurable: true
      });

      const currency = detectUserCurrency();
      expect(currency).toBe('CAD');
    });

    it('should detect JPY from Japanese locale', () => {
      Object.defineProperty(global.navigator, 'language', {
        value: 'ja-JP',
        writable: true,
        configurable: true
      });

      const currency = detectUserCurrency();
      expect(currency).toBe('JPY');
    });

    it('should fallback to USD when locale has no currency mapping', () => {
      Object.defineProperty(global.navigator, 'language', {
        value: 'xx-XX', // Unknown locale
        writable: true,
        configurable: true
      });

      const currency = detectUserCurrency();
      expect(currency).toBe('USD');
    });

    it('should fallback to USD when navigator is not available', () => {
      // Test with no navigator
      Object.defineProperty(global, 'navigator', {
        value: undefined,
        writable: true,
        configurable: true
      });

      const currency = detectUserCurrency();
      expect(currency).toBe('USD');

      // Restore navigator
      Object.defineProperty(global, 'navigator', {
        value: originalNavigator,
        writable: true,
        configurable: true
      });
    });
  });

  describe('getCurrencyInfo', () => {
    it('should return currency info for valid code', () => {
      const info = getCurrencyInfo('EUR');
      expect(info).toBeDefined();
      expect(info?.code).toBe('EUR');
      expect(info?.symbol).toBe('€');
      expect(info?.name).toBe('Euro');
    });

    it('should return undefined for invalid code', () => {
      const info = getCurrencyInfo('INVALID');
      expect(info).toBeUndefined();
    });

    it('should return info for all popular currencies', () => {
      const currencies = ['USD', 'EUR', 'GBP', 'JPY', 'CAD', 'AUD'];
      currencies.forEach(code => {
        const info = getCurrencyInfo(code);
        expect(info).toBeDefined();
        expect(info?.code).toBe(code);
      });
    });
  });

  describe('formatCurrencyOption', () => {
    it('should format currency option with symbol', () => {
      const formatted = formatCurrencyOption('EUR');
      expect(formatted).toBe('EUR - Euro (€)');
    });

    it('should format USD correctly', () => {
      const formatted = formatCurrencyOption('USD');
      expect(formatted).toBe('USD - US Dollar ($)');
    });

    it('should handle unknown currency code', () => {
      const formatted = formatCurrencyOption('XYZ');
      expect(formatted).toBe('XYZ');
    });
  });

  describe('getPopularCurrencies', () => {
    it('should return array of popular currency codes', () => {
      const popular = getPopularCurrencies();
      expect(Array.isArray(popular)).toBe(true);
      expect(popular.length).toBeGreaterThan(0);
    });

    it('should include major currencies', () => {
      const popular = getPopularCurrencies();
      expect(popular).toContain('USD');
      expect(popular).toContain('EUR');
      expect(popular).toContain('GBP');
      expect(popular).toContain('JPY');
    });
  });

  describe('SUPPORTED_CURRENCIES', () => {
    it('should have valid structure', () => {
      expect(Array.isArray(SUPPORTED_CURRENCIES)).toBe(true);
      expect(SUPPORTED_CURRENCIES.length).toBeGreaterThan(0);

      SUPPORTED_CURRENCIES.forEach(currency => {
        expect(currency).toHaveProperty('code');
        expect(currency).toHaveProperty('symbol');
        expect(currency).toHaveProperty('name');
        expect(currency).toHaveProperty('countries');
        expect(Array.isArray(currency.countries)).toBe(true);
      });
    });

    it('should not have duplicate currency codes', () => {
      const codes = SUPPORTED_CURRENCIES.map(c => c.code);
      const uniqueCodes = new Set(codes);
      expect(codes.length).toBe(uniqueCodes.size);
    });

    it('should include all major world currencies', () => {
      const codes = SUPPORTED_CURRENCIES.map(c => c.code);
      const major = ['USD', 'EUR', 'GBP', 'JPY', 'CNY', 'INR', 'BRL', 'CAD', 'AUD'];
      major.forEach(code => {
        expect(codes).toContain(code);
      });
    });
  });
});
