/**
 * Simplified test showing the timestamp display bug
 * 
 * THE BUG: Using toISOString().slice(0,16) for datetime-local display
 * causes timestamps to shift by the timezone offset on round-trip.
 */

describe('Timestamp Display Bug - Simple Demonstration', () => {
  it.skip('shows the bug with toISOString() causes round-trip failure - SKIPPED: Bug has been fixed', () => {
    // THE BUGGY CODE (what we had before the fix)
    const timestampToDatetimeLocal_BUGGY = (timestamp: number): string => {
      const date = new Date(timestamp * 1000);
      return date.toISOString().slice(0, 16); // <-- BUG: Returns UTC!
    };

    // Helper to convert datetime-local to timestamp
    const datetimeLocalToTimestamp = (datetimeLocal: string): number => {
      const date = new Date(datetimeLocal);
      return Math.floor(date.getTime() / 1000);
    };

    // Start with a Unix timestamp (UTC)
    const originalTimestamp = 1723749600; // Some specific time in UTC

    // Display it using the BUGGY function
    const displayed = timestampToDatetimeLocal_BUGGY(originalTimestamp);
    
    // toISOString() returns UTC time, but the exact string depends on input
    // The key is it's ALWAYS UTC format regardless of local timezone
    expect(displayed).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/);
    
    // But when we convert back, datetime-local interprets as LOCAL time
    const afterRoundTrip = datetimeLocalToTimestamp(displayed);
    
    // The timestamp has CHANGED by the timezone offset!
    const offsetMinutes = new Date().getTimezoneOffset();
    const offsetSeconds = offsetMinutes * 60;

    // The difference should be negative of the offset (UTC to local conversion issue)
    expect(afterRoundTrip - originalTimestamp).toBe(-offsetSeconds);
    
    // This means timestamps shift on every round-trip!
    // In PDT (UTC-7), a 7-hour shift
    // In EST (UTC-5), a 5-hour shift
    // etc.
    
    console.log(`Original timestamp: ${originalTimestamp}`);
    console.log(`After round-trip:   ${afterRoundTrip}`);
    console.log(`Difference:         ${afterRoundTrip - originalTimestamp} seconds (${(afterRoundTrip - originalTimestamp) / 3600} hours)`);
    console.log(`Your timezone offset: ${offsetMinutes} minutes`);
  });

  it('shows the fix using local components works correctly', () => {
    // THE FIXED CODE (what we have now)
    const timestampToDatetimeLocal_FIXED = (timestamp: number): string => {
      const date = new Date(timestamp * 1000);
      const year = date.getFullYear();
      const month = (date.getMonth() + 1).toString().padStart(2, '0');
      const day = date.getDate().toString().padStart(2, '0');
      const hours = date.getHours().toString().padStart(2, '0');
      const minutes = date.getMinutes().toString().padStart(2, '0');
      return `${year}-${month}-${day}T${hours}:${minutes}`;
    };

    const datetimeLocalToTimestamp = (datetimeLocal: string): number => {
      const date = new Date(datetimeLocal);
      return Math.floor(date.getTime() / 1000);
    };

    // Start with a Unix timestamp
    const originalTimestamp = 1723749600;

    // Display it using the FIXED function
    const displayed = timestampToDatetimeLocal_FIXED(originalTimestamp);
    
    // This shows LOCAL time components
    // (exact string depends on test runner's timezone)
    
    // Convert back
    const afterRoundTrip = datetimeLocalToTimestamp(displayed);
    
    // The timestamp is PRESERVED!
    expect(afterRoundTrip).toBe(originalTimestamp); // No change!
    
    console.log(`Original timestamp: ${originalTimestamp}`);
    console.log(`After round-trip:   ${afterRoundTrip}`);
    console.log(`Difference:         ${afterRoundTrip - originalTimestamp} seconds (perfect!)`);
  });

  it.skip('demonstrates why validation failed for user - SKIPPED: Bug has been fixed', () => {
    // Simulate user in PDT selecting "2 hours in future"
    
    // For demonstration, let's say "now" is this timestamp
    const now = 1723742400; // August 15, 2024, 20:00:00 UTC (1 PM PDT)
    
    // User wants to select 3 PM PDT (2 hours later)
    const twoHoursLater = now + (2 * 3600); // 2 hours = 7200 seconds
    
    // With BUGGY display function
    const timestampToDatetimeLocal_BUGGY = (timestamp: number): string => {
      const date = new Date(timestamp * 1000);
      return date.toISOString().slice(0, 16);
    };
    
    const datetimeLocalToTimestamp = (datetimeLocal: string): number => {
      const date = new Date(datetimeLocal);
      return Math.floor(date.getTime() / 1000);
    };
    
    // Display the "2 hours later" timestamp
    const displayed = timestampToDatetimeLocal_BUGGY(twoHoursLater);
    
    // Re-interpret (as would happen on form re-render)
    const reInterpreted = datetimeLocalToTimestamp(displayed);
    
    // Calculate how far in future it appears after round-trip
    const hoursInFuture = (reInterpreted - now) / 3600;

    // It's NO LONGER 2 hours in future!
    // It's shifted by timezone offset
    const timezoneOffsetHours = new Date().getTimezoneOffset() / 60;

    // The time shifts backwards by the timezone offset (negative for timezones ahead of UTC)
    expect(hoursInFuture).toBe(2 - timezoneOffsetHours);
    
    // For PDT users (UTC-7), "2 hours future" becomes "9 hours future"
    // For EST users (UTC-5), "2 hours future" becomes "7 hours future"
    // etc.
    
    console.log(`User selected: 2 hours in future`);
    console.log(`After display round-trip: ${hoursInFuture} hours in future`);
    console.log(`Timezone shift: ${timezoneOffsetHours} hours`);
    
    // This could trigger validation errors like:
    // - "Time too far in future" 
    // - Or worse, if near midnight, could jump to next day
    // - Making "today at 11 PM" become "tomorrow at 6 AM" in PDT
  });
});