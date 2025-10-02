// Stub file to fix import errors during transition to simple approach

export function createWeb3AuthContractMethods(signFn?: any, fetchFn?: any, fundFn?: any) {
  // Stub methods - these should now be replaced with useSimpleEthers hook
  return {
    fundContract: async () => {
      throw new Error('fundContract no longer supported - use useSimpleEthers hook');
    },
    claimFunds: async () => {
      throw new Error('claimFunds no longer supported - use useSimpleEthers hook');
    },
    raiseDispute: async () => {
      throw new Error('raiseDispute no longer supported - use useSimpleEthers hook');
    }
  };
}

export function createFarcasterContractMethods(signFn?: any, fetchFn?: any, fundFn?: any) {
  // Stub methods - these should now be replaced with useSimpleEthers hook
  return {
    fundContract: async () => {
      throw new Error('fundContract no longer supported - use useSimpleEthers hook');
    },
    claimFunds: async () => {
      throw new Error('claimFunds no longer supported - use useSimpleEthers hook');
    },
    raiseDispute: async () => {
      throw new Error('raiseDispute no longer supported - use useSimpleEthers hook');
    }
  };
}