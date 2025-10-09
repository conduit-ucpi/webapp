#!/usr/bin/env node

/**
 * Script to clear a stuck nonce by sending a cancel transaction
 * Usage: node clear-stuck-nonce.js [wallet-address]
 */

const { ethers } = require('ethers');

async function clearStuckNonce(walletAddress) {
  const RPC_URL = process.env.RPC_URL || 'https://mainnet.base.org';
  const provider = new ethers.JsonRpcProvider(RPC_URL);

  try {
    // Get the current nonce
    const currentNonce = await provider.getTransactionCount(walletAddress, 'latest');
    const pendingNonce = await provider.getTransactionCount(walletAddress, 'pending');

    console.log('Current nonce (latest):', currentNonce);
    console.log('Pending nonce:', pendingNonce);

    if (pendingNonce > currentNonce) {
      console.log(`Found stuck transaction with nonce ${currentNonce}`);
      console.log('To clear it, send a transaction to yourself with:');
      console.log(`- Nonce: ${currentNonce}`);
      console.log('- Higher gas price than the stuck transaction');
      console.log('- Zero value');
      console.log('- To address: your own wallet');

      // Get current gas price for reference
      const feeData = await provider.getFeeData();
      const suggestedMaxFee = feeData.maxFeePerGas * 150n / 100n; // 50% higher
      console.log(`\nSuggested gas price: ${ethers.formatUnits(suggestedMaxFee, 'gwei')} gwei`);

      return {
        stuckNonce: currentNonce,
        suggestedGasPrice: suggestedMaxFee
      };
    } else {
      console.log('No stuck transactions found');
      return null;
    }
  } catch (error) {
    console.error('Error checking nonce:', error);
    throw error;
  }
}

// Run if called directly
if (require.main === module) {
  const walletAddress = process.argv[2] || '0xdF15927D3818ED4C0b1448c783B6984d54Bd4888';

  clearStuckNonce(walletAddress)
    .then(result => {
      if (result) {
        console.log('\n✅ Stuck nonce detected. Follow the instructions above to clear it.');
      } else {
        console.log('\n✅ No issues detected.');
      }
    })
    .catch(err => {
      console.error('❌ Error:', err);
      process.exit(1);
    });
}

module.exports = { clearStuckNonce };