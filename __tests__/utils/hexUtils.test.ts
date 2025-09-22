import { ensureHexPrefix, toHex, toHexString } from '@/utils/hexUtils';

describe('hexUtils', () => {
  describe('ensureHexPrefix', () => {
    it('should add 0x prefix to string without prefix', () => {
      expect(ensureHexPrefix('2105')).toBe('0x2105');
      expect(ensureHexPrefix('abcdef')).toBe('0xabcdef');
      expect(ensureHexPrefix('123')).toBe('0x123');
    });

    it('should not double-prefix string that already has 0x', () => {
      expect(ensureHexPrefix('0x2105')).toBe('0x2105');
      expect(ensureHexPrefix('0xabcdef')).toBe('0xabcdef');
      expect(ensureHexPrefix('0x123')).toBe('0x123');
    });

    it('should handle uppercase 0X prefix', () => {
      expect(ensureHexPrefix('0X2105')).toBe('0X2105');
      expect(ensureHexPrefix('0XABCDEF')).toBe('0XABCDEF');
    });

    it('should return 0x for empty string', () => {
      expect(ensureHexPrefix('')).toBe('0x');
    });

    it('should handle null/undefined input', () => {
      expect(ensureHexPrefix(null as any)).toBe('0x');
      expect(ensureHexPrefix(undefined as any)).toBe('0x');
    });
  });

  describe('toHex', () => {
    it('should convert numbers to hex with 0x prefix', () => {
      expect(toHex(0)).toBe('0x0');
      expect(toHex(1)).toBe('0x1');
      expect(toHex(8453)).toBe('0x2105'); // Base Mainnet chain ID
      expect(toHex(84532)).toBe('0x14a34'); // Base Sepolia chain ID
      expect(toHex(255)).toBe('0xff');
      expect(toHex(256)).toBe('0x100');
    });

    it('should convert bigint to hex with 0x prefix', () => {
      expect(toHex(BigInt(0))).toBe('0x0');
      expect(toHex(BigInt(8453))).toBe('0x2105');
      expect(toHex(BigInt(84532))).toBe('0x14a34');
      expect(toHex(BigInt('999999999999999999999'))).toBe('0x3635c9adc5de9fffff');
    });

    it('should handle large numbers', () => {
      expect(toHex(Number.MAX_SAFE_INTEGER)).toBe('0x1fffffffffffff');
    });
  });

  describe('toHexString', () => {
    it('should convert numbers to hex with 0x prefix', () => {
      expect(toHexString(8453)).toBe('0x2105');
      expect(toHexString(84532)).toBe('0x14a34');
      expect(toHexString(0)).toBe('0x0');
      expect(toHexString(255)).toBe('0xff');
    });

    it('should convert bigint to hex with 0x prefix', () => {
      expect(toHexString(BigInt(8453))).toBe('0x2105');
      expect(toHexString(BigInt(84532))).toBe('0x14a34');
    });

    it('should handle already-hex strings correctly', () => {
      expect(toHexString('0x2105')).toBe('0x2105');
      expect(toHexString('0x14a14')).toBe('0x14a14');
      expect(toHexString('0xabcdef')).toBe('0xabcdef');
    });

    it('should add prefix to non-prefixed hex strings', () => {
      expect(toHexString('2105')).toBe('0x2105');
      expect(toHexString('14a14')).toBe('0x14a14');
      expect(toHexString('abcdef')).toBe('0xabcdef');
    });

    it('should handle uppercase hex strings', () => {
      expect(toHexString('0X2105')).toBe('0X2105');
      expect(toHexString('ABCDEF')).toBe('0xABCDEF');
    });

    it('should handle empty string', () => {
      expect(toHexString('')).toBe('0x');
    });

    // Critical test cases that could cause 0x0x issues
    describe('potential double-prefix scenarios', () => {
      it('should not double-prefix when called multiple times', () => {
        const result1 = toHexString(8453);
        expect(result1).toBe('0x2105');
        
        const result2 = toHexString(result1);
        expect(result2).toBe('0x2105');
        
        const result3 = toHexString(result2);
        expect(result3).toBe('0x2105');
      });

      it('should handle chain ID values correctly', () => {
        // Base Mainnet
        expect(toHexString(8453)).toBe('0x2105');
        expect(toHexString('8453')).toBe('0x8453'); // String number, not hex conversion
        expect(toHexString('0x2105')).toBe('0x2105');
        
        // Base Sepolia
        expect(toHexString(84532)).toBe('0x14a34');
        expect(toHexString('0x14a34')).toBe('0x14a34');
      });

      it('should handle string numbers vs hex strings differently', () => {
        // String that looks like a number should get prefix, not conversion
        expect(toHexString('2105')).toBe('0x2105');
        // Number should get converted to hex
        expect(toHexString(2105)).toBe('0x839');
        // Already hex should stay as-is
        expect(toHexString('0x2105')).toBe('0x2105');
      });
    });

    // Edge cases that could cause errors
    describe('edge cases', () => {
      it('should handle special string values', () => {
        expect(toHexString('0')).toBe('0x0');
        expect(toHexString('00')).toBe('0x00');
        expect(toHexString('0x')).toBe('0x');
        expect(toHexString('0x0')).toBe('0x0');
      });
    });
  });

  // Integration tests with real-world scenarios
  describe('real-world usage scenarios', () => {
    it('should handle Base Mainnet chain ID correctly', () => {
      const chainId = 8453;
      const hex = toHexString(chainId);
      expect(hex).toBe('0x2105');
      
      // Should not double-prefix if called again
      const hexAgain = toHexString(hex);
      expect(hexAgain).toBe('0x2105');
    });

    it('should handle config chain ID that might be string or number', () => {
      // Simulate config.chainId as number
      const configAsNumber = 8453;
      expect(toHexString(configAsNumber)).toBe('0x2105');
      
      // Simulate config.chainId as hex string
      const configAsHex = '0x2105';
      expect(toHexString(configAsHex)).toBe('0x2105');
      
      // Simulate config.chainId as decimal string
      const configAsDecimalString = '8453';
      expect(toHexString(configAsDecimalString)).toBe('0x8453'); // Note: this is different!
    });

    it('should handle gas values correctly', () => {
      const gasPrice = BigInt('21000000000'); // 21 gwei
      expect(toHex(gasPrice)).toBe('0x4e3b29200');
      
      const gasLimit = BigInt('21000');
      expect(toHex(gasLimit)).toBe('0x5208');
    });
  });
});