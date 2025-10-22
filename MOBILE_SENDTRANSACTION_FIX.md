# Mobile MetaMask sendTransaction() Hang Bug - REVERTED

**Status**: ❌ REVERTED - Root cause was incorrect
**Date**: 2025-10-22
**Severity**: Critical - Users unable to complete USDC approval transactions on mobile
**Current Status**: Investigating why transactions don't get mined on mobile

## Problem Summary

When users accepted payment requests on mobile MetaMask, the webapp would hang forever at "Step 2: Approving USDC transfer..." even though the transaction successfully completed on the blockchain.

## Root Cause Analysis

### The Bug
1. User approves USDC in MetaMask mobile app
2. MetaMask successfully signs and broadcasts transaction
3. `eth_sendTransaction` RPC call completes and returns transaction hash
4. **BUT** `signer.sendTransaction()` Promise never resolves
5. Code hangs at `lib/web3.ts:1067` indefinitely
6. UI stuck showing "Step 2: Approving USDC transfer..." forever

### Why It Happens
**Mobile app-switching breaks ethers.js internal event system:**

When user switches: Browser → MetaMask App → Browser:
- MetaMask successfully processes the transaction
- The `eth_sendTransaction` RPC call succeeds and returns the hash
- **But** `signer.sendTransaction()` uses ethers.js internal event listeners to wait for transaction mining
- These event listeners break after the app-switch
- The Promise waits forever for events that will never fire

**Technical details:**
- `signer.sendTransaction()` = Send transaction + Wait for mining (using events)
- On mobile after app-switch, the event system is broken
- Even though the RPC call succeeded, the waiting mechanism fails

## The Fix

### Solution
**Bypass ethers.js `signer.sendTransaction()` and call `eth_sendTransaction` directly via EIP-1193 interface.**

### Implementation
**File**: `lib/web3.ts:1063-1119`

**Before (broken)**:
```typescript
const txResponse = await signer.sendTransaction(tx);
console.log('✅ Transaction sent successfully:', txResponse.hash);
return txResponse.hash;
```

**After (working)**:
```typescript
// MOBILE FIX: Send transaction directly via provider RPC call
// signer.sendTransaction() hangs on mobile because it waits for mining internally
// The wallet provider's event system breaks after app-switching
// Solution: Call eth_sendTransaction directly to get hash, then return immediately

// Get user address
const fromAddress = await signer.getAddress();

// Format transaction for eth_sendTransaction RPC call
const rpcTxParams: any = {
  from: fromAddress,
  to: tx.to,
  data: tx.data,
  value: tx.value || '0x0'
};

// Add gas parameters if available
if (tx.gasLimit) {
  rpcTxParams.gas = `0x${tx.gasLimit.toString(16)}`;
}
if (tx.maxFeePerGas) {
  rpcTxParams.maxFeePerGas = `0x${tx.maxFeePerGas.toString(16)}`;
}
if (tx.maxPriorityFeePerGas) {
  rpcTxParams.maxPriorityFeePerGas = `0x${tx.maxPriorityFeePerGas.toString(16)}`;
}

// Call eth_sendTransaction directly via provider
const provider = this.provider as any;
let txHash: string;

if (provider.request && typeof provider.request === 'function') {
  // EIP-1193 interface
  txHash = await provider.request({
    method: 'eth_sendTransaction',
    params: [rpcTxParams]
  });
} else if (provider.send && typeof provider.send === 'function') {
  // ethers JsonRpcProvider interface
  txHash = await provider.send('eth_sendTransaction', [rpcTxParams]);
} else {
  throw new Error('Provider does not support request() or send() methods');
}

console.log('✅ Transaction sent successfully:', txHash);
return txHash;
```

### How It Works
1. **MetaMask still handles ALL signing** - Nothing changes security-wise
2. **Transaction hash returns immediately** - No waiting for mining
3. **Separate `waitForTransaction()` handles confirmation** - Uses manual polling instead of broken events
4. **Works with all wallets** - MetaMask, Web3Auth, Dynamic, WalletConnect, etc.

### Key Points
- ✅ MetaMask private keys never leave MetaMask
- ✅ Same security model as before
- ✅ Just bypasses the broken waiting mechanism
- ✅ Uses raw EIP-1193 JSON-RPC interface (the official standard)
- ✅ Transaction confirmation handled by separate polling logic

## Testing

### Test Coverage
**File**: `__tests__/lib/web3-sendTransaction-hang.test.ts`

**Test demonstrates**:
1. Mock provider where `eth_sendTransaction` succeeds
2. Mock signer where `sendTransaction()` hangs forever
3. Verify our fix returns the hash immediately (< 5 seconds)
4. Test previously FAILED (timeout) - now PASSES (247ms)

**Test results**:
```
✓ should return transaction hash immediately even if signer.sendTransaction hangs (247 ms)
```

### Full Test Suite
```
Test Suites: 67 passed, 67 total
Tests:       2 skipped, 622 passed, 624 total
```

## Production Behavior

### Before Fix
1. User approves USDC in MetaMask mobile
2. UI shows "Step 2: Approving USDC transfer..."
3. Transaction succeeds on blockchain
4. **UI hangs forever - user stuck**
5. User refreshes page and sees transaction completed
6. Poor user experience - looks broken

### After Fix
1. User approves USDC in MetaMask mobile
2. UI shows "Step 2: Approving USDC transfer..."
3. Transaction hash returns immediately
4. **UI proceeds to confirmation polling**
5. "Step 2.5: Waiting for USDC approval confirmation..."
6. Transaction confirms
7. "Step 3: Depositing funds to escrow..."
8. ✅ Smooth user experience

## Related Files

### Modified Files
1. **lib/web3.ts** - Core fix (lines 1063-1119)
2. **__tests__/lib/web3-sendTransaction-hang.test.ts** - TDD test for the bug
3. **__tests__/lib/web3-metamask-getFeeData-error.test.ts** - Updated mocks

### Related Architecture
- **Hybrid Provider** (`lib/auth/providers/hybrid-provider-factory.ts`) - Routes read operations to Base RPC
- **Transaction Polling** (`lib/web3.ts:waitForTransaction()`) - Manual polling for confirmations
- **Contract Sequence** (`utils/contractTransactionSequence.ts`) - Transaction flow orchestration

## Deployment

**Version**: v37.2.25+
**Tag**: `farcaster-test-v37.2.25`
**Branch**: `main` → `build-test` → `build-production`

## Verification Steps

After deployment, verify:
1. ✅ User can accept payment request on mobile MetaMask
2. ✅ UI shows "Step 2: Approving USDC transfer..."
3. ✅ User approves in MetaMask app
4. ✅ UI advances to "Step 2.5: Waiting for USDC approval confirmation..."
5. ✅ UI advances to "Step 3: Depositing funds to escrow..."
6. ✅ Transaction completes successfully
7. ✅ No hanging at Step 2

## Architecture Decision

### Why This Approach?

**Could we configure ethers to use EIP-1193 everywhere?**
- No - ethers.js doesn't expose that as a configuration option
- `signer.sendTransaction()` is hardcoded to wait for mining
- We can't override ethers' internal methods without forking the library

**Why not just use ethers with a different configuration?**
- ethers.js doesn't have a "don't wait for mining" mode
- The waiting is baked into the `sendTransaction()` method
- Our approach (calling raw EIP-1193) is the cleanest solution

**Benefits of our approach:**
- ✅ Minimal code change (just one function)
- ✅ No library modifications
- ✅ Uses official EIP-1193 standard
- ✅ Works with all wallet types
- ✅ Easy to understand and maintain

## Why The Fix Was Reverted

After deploying v38.1.0, we discovered:
- The waiting mechanism was NOT broken
- `signer.sendTransaction()` was correctly waiting for transactions to be mined
- **The real problem**: Transactions were NOT getting mined on the blockchain
- The "fix" only returned the transaction hash immediately, but polling would still hang forever waiting for a transaction that never gets mined

### Evidence

1. **Transaction hash mismatch**: Logs showed polling for `0xc3a9bac...` but MetaMask showed `0x552d...`
2. **Two different transactions**: Our code submitted one transaction, MetaMask showed a different one
3. **Original behavior was correct**: Waiting for mining completion is the right thing to do

### Real Issue To Investigate

**Why are transactions not getting mined on mobile?**

Possible causes:
- Gas price too low / gas estimation issues
- Nonce collision / sequencing problems
- Transaction malformed or rejected by RPC
- Hybrid provider routing causing issues
- Something in the transaction parameters incompatible with mobile MetaMask

### Next Steps

1. Add comprehensive logging to capture:
   - Exact transaction parameters being sent
   - Transaction hash returned by MetaMask
   - Gas prices and nonces
   - RPC responses

2. Test on mobile to see what transaction hash MetaMask actually approves

3. Check blockchain to see if either transaction appears

4. Investigate hybrid provider - is it modifying transactions?

## Revert Details

**Reverted commit**: `91d9df4` (v38.1.0)
**Reverted files**:
- `lib/web3.ts` - Restored `signer.sendTransaction()`
- `__tests__/lib/web3-metamask-getFeeData-error.test.ts` - Removed `send()` mocks
- `MOBILE_SENDTRANSACTION_FIX.md` - Updated documentation

**Kept**:
- `__tests__/lib/web3-sendTransaction-hang.test.ts` - Documents the symptom (even if root cause was wrong)
