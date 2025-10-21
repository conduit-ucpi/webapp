# MetaMask Desktop eth_maxPriorityFeePerGas Fix - Complete Solution

**Date**: 2025-10-21
**Versions**: v38.0.1 (broken) → v38.0.2 (fixed)
**Issue**: MetaMask desktop throwing "The method 'eth_maxPriorityFeePerGas' does not exist / is not available"

---

## Problem Analysis

### Initial Symptoms
- MetaMask desktop users getting RPC error when trying to read gas prices
- Error: `MetaMask - RPC Error: The method "eth_maxPriorityFeePerGas" does not exist / is not available`
- Provider being created multiple times instead of using singleton pattern
- Old cached providers persisting across deployments

### Root Causes Discovered

#### 1. **Dynamic Toolkit Code Path Returned Early Without Hybrid Wrapping** (PRIMARY BUG)

```typescript
// ❌ BUG IN v38.0.1 - lib/auth/providers/DynamicProvider.ts:297-303
try {
  const web3Provider = await this.retryGetWeb3Provider(dynamicWallet);
  if (web3Provider) {
    this.cachedEthersProvider = web3Provider as ethers.BrowserProvider;
    mLog.info('DynamicProvider', '✅ Ethers provider created successfully via Dynamic toolkit');
    return;  // ❌ EARLY RETURN - skips hybrid wrapping!
  }
}
```

**Impact**:
- MetaMask desktop always used Dynamic toolkit path
- Hybrid provider wrapper was NEVER applied to MetaMask desktop
- Only the connector fallback path (used for mobile) got hybrid wrapping
- This is why the error persisted even after implementing hybrid provider

#### 2. **Version Not Set After Provider Creation** (SECONDARY BUG)

The early return also skipped setting `this.cachedProviderVersion`, causing:

```
Call 1: Check cache
  → cachedVersion = null
  → currentVersion = 'v2_hybrid'
  → MISMATCH! Invalidate cache
  → Create provider via Dynamic toolkit
  → Return early (DON'T set cachedProviderVersion)

Call 2: Check cache again
  → cachedVersion = null (still!)
  → currentVersion = 'v2_hybrid'
  → MISMATCH! Invalidate cache
  → Create provider again...

[Infinite loop of provider recreation]
```

**Impact**:
- Provider created on EVERY access (balance read, transaction, etc.)
- Singleton pattern completely broken
- Performance degradation
- Cache invalidation logic useless

---

## The Complete Fix (v38.0.2)

### Changed File
`lib/auth/providers/DynamicProvider.ts` - `setupEthersProvider()` method

### Key Changes

#### 1. **Removed Early Return from Dynamic Toolkit Path**

```typescript
// ✅ FIXED - No early return!
let rawProvider: any = null;

try {
  const web3Provider = await this.retryGetWeb3Provider(dynamicWallet);
  if (web3Provider) {
    mLog.info('DynamicProvider', '✅ Got provider from Dynamic toolkit');
    // Extract underlying EIP-1193 provider
    rawProvider = (web3Provider as any)._getConnection?.()?.provider || web3Provider;
    // NO RETURN - continues to hybrid wrapping below!
  }
} catch (toolkitError) {
  mLog.warn('DynamicProvider', 'Dynamic toolkit failed, will use connector.getWalletClient() fallback');
}
```

#### 2. **Unified Fallback Logic**

```typescript
// If Dynamic toolkit didn't work, fall back to connector
if (!rawProvider) {
  const connector = dynamicWallet.connector;
  rawProvider = await connector.getWalletClient?.() || connector.provider;
}
```

#### 3. **Universal Hybrid Wrapping Applied to ALL Paths**

```typescript
// Extract transport if it's a Viem WalletClient
let eip1193Provider = rawProvider;
if ((rawProvider as any).transport) {
  const transport = (rawProvider as any).transport;
  eip1193Provider = transport;
}

// Wrap with mobile deep links if we have a connector
const connector = dynamicWallet.connector;
let wrappedProvider = connector
  ? wrapProviderWithMobileDeepLinks(eip1193Provider, connector)
  : eip1193Provider;

// CRITICAL: Always wrap with hybrid provider (ALL wallets, ALL paths!)
wrappedProvider = wrapWithHybridProvider(wrappedProvider, {
  rpcUrl: this.config.rpcUrl,
  chainId: this.config.chainId
});

// Create ethers BrowserProvider and set version
this.cachedEthersProvider = new ethers.BrowserProvider(wrappedProvider);
this.cachedProviderVersion = DynamicProvider.PROVIDER_VERSION;  // ✅ Always set!
```

---

## Architecture Summary

### Before (v38.0.1) - Broken

```
MetaMask Desktop → Dynamic Toolkit → BrowserProvider → ❌ No Hybrid Wrapper
                                                       → ❌ No Version Set
                                                       → ❌ eth_maxPriorityFeePerGas error

Mobile MetaMask → Connector Fallback → Transport → ✅ Hybrid Wrapper
                                                  → ✅ Version Set
                                                  → ✅ Works!
```

### After (v38.0.2) - Fixed

```
ALL Wallets → Try Dynamic Toolkit
           → Fallback to Connector if needed
           → Extract Transport if Viem WalletClient
           → Apply Mobile Deep Links
           → ✅ ALWAYS Apply Hybrid Wrapper
           → ✅ ALWAYS Set Version
           → ✅ Single Code Path for All!
```

---

## Benefits of the Fix

### 1. **Consistent Behavior**
- All wallets (MetaMask desktop, mobile, Web3Auth, Dynamic, WalletConnect, etc.) use the same code path
- No special cases or wallet-specific logic
- Single source of truth for provider creation

### 2. **Proper Singleton Pattern**
- Provider created ONCE on first connection
- Cached and reused for all subsequent operations
- Version tracking ensures old cached providers are invalidated on deployment

### 3. **Universal Hybrid Provider**
- ALL wallets route READ operations (eth_getBalance, eth_gasPrice, etc.) to Base RPC
- ALL wallets route WRITE operations (personal_sign, eth_sendTransaction) to wallet provider
- Eliminates entire class of wallet RPC incompatibility bugs

### 4. **Future-Proof**
- New wallets automatically get hybrid wrapping
- Changes to wallet provider RPC methods don't affect us
- Consistent gas pricing across all wallet types

---

## Testing Results

### Test Suite
- All 617 tests passing ✅
- Exit code: 0
- Type checking: ✅
- API conformance: ✅

### Test Coverage
- Dynamic toolkit path with hybrid wrapping
- Connector fallback path with hybrid wrapping
- Version invalidation logic
- Singleton pattern enforcement

---

## Expected Behavior in Production (v38.0.2)

### First Connection (After Clicking "Get Started")

```
[DynamicProvider] Connect called - opening Dynamic modal
[DynamicProvider] 🔄 Clearing cached provider for fresh connection
[DynamicProvider] Setting up provider using Dynamic toolkit {walletType: 'MetaMask', walletKey: 'metamask'}
[DynamicProvider] ✅ Got provider from Dynamic toolkit
[DynamicProvider] ✅ Got EIP-1193 provider, wrapping with hybrid provider for universal compatibility
[HybridProviderFactory] 🔧 Creating universal hybrid provider wrapper
[HybridProvider] ✅ Created hybrid provider {chainId: 8453, hasReadProvider: true, hasWalletProvider: true}
[DynamicProvider] ✅ Ethers provider created successfully with universal hybrid wrapping {version: 'v2_hybrid', hasConnector: true}
[DynamicProvider] 📝 Universal approach: ALL wallets use hybrid provider (reads via Base RPC, writes via wallet)
```

### Subsequent Operations (Balance Reading, Transactions, etc.)

```
[DynamicProvider] getEthersProviderAsync() called {hasCachedProvider: true, cachedVersion: 'v2_hybrid', currentVersion: 'v2_hybrid'}
[DynamicProvider] ✅ Returning cached ethers provider
```

**No recreation! No version mismatch! Provider reused!** 🎉

### Gas Operations

```
[HybridProvider] 📖 Routing eth_getBalance to read provider
[HybridProvider] 📖 Routing eth_gasPrice to read provider
[HybridProvider] 📖 Routing eth_feeHistory to read provider
✅ Gas price: 1.028575 gwei (from Base RPC, not MetaMask)
```

**No eth_maxPriorityFeePerGas error! All gas queries go to Base RPC!** 🎉

---

## Lessons Learned

### 1. **Early Returns Can Hide Bugs**
The early return in the Dynamic toolkit path made it look like everything was working (provider was created successfully), but it skipped critical logic (hybrid wrapping and version setting).

### 2. **Always Check ALL Code Paths**
The hybrid provider implementation worked for mobile (connector path) but not desktop (toolkit path) because we only tested one path initially.

### 3. **Logging is Critical for Debugging**
The detailed logs showing `cachedVersion: null` repeatedly helped identify the version-not-set bug.

### 4. **Test-Driven Development Works**
Writing failing tests first helped ensure the fix actually solved the problem, not just masked it.

---

## Deployment Info

- **Tag**: `farcaster-test-v38.0.2`
- **Deployment Time**: ~8-9 minutes
- **Test Environment**: https://test.conduit-ucpi.com

### Verification Checklist

After deployment, verify:
- [ ] Click "Get Started" and connect with MetaMask desktop
- [ ] Check logs for hybrid provider creation message
- [ ] View balance (should work without errors)
- [ ] Create contract (should work without `eth_maxPriorityFeePerGas` error)
- [ ] Check logs show `cachedVersion: 'v2_hybrid'` (not `null`)
- [ ] Subsequent operations reuse cached provider (no recreation)

---

## Related Files

- `lib/auth/providers/DynamicProvider.ts` - Main fix
- `lib/auth/providers/hybrid-provider-factory.ts` - Hybrid provider implementation
- `__tests__/lib/web3-metamask-getFeeData-error.test.ts` - Test coverage

---

## Git History

```
e535070 - Fix MetaMask desktop eth_maxPriorityFeePerGas error with universal hybrid provider + cache invalidation
cccd142 - Fix MetaMask desktop error - COMPLETE FIX: Apply hybrid provider wrapper to ALL code paths
```

**Status**: ✅ FIXED in v38.0.2
