/**
 * Regression Protection Test for ContractAcceptance Critical Bugs
 *
 * This test protects against regressions of two specific bugs:
 * 1. Double-conversion of microUSDC amounts in API calls
 * 2. Provider state not being cleared during logout/login cycles
 */

import fs from 'fs';
import path from 'path';

describe('ContractAcceptance Regression Protection', () => {

  describe('MicroUSDC Conversion Regression Protection', () => {

    it('should verify ContractAcceptance uses contract.amount directly (not toMicroUSDC)', () => {
      const componentPath = path.join(process.cwd(), 'components/contracts/ContractAcceptance.tsx');
      const componentSource = fs.readFileSync(componentPath, 'utf8');

      // CRITICAL: Must use contract.amount directly (already in microUSDC)
      expect(componentSource).toContain('amount: contract.amount');

      // CRITICAL: Must NOT double-convert with toMicroUSDC
      expect(componentSource).not.toContain('amount: toMicroUSDC(');
      expect(componentSource).not.toContain('toMicroUSDC(String(contract.amount))');
      expect(componentSource).not.toContain('toMicroUSDC(contract.amount)');

      // Additional safety checks for common incorrect patterns
      expect(componentSource).not.toContain('amount: toMicroUSDC(');
      expect(componentSource).not.toContain('contract.amount * 1000000');
      expect(componentSource).not.toContain('contract.amount * 1e6');
    });

    it('should verify approveUSDC call uses contract.amount directly', () => {
      const componentPath = path.join(process.cwd(), 'components/contracts/ContractAcceptance.tsx');
      const componentSource = fs.readFileSync(componentPath, 'utf8');

      // CRITICAL: approveUSDC should receive contract.amount.toString()
      // (already in microUSDC), not toMicroUSDC conversion
      expect(componentSource).toContain('contract.amount.toString()');

      // Must NOT double-convert in approveUSDC call
      expect(componentSource).not.toContain('toMicroUSDC(String(contract.amount)).toString()');
    });

    it('should verify all test files use correct microUSDC format', () => {
      const testFiles = [
        '__tests__/components/contracts/ContractAcceptance-api-contract.test.tsx',
        '__tests__/components/contracts/ContractAcceptance-chainservice-validation.test.tsx',
        '__tests__/components/contracts/ContractAcceptance-tokenAddress-regression.test.tsx',
      ];

      testFiles.forEach(testFile => {
        const testPath = path.join(process.cwd(), testFile);
        if (fs.existsSync(testPath)) {
          const testSource = fs.readFileSync(testPath, 'utf8');

          // Test mock contracts should use microUSDC format (large numbers)
          // NOT USDC format (small decimals like 1.5, 2.5, etc.)
          expect(testSource).toContain('// Already in microUSDC format');

          // Should not have old double-conversion expectations
          expect(testSource).not.toContain('toMicroUSDC(String(contract.amount))');
        }
      });
    });
  });

  describe('Web3Service Singleton Clearing Regression Protection', () => {

    it('should verify all auth providers clear Web3Service singleton on disconnect', () => {
      const authFiles = [
        'components/auth/web3auth.tsx',
        'components/auth/reownWalletConnect.tsx',
        'components/auth/farcasterAuth.tsx'
      ];

      authFiles.forEach(authFile => {
        const authPath = path.join(process.cwd(), authFile);
        if (fs.existsSync(authPath)) {
          const authSource = fs.readFileSync(authPath, 'utf8');

          // CRITICAL: Each disconnect method must clear the singleton
          expect(authSource).toContain('Web3Service.clearInstance()');

          // Verify the pattern exists in disconnect context
          const disconnectSections = authSource.split('disconnect');
          const hasValidClearPattern = disconnectSections.some(section =>
            section.includes('Web3Service.clearInstance()') &&
            section.length < 2000 // Within reasonable proximity to disconnect
          );

          expect(hasValidClearPattern).toBe(true);
        }
      });
    });

    it('should verify Web3Service has clearInstance method available', async () => {
      // Dynamic import to avoid module loading issues in tests
      const web3Module = await import('@/lib/web3');
      const Web3Service = web3Module.Web3Service;

      // Verify the clearInstance method exists and is callable
      expect(typeof Web3Service.clearInstance).toBe('function');

      // Test that it actually clears the instance
      const instance1 = Web3Service.getInstance({} as any);
      expect(instance1).toBeDefined();

      Web3Service.clearInstance();

      const instance2 = Web3Service.getInstance({} as any);
      expect(instance2).toBeDefined();
      expect(instance2).not.toBe(instance1); // Should be different instances
    });
  });

  describe('API Call Structure Protection', () => {

    it('should verify correct API call structure in ContractAcceptance', () => {
      const componentPath = path.join(process.cwd(), 'components/contracts/ContractAcceptance.tsx');
      const componentSource = fs.readFileSync(componentPath, 'utf8');

      // Find the create-contract API call
      const apiCallMatch = componentSource.match(
        /authenticatedFetch\(.*?\/api\/chain\/create-contract.*?body:\s*JSON\.stringify\(\s*\{([^}]+)\}/s
      );

      expect(apiCallMatch).toBeTruthy();

      if (apiCallMatch) {
        const requestBody = apiCallMatch[0];

        // Verify all required fields are present with correct patterns
        expect(requestBody).toContain('contractserviceId: contract.id');
        expect(requestBody).toContain('tokenAddress: config.usdcContractAddress');
        expect(requestBody).toContain('buyer: user.walletAddress');
        expect(requestBody).toContain('seller: contract.sellerAddress');
        expect(requestBody).toContain('amount: contract.amount'); // CRITICAL: Direct use
        expect(requestBody).toContain('expiryTimestamp: contract.expiryTimestamp');
        expect(requestBody).toContain('description: contract.description');

        // Verify incorrect patterns are NOT present
        expect(requestBody).not.toContain('...contract'); // No spread operator
        expect(requestBody).not.toContain('toMicroUSDC('); // No double conversion
      }
    });
  });

  describe('Currency Display vs API Usage Protection', () => {

    it('should document the correct pattern for currency handling', () => {
      // This test documents the correct patterns to prevent confusion

      const correctPatterns = {
        // Database storage: microUSDC (integer)
        databaseAmount: 2500000, // $2.50 as 2,500,000 microUSDC

        // API transmission: microUSDC (same as database)
        apiAmount: 2500000, // Send database value directly

        // UI display: USDC (decimal)
        displayAmount: 2.5, // Convert microUSDC to USDC for user

        // Conversion functions (when needed)
        microUSDCToDisplay: (microUSDC: number) => microUSDC / 1000000,
        displayToMicroUSDC: (usdc: number) => Math.round(usdc * 1000000),
      };

      // Verify conversion functions work correctly
      expect(correctPatterns.microUSDCToDisplay(correctPatterns.databaseAmount)).toBe(2.5);
      expect(correctPatterns.displayToMicroUSDC(correctPatterns.displayAmount)).toBe(2500000);

      // Verify API amount matches database amount (no conversion)
      expect(correctPatterns.apiAmount).toBe(correctPatterns.databaseAmount);

      // Document the incorrect pattern that caused the bug
      const incorrectPattern = {
        // BUG: Double conversion in API call
        buggyApiAmount: correctPatterns.displayToMicroUSDC(correctPatterns.microUSDCToDisplay(correctPatterns.databaseAmount))
      };

      // This should equal the original, but the bug was doing this conversion twice
      expect(incorrectPattern.buggyApiAmount).toBe(correctPatterns.databaseAmount);

      // The actual bug was: toMicroUSDC(contract.amount) where contract.amount was already microUSDC
      const simulatedBug = correctPatterns.displayToMicroUSDC(correctPatterns.databaseAmount);
      expect(simulatedBug).toBe(2500000000000); // 1000x too large!
      expect(simulatedBug).not.toBe(correctPatterns.databaseAmount);
    });
  });

  describe('Comment and Documentation Protection', () => {

    it('should verify critical comments are present to prevent future bugs', () => {
      const componentPath = path.join(process.cwd(), 'components/contracts/ContractAcceptance.tsx');
      const componentSource = fs.readFileSync(componentPath, 'utf8');

      // Look for protective comments that explain the microUSDC usage
      const hasAmountComment = componentSource.includes('// Already in microUSDC format') ||
                               componentSource.includes('// Contract.amount is already in microUSDC');

      expect(hasAmountComment).toBe(true);
    });

    it('should verify test files document the expected behavior', () => {
      const testPath = path.join(process.cwd(), '__tests__/components/contracts/ContractAcceptance-api-contract.test.tsx');
      if (fs.existsSync(testPath)) {
        const testSource = fs.readFileSync(testPath, 'utf8');

        // Should document that test amounts are in microUSDC
        expect(testSource).toContain('microUSDC format');
      }
    });
  });
});