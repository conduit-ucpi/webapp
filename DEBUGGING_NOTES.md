# Debugging Notes - ConnectWalletEmbedded

## 2026-02-05: Fixed undefined connectionResult crash

### Problem
The webapp was crashing with error:
```
[ConnectWalletEmbedded] Connect wallet error {
  error: "Cannot read properties of undefined (reading 'success')",
  stack: 'TypeError: Cannot read properties of undefined...'
}
```

### Root Cause
In `components/auth/ConnectWalletEmbedded.tsx` line 216, the code accessed `connectionResult.success` without checking if `connectionResult` was `undefined` or `null`.

This could occur when:
- Config loading from `/api/config` fails
- The `connect()` function returns undefined due to initialization errors
- Unexpected errors during wallet connection setup

### Investigation Process
1. **Analyzed the error message** - Identified that `.success` was being accessed on undefined
2. **Located the problematic code** - Found line 216: `if (connectionResult.success)`
3. **Wrote a failing test** - Created `ConnectWalletEmbedded-config-error.test.tsx` that reproduced the bug
4. **Confirmed the test failed** - Verified the test detected the runtime error
5. **Fixed the code** - Added null/undefined check before accessing `.success`
6. **Verified the fix** - Confirmed the test now passes
7. **Ran all tests** - Ensured no regressions (781 tests passed)

### Solution
Added a null/undefined check before accessing `connectionResult.success`:

```typescript
const connectionResult = await connect('walletconnect');

// Handle undefined/null connectionResult (config loading failure or unexpected error)
if (!connectionResult) {
  mLog.error('ConnectWalletEmbedded', 'No connection result returned', {
    error: 'connect() returned undefined or null - possible config loading failure'
  });
  return;
}

if (connectionResult.success) {
  // ... handle success
}
```

### Test Coverage
Created comprehensive test suite in `__tests__/components/auth/ConnectWalletEmbedded-config-error.test.tsx`:
- ✅ Handles `undefined` connectionResult gracefully
- ✅ Handles `null` connectionResult gracefully
- ✅ Handles empty object `{}` connectionResult
- ✅ Handles exceptions thrown by `connect()`

### Lessons Learned
1. **Always null-check external function returns** - Even if the type signature promises a value, runtime errors can occur
2. **TDD works!** - Writing the failing test first helped confirm the bug and verify the fix
3. **Error messages should be helpful** - Now logs "No connection result returned" instead of crashing
4. **Config loading failures cascade** - If `/api/config` fails, many things downstream can break

### Files Changed
- `components/auth/ConnectWalletEmbedded.tsx` - Added null check (lines 216-222)
- `__tests__/components/auth/ConnectWalletEmbedded-config-error.test.tsx` - New test suite

### Prevention
To prevent similar issues:
1. Always check for null/undefined before accessing properties on function returns
2. Add TypeScript strict null checks (`strictNullChecks: true` in tsconfig.json)
3. Write tests for edge cases like undefined, null, and empty objects
4. Consider using optional chaining: `connectionResult?.success`
