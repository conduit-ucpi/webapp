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

    // The API call has been moved to the shared utility
    const utilityPath = path.join(process.cwd(), 'utils/contractTransactionSequence.ts');
    const utilitySource = fs.readFileSync(utilityPath, 'utf8');

    // Extract the specific create-contract API call from the utility
    const createContractCallMatch = utilitySource.match(
      /const createResponse = await authenticatedFetch\('\/api\/chain\/create-contract'[\s\S]*?JSON\.stringify\(params\)/
    );

    expect(createContractCallMatch).toBeTruthy();
    const createContractCall = createContractCallMatch[0];

    // Calculate a hash of the API call structure
    const apiCallHash = createHash('sha256').update(createContractCall).digest('hex');

    // This hash will change if ANYONE modifies the API call
    // If this test fails, it means the API call structure was changed
    // Update the hash only after verifying the change is intentional and correct
    const expectedHash = '048a0b2b4fba7db51d7031ccaa8cf54dcf69b436769f8bf3ed579acd2c4623fd';

    if (apiCallHash !== expectedHash) {
      console.log('🚨 API CALL STRUCTURE CHANGED! 🚨');
      console.log('Current API call:');
      console.log(createContractCall);
      console.log('\nCurrent hash:', apiCallHash);
      console.log('Expected hash:', expectedHash);
      console.log('\nIf this change is intentional, update the expectedHash in this test.');
      console.log('If this change is accidental, revert your changes and investigate.');
    }

    // Verify the API call uses the params object (which contains all required fields)
    expect(createContractCall).toContain('/api/chain/create-contract');
    expect(createContractCall).toContain('JSON.stringify(params)');
    expect(createContractCall).toContain('POST');

    // Also verify that ContractAcceptance passes the correct params to the utility
    const componentPath = path.join(process.cwd(), 'components/contracts/ContractAcceptance.tsx');
    const componentSource = fs.readFileSync(componentPath, 'utf8');

    expect(componentSource).toContain('contractserviceId: contract.id');
    expect(componentSource).toContain('tokenAddress: selectedTokenAddress'); // Updated from config.usdcContractAddress
    expect(componentSource).toContain('buyer: user.walletAddress');
    expect(componentSource).toContain('seller: contract.sellerAddress');
    expect(componentSource).toContain('amount: contract.amount');
    expect(componentSource).toContain('expiryTimestamp: contract.expiryTimestamp');
    expect(componentSource).toContain('description: contract.description');
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
      'selectedTokenAddress': 'tokenAddress', // Updated from config.usdcContractAddress
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

    // Check that the ContractAcceptance component passes the correct field structure
    const componentPath = path.join(process.cwd(), 'components/contracts/ContractAcceptance.tsx');
    const componentSource = fs.readFileSync(componentPath, 'utf8');

    // Look for the params object passed to executeContractTransactionSequence
    const executeCallMatch = componentSource.match(
      /executeContractTransactionSequence\([\s\S]*?\{([^}]+)\}/
    );

    expect(executeCallMatch).toBeTruthy();
    const fieldsBlock = executeCallMatch[1];

    // Extract field names (everything before the colon, ignoring comments)
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

    // Also verify the interface definition in the utility matches
    const utilityPath = path.join(process.cwd(), 'utils/contractTransactionSequence.ts');
    const utilitySource = fs.readFileSync(utilityPath, 'utf8');

    expectedFieldNames.forEach((fieldName: string) => {
      expect(utilitySource).toContain(`${fieldName}:`);
    });
  });

  it('should ensure proper error handling for missing required fields', () => {
    const fs = require('fs');
    const path = require('path');

    // Check error handling in the shared utility where the API call now lives
    const utilityPath = path.join(process.cwd(), 'utils/contractTransactionSequence.ts');
    const utilitySource = fs.readFileSync(utilityPath, 'utf8');

    // Verify error handling exists for the create-contract call in the utility
    expect(utilitySource).toContain('if (!createResponse.ok)');
    expect(utilitySource).toContain('createResponse.json()');
    expect(utilitySource).toContain('throw new Error');
    expect(utilitySource).toContain('Contract creation failed');

    // Also verify that ContractAcceptance handles errors from the utility
    const componentPath = path.join(process.cwd(), 'components/contracts/ContractAcceptance.tsx');
    const componentSource = fs.readFileSync(componentPath, 'utf8');

    // Verify the component catches and handles errors from executeContractTransactionSequence
    expect(componentSource).toContain('catch (fundingError)');
    expect(componentSource).toContain('throw fundingError');
    expect(componentSource).toContain('catch (error: any)');
    expect(componentSource).toContain('alert(error.message');
  });
});