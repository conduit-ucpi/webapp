#!/usr/bin/env node

/**
 * Clear stuck nonce by sending a replacement transaction
 * This will clear nonce 115 so you can proceed with USDC approvals
 */

const { ethers } = require('ethers');

async function clearStuckNonce115() {
  const RPC_URL = 'https://mainnet.base.org';
  const provider = new ethers.JsonRpcProvider(RPC_URL);

  console.log('🔧 Checking current nonce state...');

  const walletAddress = '0xdF15927D3818ED4C0b1448c783B6984d54Bd4888';
  const latestNonce = await provider.getTransactionCount(walletAddress, 'latest');
  const pendingNonce = await provider.getTransactionCount(walletAddress, 'pending');

  console.log(`Latest nonce: ${latestNonce}`);
  console.log(`Pending nonce: ${pendingNonce}`);

  if (latestNonce === pendingNonce) {
    console.log('✅ No stuck transactions detected');
    return;
  }

  console.log(`❌ Detected stuck transaction with nonce ${latestNonce}`);

  // Get current gas price and suggest higher price
  const feeData = await provider.getFeeData();
  const currentMaxFee = feeData.maxFeePerGas;
  const currentPriorityFee = feeData.maxPriorityFeePerGas;

  // Increase by 50% to ensure replacement
  const newMaxFee = currentMaxFee * 150n / 100n;
  const newPriorityFee = currentPriorityFee * 150n / 100n;

  console.log('\n🔧 To clear the stuck transaction, send a transaction with these parameters:');
  console.log(`From: ${walletAddress}`);
  console.log(`To: ${walletAddress} (send to yourself)`);
  console.log(`Value: 0 ETH`);
  console.log(`Nonce: ${latestNonce}`);
  console.log(`Max Fee Per Gas: ${ethers.formatUnits(newMaxFee, 'gwei')} gwei`);
  console.log(`Max Priority Fee: ${ethers.formatUnits(newPriorityFee, 'gwei')} gwei`);
  console.log(`Gas Limit: 21000`);

  console.log('\n📱 How to do this:');
  console.log('1. Open your Web3Auth wallet or MetaMask');
  console.log('2. Go to "Send" or "Transfer"');
  console.log('3. Send 0 ETH to your own address');
  console.log('4. In Advanced settings, set the gas prices above');
  console.log('5. Make sure the nonce is set to 115');
  console.log('6. Send the transaction');
  console.log('\n💡 This will clear nonce 115 and allow future transactions to proceed');
}

clearStuckNonce115().catch(console.error);