# useEffect Dependency Anti-Patterns

This document describes common anti-patterns that can cause infinite loops in React useEffect hooks, specifically patterns that we've encountered in this codebase.

## The Problem Pattern

```typescript
// ❌ DANGEROUS: This causes infinite loops
const { someFunction } = useSomeHook();

useEffect(() => {
  someFunction();
}, [someFunction]); // someFunction is recreated on every render!
```

### Why This Happens

1. `useSomeHook()` returns a new function reference on every render
2. `useEffect` sees a new dependency and runs again
3. This may trigger state updates that cause re-renders
4. Go to step 1 → infinite loop

## The Fix Patterns

### Option 1: Remove Function from Dependencies (Recommended)
```typescript
// ✅ GOOD: Only depend on the actual values that matter
const { someFunction } = useSomeHook();

useEffect(() => {
  someFunction();
}, [user?.walletAddress, config?.contractAddress]); // Only values that actually change
```

### Option 2: Use useCallback in the Hook
```typescript
// ✅ GOOD: Wrap the function with useCallback in the hook
const useSomeHook = () => {
  const someFunction = useCallback(() => {
    // implementation
  }, [/* stable dependencies */]);

  return { someFunction };
};
```

### Option 3: Move Function Inside useEffect
```typescript
// ✅ GOOD: Define function inside useEffect if it doesn't need to be external
useEffect(() => {
  const someFunction = () => {
    // implementation
  };

  someFunction();
}, [user?.walletAddress, config?.contractAddress]);
```

## Real Example From Our Codebase

### Before (Causes Infinite Loop)
```typescript
const { getUSDCBalance } = useSimpleEthers();

useEffect(() => {
  const fetchBalance = async () => {
    const balance = await getUSDCBalance();
    setUserBalance(balance);
  };

  fetchBalance();
}, [user?.walletAddress, config?.usdcContractAddress, getUSDCBalance]); // ❌ BAD
```

### After (Fixed)
```typescript
const { getUSDCBalance } = useSimpleEthers();

useEffect(() => {
  const fetchBalance = async () => {
    const balance = await getUSDCBalance();
    setUserBalance(balance);
  };

  fetchBalance();
}, [user?.walletAddress, config?.usdcContractAddress]); // ✅ GOOD
```

## ESLint Rule Recommendation

Consider adding this ESLint rule to catch these patterns:

```json
{
  "rules": {
    "react-hooks/exhaustive-deps": ["warn", {
      "additionalHooks": "(useCustomHook|useAnotherHook)"
    }]
  }
}
```

And create a custom rule to detect functions in dependencies:

```javascript
// .eslintrc.js custom rule (conceptual)
{
  "no-function-in-effect-deps": {
    "message": "Avoid including functions in useEffect dependencies. Consider useCallback or removing the function from deps.",
    "pattern": "useEffect(*, [*function*])"
  }
}
```

## Testing Strategy

Use the infinite loop detection utilities in `__tests__/utils/infinite-loop-detection.test.tsx` to:

1. Monitor function call patterns in tests
2. Detect rapid successive calls
3. Catch infinite loops before they reach production

## Prevention Checklist

Before adding a function to useEffect dependencies, ask:

- [ ] Is this function recreated on every render?
- [ ] Does this function come from a hook that doesn't use useCallback?
- [ ] Can I depend on the underlying values instead of the function?
- [ ] Can I move this function inside the useEffect?
- [ ] Do I really need this function in the dependency array?

## Common Hooks That Return New Functions

These hooks commonly return new function references on every render:

- `useSimpleEthers()` - all returned functions
- Custom hooks that don't use useCallback
- Inline arrow functions
- Functions that capture props/state without useCallback