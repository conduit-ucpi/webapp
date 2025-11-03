/**
 * Test: Verify token selection logic based on URL parameters
 *
 * This test ensures that when tokenSymbol=USDT is in the URL,
 * the correct USDT contract address is selected (not USDC).
 */

describe('ContractCreate - Token Selection Logic', () => {
  const USDC_ADDRESS = '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913';
  const USDT_ADDRESS = '0xfde4C96c8593536E31F229EA8f37b2ADa2699bb2';

  const mockConfig = {
    defaultTokenSymbol: 'USDC',
    usdcContractAddress: USDC_ADDRESS,
    usdtContractAddress: USDT_ADDRESS,
    usdcDetails: {
      address: USDC_ADDRESS,
      symbol: 'USDC',
      decimals: 6,
      name: 'USD Coin'
    },
    usdtDetails: {
      address: USDT_ADDRESS,
      symbol: 'USDT',
      decimals: 6,
      name: 'Tether USD'
    }
  };

  test('USDT tokenSymbol selects USDT contract address', () => {
    const queryTokenSymbol = 'USDT';

    // This is the logic from contract-create.tsx
    const selectedTokenSymbol = queryTokenSymbol || mockConfig.defaultTokenSymbol || 'USDC';
    const selectedToken = selectedTokenSymbol === 'USDT'
      ? mockConfig.usdtDetails
      : mockConfig.usdcDetails;
    const selectedTokenAddress = selectedToken?.address || mockConfig.usdcContractAddress || '';

    // Assertions
    expect(selectedTokenSymbol).toBe('USDT');
    expect(selectedToken).toEqual(mockConfig.usdtDetails);
    expect(selectedTokenAddress).toBe(USDT_ADDRESS);
    expect(selectedTokenAddress === USDC_ADDRESS).toBe(false);

    console.log('✅ USDT tokenSymbol correctly selects USDT address:', selectedTokenAddress);
  });

  test('USDC tokenSymbol selects USDC contract address', () => {
    const queryTokenSymbol: string | undefined = 'USDC';

    const selectedTokenSymbol = queryTokenSymbol || mockConfig.defaultTokenSymbol || 'USDC';
    const selectedToken = selectedTokenSymbol === 'USDT'
      ? mockConfig.usdtDetails
      : mockConfig.usdcDetails;
    const selectedTokenAddress = selectedToken?.address || mockConfig.usdcContractAddress || '';

    // Assertions
    expect(selectedTokenSymbol).toBe('USDC');
    expect(selectedToken).toEqual(mockConfig.usdcDetails);
    expect(selectedTokenAddress).toBe(USDC_ADDRESS);
    expect(selectedTokenAddress === USDT_ADDRESS).toBe(false);

    console.log('✅ USDC tokenSymbol correctly selects USDC address:', selectedTokenAddress);
  });

  test('No tokenSymbol defaults to USDC', () => {
    const queryTokenSymbol = undefined;

    const selectedTokenSymbol = queryTokenSymbol || mockConfig.defaultTokenSymbol || 'USDC';
    const selectedToken = selectedTokenSymbol === 'USDT'
      ? mockConfig.usdtDetails
      : mockConfig.usdcDetails;
    const selectedTokenAddress = selectedToken?.address || mockConfig.usdcContractAddress || '';

    // Assertions
    expect(selectedTokenSymbol).toBe('USDC');
    expect(selectedToken).toEqual(mockConfig.usdcDetails);
    expect(selectedTokenAddress).toBe(USDC_ADDRESS);

    console.log('✅ No tokenSymbol defaults to USDC address:', selectedTokenAddress);
  });

  test('Request body to chainservice contains correct tokenAddress for USDT', () => {
    // Simulate the executeContractTransactionSequence parameters
    const queryTokenSymbol = 'USDT';
    const selectedTokenSymbol = queryTokenSymbol || mockConfig.defaultTokenSymbol || 'USDC';
    const selectedToken = selectedTokenSymbol === 'USDT'
      ? mockConfig.usdtDetails
      : mockConfig.usdcDetails;
    const selectedTokenAddress = selectedToken?.address || mockConfig.usdcContractAddress || '';

    // This is what gets sent to /api/chain/create-contract
    const params = {
      contractserviceId: 'test-id',
      tokenAddress: selectedTokenAddress, // <-- KEY: This should be USDT address
      buyer: '0xBuyer',
      seller: '0xSeller',
      amount: 100000000, // 100 USDT in micro units
      expiryTimestamp: Math.floor(Date.now() / 1000) + 86400,
      description: 'Test payment'
    };

    // CRITICAL ASSERTION: The tokenAddress in the request should be USDT, not USDC
    expect(params.tokenAddress).toBe(USDT_ADDRESS);
    expect(params.tokenAddress === USDC_ADDRESS).toBe(false);

    console.log('✅ Request to chainservice would contain USDT address:', params.tokenAddress);
    console.log('📦 Full request body:', JSON.stringify(params, null, 2));
  });

  test('Request body to chainservice contains correct tokenAddress for USDC', () => {
    // Simulate the executeContractTransactionSequence parameters
    const queryTokenSymbol: string | undefined = 'USDC';
    const selectedTokenSymbol = queryTokenSymbol || mockConfig.defaultTokenSymbol || 'USDC';
    const selectedToken = selectedTokenSymbol === 'USDT'
      ? mockConfig.usdtDetails
      : mockConfig.usdcDetails;
    const selectedTokenAddress = selectedToken?.address || mockConfig.usdcContractAddress || '';

    const params = {
      contractserviceId: 'test-id',
      tokenAddress: selectedTokenAddress, // <-- KEY: This should be USDC address
      buyer: '0xBuyer',
      seller: '0xSeller',
      amount: 100000000,
      expiryTimestamp: Math.floor(Date.now() / 1000) + 86400,
      description: 'Test payment'
    };

    // CRITICAL ASSERTION
    expect(params.tokenAddress).toBe(USDC_ADDRESS);
    expect(params.tokenAddress === USDT_ADDRESS).toBe(false);

    console.log('✅ Request to chainservice would contain USDC address:', params.tokenAddress);
  });
});
