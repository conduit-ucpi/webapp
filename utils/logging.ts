/**
 * Utilities for formatting blockchain amounts in logs for readability
 * ALL AMOUNTS ARE DISPLAYED IN ETH FOR EASY COMPARISON
 */

/**
 * Format ETH amounts in scientific notation for readable logging
 */
export function formatEthForLogging(ethAmount: number): string {
  if (ethAmount === 0) return '0 ETH';
  return `${ethAmount.toExponential(2)} ETH`;
}

/**
 * Convert wei to ETH and format for logging - THE MAIN LOGGING FUNCTION
 */
export function formatWeiAsEthForLogging(weiAmount: bigint | string | number): string {
  const wei = typeof weiAmount === 'bigint' ? Number(weiAmount) : Number(weiAmount);
  const eth = wei / 1000000000000000000;
  return formatEthForLogging(eth);
}

/**
 * Convert gwei to ETH and format for logging
 */
export function formatGweiAsEthForLogging(gweiAmount: number): string {
  const eth = gweiAmount / 1000000000;
  return formatEthForLogging(eth);
}

/**
 * Convert microUSDC to USDC and format for logging
 */
export function formatMicroUSDCForLogging(microUSDC: bigint | string | number): string {
  const micro = typeof microUSDC === 'bigint' ? Number(microUSDC) : Number(microUSDC);
  const usdc = micro / 1000000;
  if (usdc === 0) return '0 USDC';
  return `${usdc.toExponential(2)} USDC`;
}