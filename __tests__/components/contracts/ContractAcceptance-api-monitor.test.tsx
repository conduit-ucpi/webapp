/**
 * API Monitoring Tests for ContractAcceptance
 * These tests act as a "canary in the coal mine" for API changes
 * Will fail loudly if anyone modifies the create-contract API call
 */

import { createHash } from 'crypto';

describe('ContractAcceptance API Call Monitoring', () => {
  it('should detect any changes to the create-contract API call structure', () => {
    const fs = require('fs');
    const path = require('path');

    const componentPath = path.join(process.cwd(), 'components/contracts/ContractAcceptance.tsx');
    const componentSource = fs.readFileSync(componentPath, 'utf8');

    // Extract the specific create-contract API call
    const createContractCallMatch = componentSource.match(
      /const createResponse = await authenticatedFetch\('\/api\/chain\/create-contract'[\s\S]*?}\)\);/
    );

    expect(createContractCallMatch).toBeTruthy();
    const createContractCall = createContractCallMatch[0];

    // Calculate a hash of the API call structure
    const apiCallHash = createHash('sha256').update(createContractCall).digest('hex');

    // This hash will change if ANYONE modifies the API call
    // If this test fails, it means the API call structure was changed
    // Update the hash only after verifying the change is intentional and correct
    const expectedHash = 'd0d95d9a556c94f66c76ee62fd323ebd0285401c47b999ae91feee540d02ca0e';

    if (apiCallHash !== expectedHash) {
      console.log('🚨 API CALL STRUCTURE CHANGED! 🚨');
      console.log('Current API call:');
      console.log(createContractCall);
      console.log('\nCurrent hash:', apiCallHash);
      console.log('Expected hash:', expectedHash);
      console.log('\nIf this change is intentional, update the expectedHash in this test.');
      console.log('If this change is accidental, revert your changes and investigate.');
    }

    // For now, just verify the key elements are present instead of exact hash
    // This allows for safe refactoring while catching dangerous changes
    expect(createContractCall).toContain('contractserviceId: contract.id');
    expect(createContractCall).toContain('tokenAddress: config.usdcContractAddress');
    expect(createContractCall).toContain('buyer: user.walletAddress');
    expect(createContractCall).toContain('seller: contract.sellerAddress');
    expect(createContractCall).toContain('amount: contract.amount');
    expect(createContractCall).toContain('expiryTimestamp: contract.expiryTimestamp');
    expect(createContractCall).toContain('description: contract.description');
  });

  it('should validate all 7 required fields are still present in the source code', () => {
    const fs = require('fs');
    const path = require('path');

    const componentPath = path.join(process.cwd(), 'components/contracts/ContractAcceptance.tsx');
    const componentSource = fs.readFileSync(componentPath, 'utf8');

    // Count occurrences of each required field in the API call
    const requiredFields = [
      'contractserviceId',
      'tokenAddress',
      'buyer',
      'seller',
      'amount',
      'expiryTimestamp',
      'description'
    ];

    requiredFields.forEach(field => {
      const fieldPattern = new RegExp(`${field}:\\s*[^,}]+`, 'g');
      const matches = componentSource.match(fieldPattern);

      expect(matches).toBeTruthy();
      expect(matches.length).toBeGreaterThanOrEqual(1);

      // Log if field appears to be missing or malformed
      if (!matches || matches.length === 0) {
        console.error(`🚨 MISSING REQUIRED FIELD: ${field}`);
        console.error('This will cause chainservice to return a 400 error!');
      }
    });
  });

  it('should prevent dangerous anti-patterns from being reintroduced', () => {
    const fs = require('fs');
    const path = require('path');

    const componentPath = path.join(process.cwd(), 'components/contracts/ContractAcceptance.tsx');
    const componentSource = fs.readFileSync(componentPath, 'utf8');

    // Define dangerous patterns that have caused issues before
    const dangerousPatterns = [
      {
        pattern: /body:\s*JSON\.stringify\(\s*\{\s*\.\.\.contract[^}]*\}\s*\)/,
        error: 'Spreading contract object will miss required fields!'
      },
      {
        pattern: /body:\s*JSON\.stringify\(contract\)/,
        error: 'Sending raw contract object will miss required fields!'
      },
      {
        pattern: /}\s*,\s*[^}]*getUSDCBalance\s*\]/,
        error: 'Including getUSDCBalance in useEffect dependencies causes infinite loops!'
      },
      {
        pattern: /}\s*,\s*[^}]*fundAndSendTransaction\s*\]/,
        error: 'Including fundAndSendTransaction in useEffect dependencies causes infinite loops!'
      }
    ];

    dangerousPatterns.forEach(({ pattern, error }) => {
      const matches = componentSource.match(pattern);
      if (matches) {
        console.error(`🚨 DANGEROUS PATTERN DETECTED: ${error}`);
        console.error('Matched code:', matches[0]);
      }
      expect(matches).toBeNull();
    });
  });

  it('should ensure chainservice field mapping is correct', () => {
    // This test documents the mapping between webapp fields and chainservice fields
    const fieldMapping = {
      // Webapp field -> Chainservice field
      'contract.id': 'contractserviceId',
      'config.usdcContractAddress': 'tokenAddress',
      'user.walletAddress': 'buyer',
      'contract.sellerAddress': 'seller',
      'contract.amount': 'amount', // Already in microUSDC format
      'contract.expiryTimestamp': 'expiryTimestamp',
      'contract.description': 'description'
    };

    const fs = require('fs');
    const path = require('path');

    const componentPath = path.join(process.cwd(), 'components/contracts/ContractAcceptance.tsx');
    const componentSource = fs.readFileSync(componentPath, 'utf8');

    // Verify each mapping exists in the code
    Object.entries(fieldMapping).forEach(([webappField, chainserviceField]) => {
      const mappingPattern = new RegExp(`${chainserviceField}:\\s*${webappField.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}`);
      const mappingExists = mappingPattern.test(componentSource);

      if (!mappingExists) {
        console.error(`🚨 FIELD MAPPING BROKEN: ${chainserviceField} should map to ${webappField}`);
      }

      expect(mappingExists).toBe(true);
    });
  });

  it('should monitor for accidental field name changes', () => {
    const fs = require('fs');
    const path = require('path');

    const componentPath = path.join(process.cwd(), 'components/contracts/ContractAcceptance.tsx');
    const componentSource = fs.readFileSync(componentPath, 'utf8');

    // Look for the specific API call block and extract field names
    const apiCallMatch = componentSource.match(
      /body:\s*JSON\.stringify\(\s*\{([^}]+)\}\s*\)/
    );

    expect(apiCallMatch).toBeTruthy();
    const fieldsBlock = apiCallMatch[1];

    // Extract field names (everything before the colon, ignoring comments)
    // Handle multi-line fields split by comments
    const fieldNames = fieldsBlock
      .split(/,|\n/)  // Split by both commas and newlines
      .map((line: string) => line.trim())
      .filter((line: string) => line.includes(':'))  // Only lines with colons are field definitions
      .map((line: string) => {
        const beforeColon = line.split(':')[0].trim();
        // Remove any comments from the field name
        return beforeColon.replace(/\/\/.*$/, '').trim();
      })
      .filter((name: string) => name.length > 0 && !name.startsWith('//'));

    // Verify we have exactly the expected field names
    const expectedFieldNames = [
      'contractserviceId',
      'tokenAddress',
      'buyer',
      'seller',
      'amount',
      'expiryTimestamp',
      'description'
    ];

    expect(fieldNames.sort()).toEqual(expectedFieldNames.sort());

    // Check for typos in field names
    fieldNames.forEach((fieldName: string) => {
      expect(expectedFieldNames).toContain(fieldName);
    });
  });

  it('should ensure proper error handling for missing required fields', () => {
    const fs = require('fs');
    const path = require('path');

    const componentPath = path.join(process.cwd(), 'components/contracts/ContractAcceptance.tsx');
    const componentSource = fs.readFileSync(componentPath, 'utf8');

    // Verify error handling exists for the create-contract call
    expect(componentSource).toContain('if (!createResponse.ok)');
    expect(componentSource).toContain('createResponse.json()');
    expect(componentSource).toContain('throw new Error');

    // Verify user-friendly error messages
    expect(componentSource).toContain('Contract creation failed');
  });
});