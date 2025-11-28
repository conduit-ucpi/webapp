# Proxy Deposit Migration Guide

## Overview

This guide explains how to switch from **direct deposit** (user signs deposit transaction) to **proxy deposit** (platform pays gas for deposit).

## Current vs. New Flow

### Current Flow (Direct Deposit)
1. User approves USDC spending
2. User signs deposit transaction → calls `depositFunds()` on contract
3. Webapp waits for deposit confirmation
4. Webapp notifies contractservice via `/api/contracts/deposit-notification`

**User Experience**: User signs 2 transactions (approval + deposit) and pays gas for both

### New Flow (Proxy Deposit)
1. User approves USDC spending
2. Chainservice calls `depositFunds()` as gas payer → pulls funds from user's wallet
3. Chainservice notifies contractservice automatically

**User Experience**: User signs 1 transaction (approval only), platform pays gas for deposit

## Benefits of Proxy Deposit

- ✅ **Better UX**: Users only sign one transaction instead of two
- ✅ **Lower user costs**: Platform pays gas for the deposit transaction
- ✅ **Simpler flow**: Deposit + notification happen in one backend call
- ✅ **Consistent with smart contract design**: Utilizes `onlyBuyerOrGasPayer` modifier

## Prerequisites

Before switching, ensure:

1. ✅ Smart contract `depositFunds()` function has `onlyBuyerOrGasPayer` modifier
2. ✅ Chainservice has `/api/chain/fund-approved-contract` endpoint deployed
3. ✅ User has approved the contract to spend their tokens (approval step still required)

## How to Switch

### Step 1: Update ContractAcceptance Component

**File**: `/webapp/components/contracts/ContractAcceptance.tsx`

Find where `executeContractTransactionSequence` is called (around line 153-173) and add the new options:

```typescript
// BEFORE:
const result = await executeContractTransactionSequence(
  {
    contractserviceId: contract.id,
    tokenAddress: selectedTokenAddress,
    buyer,
    seller,
    amount: totalAmountMicroUnits,
    expiryTimestamp: contract.expiryTimestamp,
    description: contract.description
  },
  {
    authenticatedFetch,
    approveUSDC,
    depositToContract,
    getWeb3Service,
    onProgress: handleProgress
  }
);

// AFTER:
const result = await executeContractTransactionSequence(
  {
    contractserviceId: contract.id,
    tokenAddress: selectedTokenAddress,
    buyer,
    seller,
    amount: totalAmountMicroUnits,
    expiryTimestamp: contract.expiryTimestamp,
    description: contract.description
  },
  {
    authenticatedFetch,
    approveUSDC,
    depositToContract,
    depositFundsAsProxy,  // ADD THIS
    getWeb3Service,
    onProgress: handleProgress,
    useProxyDeposit: true  // ADD THIS
  }
);
```

### Step 2: Import depositFundsAsProxy

At the top of `ContractAcceptance.tsx`, ensure `depositFundsAsProxy` is destructured from the hook:

```typescript
// BEFORE:
const { approveUSDC, depositToContract, getWeb3Service } = useSimpleEthers();

// AFTER:
const { approveUSDC, depositToContract, depositFundsAsProxy, getWeb3Service } = useSimpleEthers();
```

### Step 3: Deploy Changes

1. Test locally (if possible) or in test environment
2. Commit changes to main branch
3. Push to remote
4. Deploy to `build-test` for testing
5. After verification, deploy to `build-production`

## Testing Checklist

After deploying the changes, test the following scenarios:

### Test 1: Happy Path
- [ ] Create a new contract
- [ ] Accept/fund the contract
- [ ] Verify user only signs ONE transaction (approval)
- [ ] Verify deposit happens automatically via chainservice
- [ ] Verify contract is marked as funded in contractservice
- [ ] Check transaction in block explorer - sender should be GAS_PAYER address

### Test 2: Insufficient Approval
- [ ] Approve less than the required amount
- [ ] Attempt to fund contract
- [ ] Verify proper error handling (should fail with approval error)

### Test 3: Already Funded Contract
- [ ] Try to fund an already-funded contract
- [ ] Verify proper error handling (smart contract should reject)

### Test 4: Authentication
- [ ] Verify the endpoint requires user authentication
- [ ] Check that contractservice receives proper auth headers

## Rollback Plan

If issues arise, rollback is simple:

### Option 1: Quick Rollback (No Code Change)
Change the flag back to false:
```typescript
useProxyDeposit: false  // Back to direct deposit
```

### Option 2: Full Rollback (Remove Changes)
Simply remove the two new lines:
```typescript
// Remove these:
depositFundsAsProxy,
useProxyDeposit: true
```

The code will automatically fall back to the direct deposit method.

## Monitoring

After switching, monitor:

1. **Chainservice logs**: Look for "Fund approved contract" and "depositFundsAsGasPayer" entries
2. **Contract state**: Verify contracts are being funded correctly
3. **User complaints**: Watch for issues with transaction flow
4. **Gas costs**: Monitor platform's gas spending for deposit transactions

## Troubleshooting

### Issue: "depositFundsAsProxy is not a function"
**Cause**: Function not properly imported from useSimpleEthers hook
**Fix**: Ensure you've added `depositFundsAsProxy` to the destructuring statement

### Issue: "Insufficient allowance" error
**Cause**: User's approval amount is less than the contract amount
**Fix**: This is expected behavior - ensure approval step is completing successfully before deposit

### Issue: "Unauthorized" error from chainservice
**Cause**: Authentication headers not being forwarded properly
**Fix**: Check that `authenticatedFetch` is being used and auth cookies are valid

### Issue: Contractservice not updated after deposit
**Cause**: Chainservice notification failed
**Fix**: Check chainservice logs for notification errors; the blockchain deposit may have succeeded even if notification failed

## Technical Details

### Smart Contract Change
The `depositFunds()` function now accepts calls from both `BUYER` and `GAS_PAYER`:

```solidity
// OLD: function depositFunds() external onlyBuyer
// NEW: function depositFunds() external onlyBuyerOrGasPayer
```

Funds still come from the BUYER's wallet via `safeTransferFrom(BUYER, ...)`, but the transaction can be initiated by the platform's gas payer.

### Chainservice Endpoint
**Endpoint**: `POST /api/chain/fund-approved-contract`
**Request**: `{ "contractHash": "0x..." }`
**Response**: `{ "success": true, "transactionHash": "0x..." }`

This endpoint:
1. Calls `depositFunds()` on the contract as GAS_PAYER
2. Waits for transaction confirmation
3. Notifies contractservice via `/api/contracts/deposit-notification`
4. Returns transaction hash

## Questions?

For issues or questions about this migration:
1. Check chainservice logs for transaction details
2. Verify smart contract deployment has the updated modifier
3. Ensure all services are deployed with latest code
