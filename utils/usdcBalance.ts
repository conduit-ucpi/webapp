import { ethers } from 'ethers';

/**
 * Fetch USDC balance for a wallet address
 * @param userAddress - The wallet address to check
 * @param usdcContractAddress - The USDC contract address
 * @param ethersProvider - The ethers provider to use
 * @returns Promise<string> - The formatted USDC balance
 */
export async function fetchUSDCBalance(
  userAddress: string,
  usdcContractAddress: string,
  ethersProvider: any
): Promise<string> {
  try {
    console.log('Getting USDC balance with ethers for contract:', usdcContractAddress);

    // ERC20 ABI for balanceOf function
    const erc20Abi = [
      'function balanceOf(address owner) view returns (uint256)'
    ];

    const usdcContract = new ethers.Contract(
      usdcContractAddress,
      erc20Abi,
      ethersProvider
    );

    const balance = await usdcContract.balanceOf(userAddress);
    const formattedBalance = ethers.formatUnits(balance, 6); // USDC has 6 decimals

    console.log('USDC balance from ethers:', { raw: balance.toString(), formatted: formattedBalance });
    return formattedBalance;
  } catch (error) {
    console.error('Failed to get USDC balance with ethers:', error);
    throw error;
  }
}