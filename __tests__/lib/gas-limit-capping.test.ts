import { Web3Service } from '../../lib/web3';

// Mock ethers module
jest.mock('ethers', () => ({
  ethers: {
    BrowserProvider: jest.fn().mockImplementation(() => ({
      getFeeData: jest.fn().mockResolvedValue({
        gasPrice: BigInt('1000000000') // 1 nAVAX
      })
    })),
    Contract: jest.fn(),
    keccak256: jest.fn(),
    toUtf8Bytes: jest.fn(),
    formatUnits: jest.fn(),
    parseUnits: jest.fn(),
  }
}));

describe('Gas Limit Capping', () => {
  let web3Service: Web3Service;
  let mockConfig: any;
  
  beforeEach(() => {
    mockConfig = {
      web3AuthClientId: 'test',
      web3AuthNetwork: 'sapphire_devnet',
      chainId: 43113,
      rpcUrl: 'https://api.avax-test.network/ext/bc/C/rpc',
      usdcContractAddress: '0x123',
      moonPayApiKey: 'test',
      minGasWei: '5',
      basePath: '',
      snowtraceBaseUrl: 'https://testnet.snowtrace.io',
      serviceLink: 'http://localhost:3000',
      // Gas limit configuration
      depositFundsFoundryGas: 86500,
      claimFundsFoundryGas: 50000,
      raiseDisputeFoundryGas: 60000,
      usdcGrantFoundryGas: 45000,
      gasMultiplier: 1.1
    };
    
    web3Service = new Web3Service(mockConfig);
  });

  it('should extract method names correctly from transaction data', () => {
    // Use reflection to access private method for testing
    const extractMethodName = (web3Service as any).extractMethodName.bind(web3Service);
    
    expect(extractMethodName('0x3ccfd60b0123456789abcdef')).toBe('depositFunds');
    expect(extractMethodName('0xdf8de3e7456789abcdef0123')).toBe('claimFunds');
    expect(extractMethodName('0x1c6a0c4c789abcdef0123456')).toBe('raiseDispute');
    expect(extractMethodName('0x095ea7b3abcdef0123456789')).toBe('approve');
    expect(extractMethodName('0xa9059cbbdef0123456789abc')).toBe('transfer');
    expect(extractMethodName('0x12345678')).toBe(null); // unknown method
    expect(extractMethodName('')).toBe(null); // empty data
  });

  it('should apply gas limit capping when foundry limits are configured', async () => {
    // Mock provider initialization
    const mockProvider = {
      getFeeData: jest.fn().mockResolvedValue({
        gasPrice: BigInt('1000000000')
      })
    };
    
    (web3Service as any).provider = mockProvider;
    
    const prepareTransaction = (web3Service as any).prepareTransactionWithGas.bind(web3Service);
    
    const mockTx = {
      data: '0x3ccfd60b0123456789abcdef', // depositFunds selector
      to: '0x123...'
    };
    
    // Ethers estimate of 131055 (the inflated value)
    const ethersEstimate = BigInt(131055);
    
    const result = await prepareTransaction(mockTx, ethersEstimate);
    
    // Expected: min(131055, 86500 * 1.1) = min(131055, 95150) = 95150
    expect(result.gasLimit).toBe(BigInt(95150));
  });

  it('should use ethers estimate when it is lower than capped limit', async () => {
    const mockProvider = {
      getFeeData: jest.fn().mockResolvedValue({
        gasPrice: BigInt('1000000000')
      })
    };
    
    (web3Service as any).provider = mockProvider;
    
    const prepareTransaction = (web3Service as any).prepareTransactionWithGas.bind(web3Service);
    
    const mockTx = {
      data: '0x3ccfd60b0123456789abcdef', // depositFunds selector
      to: '0x123...'
    };
    
    // Lower ethers estimate
    const ethersEstimate = BigInt(80000);
    
    const result = await prepareTransaction(mockTx, ethersEstimate);
    
    // Should use the lower ethers estimate
    expect(result.gasLimit).toBe(BigInt(80000));
  });

  it('should fall back to ethers estimate when foundry limits are not configured', async () => {
    // Config without gas limits
    const configWithoutLimits = {
      web3AuthClientId: 'test',
      web3AuthNetwork: 'sapphire_devnet',
      chainId: 43113,
      rpcUrl: 'https://api.avax-test.network/ext/bc/C/rpc',
      usdcContractAddress: '0x123',
      moonPayApiKey: 'test',
      minGasWei: '5',
      basePath: '',
      snowtraceBaseUrl: 'https://testnet.snowtrace.io',
      serviceLink: 'http://localhost:3000'
      // No foundry gas limits or multiplier
    };
    
    const web3ServiceNoLimits = new Web3Service(configWithoutLimits);
    
    const mockProvider = {
      getFeeData: jest.fn().mockResolvedValue({
        gasPrice: BigInt('1000000000')
      })
    };
    
    (web3ServiceNoLimits as any).provider = mockProvider;
    
    const prepareTransaction = (web3ServiceNoLimits as any).prepareTransactionWithGas.bind(web3ServiceNoLimits);
    
    const mockTx = {
      data: '0x3ccfd60b0123456789abcdef', // depositFunds selector
      to: '0x123...'
    };
    
    const ethersEstimate = BigInt(131055);
    
    const result = await prepareTransaction(mockTx, ethersEstimate);
    
    // Should use original ethers estimate when no capping is configured
    expect(result.gasLimit).toBe(BigInt(131055));
  });

  it('should handle different contract methods correctly', async () => {
    const mockProvider = {
      getFeeData: jest.fn().mockResolvedValue({
        gasPrice: BigInt('1000000000')
      })
    };
    
    (web3Service as any).provider = mockProvider;
    
    const prepareTransaction = (web3Service as any).prepareTransactionWithGas.bind(web3Service);
    
    // Test claimFunds capping
    const claimTx = {
      data: '0xdf8de3e7456789abcdef0123', // claimFunds selector
      to: '0x123...'
    };
    
    const ethersEstimate = BigInt(80000);
    const result = await prepareTransaction(claimTx, ethersEstimate);
    
    // Expected: min(80000, 50000 * 1.1) = min(80000, 55000) = 55000
    expect(result.gasLimit).toBe(BigInt(55000));
  });
});