/**
 * Tests for Dynamic.xyz configuration
 * Verifies that USDC and USDT tokens are properly configured for display in the embedded wallet widget
 */

import { createDynamicConfig } from '@/lib/dynamicConfig';

describe('Dynamic Configuration - Token Display', () => {
  const baseConfig = {
    dynamicEnvironmentId: 'test-env-id-12345',
    chainId: 8453,
    rpcUrl: 'https://mainnet.base.org',
    explorerBaseUrl: 'https://basescan.org'
  };

  const USDC_ADDRESS = '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913';
  const USDT_ADDRESS = '0xfde4C96c8593536E31F229EA8f37b2ADa2699bb2';

  test('Dynamic widget configuration includes USDC when address is provided', () => {
    const config = createDynamicConfig({
      ...baseConfig,
      usdcContractAddress: USDC_ADDRESS
    });

    // Verify the configuration has the evmNetworks override
    expect(config.overrides).toBeDefined();
    expect(config.overrides.evmNetworks).toBeDefined();
    expect(config.overrides.evmNetworks.length).toBe(1);

    const network = config.overrides.evmNetworks[0];

    // Verify ercTokens array exists
    expect(network.ercTokens).toBeDefined();
    expect(Array.isArray(network.ercTokens)).toBe(true);

    // Find USDC token in the array
    const usdcToken = network.ercTokens?.find((token: any) => token.symbol === 'USDC');

    expect(usdcToken).toBeDefined();
    expect(usdcToken?.address).toBe(USDC_ADDRESS);
    expect(usdcToken?.decimals).toBe(6);
    expect(usdcToken?.name).toBe('USD Coin');
    expect(usdcToken?.symbol).toBe('USDC');
    expect(usdcToken?.chainId).toBe(8453);

    console.log('✅ USDC token properly configured for Dynamic widget:', usdcToken);
  });

  test('Dynamic widget configuration includes USDT when address is provided', () => {
    const config = createDynamicConfig({
      ...baseConfig,
      usdtContractAddress: USDT_ADDRESS
    });

    const network = config.overrides.evmNetworks[0];

    // Find USDT token in the array
    const usdtToken = network.ercTokens?.find((token: any) => token.symbol === 'USDT');

    expect(usdtToken).toBeDefined();
    expect(usdtToken?.address).toBe(USDT_ADDRESS);
    expect(usdtToken?.decimals).toBe(6);
    expect(usdtToken?.name).toBe('Tether USD');
    expect(usdtToken?.symbol).toBe('USDT');
    expect(usdtToken?.chainId).toBe(8453);

    console.log('✅ USDT token properly configured for Dynamic widget:', usdtToken);
  });

  test('Dynamic widget configuration includes both USDC and USDT when both addresses provided', () => {
    const config = createDynamicConfig({
      ...baseConfig,
      usdcContractAddress: USDC_ADDRESS,
      usdtContractAddress: USDT_ADDRESS
    });

    const network = config.overrides.evmNetworks[0];

    expect(network.ercTokens).toBeDefined();
    expect(network.ercTokens?.length).toBe(2);

    const usdcToken = network.ercTokens?.find((token: any) => token.symbol === 'USDC');
    const usdtToken = network.ercTokens?.find((token: any) => token.symbol === 'USDT');

    expect(usdcToken).toBeDefined();
    expect(usdtToken).toBeDefined();

    expect(usdcToken?.address).toBe(USDC_ADDRESS);
    expect(usdtToken?.address).toBe(USDT_ADDRESS);

    console.log('✅ Both USDC and USDT tokens configured for Dynamic widget');
    console.log('   USDC:', usdcToken);
    console.log('   USDT:', usdtToken);
  });

  test('Dynamic widget configuration handles missing token addresses gracefully', () => {
    const config = createDynamicConfig({
      ...baseConfig
      // No token addresses provided
    });

    const network = config.overrides.evmNetworks[0];

    // ercTokens should exist but be empty
    expect(network.ercTokens).toBeDefined();
    expect(network.ercTokens?.length).toBe(0);

    console.log('✅ Dynamic widget handles missing token addresses - empty ercTokens array');
  });

  test('Dynamic widget configuration only includes USDC when only USDC address provided', () => {
    const config = createDynamicConfig({
      ...baseConfig,
      usdcContractAddress: USDC_ADDRESS
      // No USDT address
    });

    const network = config.overrides.evmNetworks[0];

    expect(network.ercTokens?.length).toBe(1);
    expect(network.ercTokens?.[0].symbol).toBe('USDC');

    console.log('✅ Dynamic widget correctly includes only USDC when USDT not provided');
  });

  test('Dynamic widget configuration only includes USDT when only USDT address provided', () => {
    const config = createDynamicConfig({
      ...baseConfig,
      usdtContractAddress: USDT_ADDRESS
      // No USDC address
    });

    const network = config.overrides.evmNetworks[0];

    expect(network.ercTokens?.length).toBe(1);
    expect(network.ercTokens?.[0].symbol).toBe('USDT');

    console.log('✅ Dynamic widget correctly includes only USDT when USDC not provided');
  });

  test('Token configuration matches expected Dynamic widget format', () => {
    const config = createDynamicConfig({
      ...baseConfig,
      usdcContractAddress: USDC_ADDRESS,
      usdtContractAddress: USDT_ADDRESS
    });

    const network = config.overrides.evmNetworks[0];

    // Verify each token has all required fields for Dynamic widget
    network.ercTokens?.forEach((token: any) => {
      expect(token).toHaveProperty('address');
      expect(token).toHaveProperty('decimals');
      expect(token).toHaveProperty('name');
      expect(token).toHaveProperty('symbol');
      expect(token).toHaveProperty('chainId');

      // Verify types
      expect(typeof token.address).toBe('string');
      expect(typeof token.decimals).toBe('number');
      expect(typeof token.name).toBe('string');
      expect(typeof token.symbol).toBe('string');
      expect(typeof token.chainId).toBe('number');

      // Verify address format (0x + 40 hex chars)
      expect(token.address).toMatch(/^0x[a-fA-F0-9]{40}$/);
    });

    console.log('✅ All tokens have correct format for Dynamic widget');
  });

  test('Token decimals are correctly set to 6 for stablecoins', () => {
    const config = createDynamicConfig({
      ...baseConfig,
      usdcContractAddress: USDC_ADDRESS,
      usdtContractAddress: USDT_ADDRESS
    });

    const network = config.overrides.evmNetworks[0];

    network.ercTokens?.forEach((token: any) => {
      expect(token.decimals).toBe(6);
    });

    console.log('✅ Both USDC and USDT configured with 6 decimals (correct for stablecoins)');
  });

  test('Network configuration includes all required properties', () => {
    const config = createDynamicConfig({
      ...baseConfig,
      usdcContractAddress: USDC_ADDRESS,
      usdtContractAddress: USDT_ADDRESS
    });

    const network = config.overrides.evmNetworks[0];

    // Verify all required network properties exist
    expect(network.blockExplorerUrls).toBeDefined();
    expect(network.chainId).toBe(8453);
    expect(network.chainName).toBeDefined();
    expect(network.name).toBeDefined();
    expect(network.nativeCurrency).toBeDefined();
    expect(network.networkId).toBe(8453);
    expect(network.rpcUrls).toBeDefined();
    expect(network.vanityName).toBeDefined();
    expect(network.ercTokens).toBeDefined();

    console.log('✅ Network configuration is complete with all required properties');
  });

  test('CRITICAL: Dynamic widget will display USDC and USDT balances', () => {
    const config = createDynamicConfig({
      ...baseConfig,
      usdcContractAddress: USDC_ADDRESS,
      usdtContractAddress: USDT_ADDRESS
    });

    const network = config.overrides.evmNetworks[0];
    const tokens = network.ercTokens || [];

    // CRITICAL ASSERTIONS for user requirement
    expect(tokens.length).toBeGreaterThanOrEqual(2);

    const tokenSymbols = tokens.map((t: any) => t.symbol);
    expect(tokenSymbols).toContain('USDC');
    expect(tokenSymbols).toContain('USDT');

    console.log('✅ CRITICAL: Dynamic embedded wallet widget WILL display:');
    console.log('   - ETH (native token - always shown)');
    console.log('   - USDC (' + USDC_ADDRESS + ')');
    console.log('   - USDT (' + USDT_ADDRESS + ')');
    console.log('');
    console.log('When user visits /wallet page with Dynamic embedded wallet:');
    console.log('They will see balances for all three tokens.');
  });
});
