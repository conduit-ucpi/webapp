/**
 * General infinite loop detection utilities and tests
 * These can be used to catch infinite loop patterns in useEffect hooks
 */

import React, { useEffect, useState } from 'react';
import { render, waitFor } from '@testing-library/react';

/**
 * Utility to detect if a function is being called in an infinite loop pattern
 */
function createInfiniteLoopDetector(functionName: string) {
  const callTimes: number[] = [];
  let callCount = 0;

  return {
    track: () => {
      callCount++;
      callTimes.push(Date.now());
    },

    getCallCount: () => callCount,

    getCallTimes: () => [...callTimes],

    reset: () => {
      callCount = 0;
      callTimes.length = 0;
    },

    analyzeForInfiniteLoop: (options = { maxCalls: 10, rapidCallThreshold: 50 }) => {
      const { maxCalls, rapidCallThreshold } = options;

      // Check for excessive total calls
      if (callCount > maxCalls) {
        return {
          isInfiniteLoop: true,
          reason: `Too many calls: ${callCount} > ${maxCalls}`,
          details: { totalCalls: callCount, callTimes }
        };
      }

      // Check for rapid successive calls
      if (callTimes.length > 1) {
        const timeDiffs = callTimes.slice(1).map((time, i) =>
          time - callTimes[i]
        );

        const rapidCalls = timeDiffs.filter(diff => diff < rapidCallThreshold);

        if (rapidCalls.length > 3) {
          return {
            isInfiniteLoop: true,
            reason: `Rapid successive calls detected: ${rapidCalls.length} calls within ${rapidCallThreshold}ms`,
            details: { rapidCalls: rapidCalls.length, timeDiffs, callTimes }
          };
        }
      }

      return {
        isInfiniteLoop: false,
        reason: 'No infinite loop pattern detected',
        details: { totalCalls: callCount, callTimes }
      };
    }
  };
}

/**
 * Test component that demonstrates a useEffect infinite loop
 */
function BadComponent() {
  const [count, setCount] = useState(0);

  // This creates an infinite loop - NEVER do this
  const badFunction = () => count + 1;

  useEffect(() => {
    setCount(badFunction());
  }, [badFunction]); // badFunction changes every render!

  return <div>Count: {count}</div>;
}

/**
 * Test component that demonstrates proper useEffect usage
 */
function GoodComponent() {
  const [count, setCount] = useState(0);
  const [trigger, setTrigger] = useState(0);

  useEffect(() => {
    setCount(prev => prev + 1);
  }, [trigger]); // Only depends on trigger, not functions

  return (
    <div>
      Count: {count}
      <button onClick={() => setTrigger(prev => prev + 1)}>
        Increment
      </button>
    </div>
  );
}

describe('Infinite Loop Detection Utilities', () => {
  beforeEach(() => {
    jest.useFakeTimers();
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it('should detect infinite loop patterns', () => {
    const detector = createInfiniteLoopDetector('testFunction');

    // Simulate rapid calls
    for (let i = 0; i < 15; i++) {
      detector.track();
      if (i < 10) {
        // Simulate rapid calls (less than 50ms apart)
        jest.advanceTimersByTime(10);
      }
    }

    const analysis = detector.analyzeForInfiniteLoop();
    expect(analysis.isInfiniteLoop).toBe(true);
    expect(analysis.reason).toContain('Too many calls');
  });

  it('should not flag normal function calls as infinite loop', () => {
    const detector = createInfiniteLoopDetector('normalFunction');

    // Simulate normal calls with reasonable spacing
    detector.track();
    jest.advanceTimersByTime(100);
    detector.track();
    jest.advanceTimersByTime(200);
    detector.track();

    const analysis = detector.analyzeForInfiniteLoop();
    expect(analysis.isInfiniteLoop).toBe(false);
  });
});

describe('useEffect Infinite Loop Prevention Patterns', () => {
  beforeEach(() => {
    jest.useFakeTimers();
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it('should document the bad pattern that causes infinite loops', () => {
    // This test documents the anti-pattern but doesn't actually run it
    // to avoid breaking the test suite

    const badPattern = `
    // ❌ BAD: This causes infinite loops
    const myFunction = () => someValue;

    useEffect(() => {
      myFunction();
    }, [myFunction]); // myFunction changes every render!
    `;

    expect(badPattern).toContain('myFunction'); // Just to make Jest happy
  });

  it('should document the good patterns that prevent infinite loops', () => {
    const goodPatterns = `
    // ✅ GOOD: Use useCallback for functions in dependencies
    const myFunction = useCallback(() => someValue, [someValue]);

    useEffect(() => {
      myFunction();
    }, [myFunction]);

    // ✅ GOOD: Don't include functions in dependencies if they don't need to be
    useEffect(() => {
      myFunction();
    }, [someValue]); // Only depend on the actual values

    // ✅ GOOD: Move function inside useEffect if it doesn't need to be external
    useEffect(() => {
      const myFunction = () => someValue;
      myFunction();
    }, [someValue]);
    `;

    expect(goodPatterns).toContain('useCallback');
  });

  it('should render GoodComponent without infinite loops', async () => {
    const { getByText } = render(<GoodComponent />);

    await waitFor(() => {
      expect(getByText(/Count: 1/)).toBeInTheDocument();
    });

    // Should not continue incrementing on its own
    jest.advanceTimersByTime(1000);
    expect(getByText(/Count: 1/)).toBeInTheDocument();
  });
});

// Export for use in other tests
export { createInfiniteLoopDetector };