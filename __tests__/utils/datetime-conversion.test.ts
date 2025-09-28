import {
  timestampToDatetimeLocal,
  datetimeLocalToTimestamp
} from '@/utils/validation';

/**
 * Comprehensive tests for datetime-local conversion functions
 * These functions are critical for handling user timezone correctly
 * and preventing timezone-related bugs
 */
describe('DateTime-Local Conversion Functions', () => {

  describe('timestampToDatetimeLocal', () => {
    it('should convert Unix timestamp to datetime-local format', () => {
      // January 1, 2024, 12:00:00 UTC
      const timestamp = 1704110400;
      const result = timestampToDatetimeLocal(timestamp);

      // Should be YYYY-MM-DDTHH:MM format
      expect(result).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/);

      // Verify structure
      const [datePart, timePart] = result.split('T');
      expect(datePart).toMatch(/^\d{4}-\d{2}-\d{2}$/);
      expect(timePart).toMatch(/^\d{2}:\d{2}$/);
    });

    it('should use local time components, not UTC', () => {
      const timestamp = 1704110400; // January 1, 2024, 12:00:00 UTC
      const result = timestampToDatetimeLocal(timestamp);

      // Create a date to get expected local components
      const expectedDate = new Date(timestamp * 1000);
      const expectedYear = expectedDate.getFullYear();
      const expectedMonth = (expectedDate.getMonth() + 1).toString().padStart(2, '0');
      const expectedDay = expectedDate.getDate().toString().padStart(2, '0');
      const expectedHours = expectedDate.getHours().toString().padStart(2, '0');
      const expectedMinutes = expectedDate.getMinutes().toString().padStart(2, '0');

      const expected = `${expectedYear}-${expectedMonth}-${expectedDay}T${expectedHours}:${expectedMinutes}`;
      expect(result).toBe(expected);
    });

    it('should handle edge cases', () => {
      // Epoch
      expect(timestampToDatetimeLocal(0)).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/);

      // Far future
      const farFuture = 2524608000; // January 1, 2050
      expect(timestampToDatetimeLocal(farFuture)).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/);

      // Recent past
      const recentPast = 1640995200; // January 1, 2022
      expect(timestampToDatetimeLocal(recentPast)).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/);
    });

    it('should pad single-digit values correctly', () => {
      // January 5, 2024, 05:05:00 local time
      const date = new Date(2024, 0, 5, 5, 5, 0);
      const timestamp = Math.floor(date.getTime() / 1000);
      const result = timestampToDatetimeLocal(timestamp);

      // Should have padded zeros
      expect(result).toContain('01-05'); // Month and day
      expect(result).toContain('T05:05'); // Hours and minutes
    });

    it('should handle different times of day', () => {
      // Midnight
      const midnight = new Date(2024, 0, 1, 0, 0, 0);
      const midnightTs = Math.floor(midnight.getTime() / 1000);
      expect(timestampToDatetimeLocal(midnightTs)).toContain('T00:00');

      // Noon
      const noon = new Date(2024, 0, 1, 12, 0, 0);
      const noonTs = Math.floor(noon.getTime() / 1000);
      expect(timestampToDatetimeLocal(noonTs)).toContain('T12:00');

      // 11:59 PM
      const almostMidnight = new Date(2024, 0, 1, 23, 59, 0);
      const almostMidnightTs = Math.floor(almostMidnight.getTime() / 1000);
      expect(timestampToDatetimeLocal(almostMidnightTs)).toContain('T23:59');
    });
  });

  describe('datetimeLocalToTimestamp', () => {
    it('should convert datetime-local format to Unix timestamp', () => {
      const datetimeLocal = '2024-01-01T12:00';
      const result = datetimeLocalToTimestamp(datetimeLocal);

      // Should be a number
      expect(typeof result).toBe('number');

      // Should be Unix seconds, not milliseconds
      expect(result.toString().length).toBeLessThanOrEqual(10);

      // Verify it represents the correct time
      const date = new Date(datetimeLocal);
      const expectedTimestamp = Math.floor(date.getTime() / 1000);
      expect(result).toBe(expectedTimestamp);
    });

    it('should interpret as local time, not UTC', () => {
      const datetimeLocal = '2024-01-01T12:00';
      const result = datetimeLocalToTimestamp(datetimeLocal);

      // The Date constructor interprets this as local time
      const localDate = new Date(2024, 0, 1, 12, 0, 0);
      const expected = Math.floor(localDate.getTime() / 1000);

      expect(result).toBe(expected);
    });

    it('should handle various datetime formats', () => {
      // Standard format
      const standard = '2024-06-15T14:30';
      expect(() => datetimeLocalToTimestamp(standard)).not.toThrow();

      // With seconds (some browsers might include this)
      const withSeconds = '2024-06-15T14:30:45';
      expect(() => datetimeLocalToTimestamp(withSeconds)).not.toThrow();

      // Edge times
      const midnight = '2024-01-01T00:00';
      expect(() => datetimeLocalToTimestamp(midnight)).not.toThrow();

      const almostMidnight = '2024-12-31T23:59';
      expect(() => datetimeLocalToTimestamp(almostMidnight)).not.toThrow();
    });

    it('should handle edge dates', () => {
      // Leap year
      const leapDay = '2024-02-29T12:00';
      const leapResult = datetimeLocalToTimestamp(leapDay);
      expect(leapResult).toBeGreaterThan(0);

      // End of year
      const endOfYear = '2024-12-31T23:59';
      const endResult = datetimeLocalToTimestamp(endOfYear);
      expect(endResult).toBeGreaterThan(0);

      // Beginning of year
      const startOfYear = '2024-01-01T00:00';
      const startResult = datetimeLocalToTimestamp(startOfYear);
      expect(startResult).toBeGreaterThan(0);
    });
  });

  describe('Round-trip conversion', () => {
    it('should preserve timestamp through round-trip conversion (with minute precision)', () => {
      // Critical: datetime-local only has minute precision, so seconds are truncated
      // Use a timestamp with 0 seconds for exact round-trip
      const originalTimestamp = 1704110400; // January 1, 2024, 12:00:00 UTC (0 seconds)

      // Convert to datetime-local
      const datetimeLocal = timestampToDatetimeLocal(originalTimestamp);

      // Convert back to timestamp
      const roundTripTimestamp = datetimeLocalToTimestamp(datetimeLocal);

      // Should be exactly the same since original has 0 seconds
      expect(roundTripTimestamp).toBe(originalTimestamp);
    });

    it('should handle round-trip for various timestamps (truncating seconds)', () => {
      const testTimestamps = [
        1704067200,  // January 1, 2024, 00:00:00 UTC (0 seconds)
        1719835200,  // July 1, 2024, 12:00:00 UTC (0 seconds)
        1735689600,  // January 1, 2025, 00:00:00 UTC (0 seconds)
        1640995200,  // January 1, 2022, 00:00:00 UTC (0 seconds)
      ];

      testTimestamps.forEach(timestamp => {
        const datetimeLocal = timestampToDatetimeLocal(timestamp);
        const roundTrip = datetimeLocalToTimestamp(datetimeLocal);
        // These timestamps have 0 seconds, so they round-trip exactly
        expect(roundTrip).toBe(timestamp);
      });

      // Test with current time (may have seconds)
      const now = Math.floor(Date.now() / 1000);
      const nowLocal = timestampToDatetimeLocal(now);
      const nowRoundTrip = datetimeLocalToTimestamp(nowLocal);

      // Should be within 60 seconds (seconds are truncated)
      expect(Math.abs(nowRoundTrip - now)).toBeLessThan(60);

      // The round-trip timestamp should have 0 seconds
      const roundTripDate = new Date(nowRoundTrip * 1000);
      expect(roundTripDate.getSeconds()).toBe(0);
    });

    it('should handle round-trip at timezone boundaries', () => {
      // Test timestamps that might cause issues at timezone boundaries

      // Just before midnight local time
      const beforeMidnight = new Date();
      beforeMidnight.setHours(23, 59, 0, 0);
      const beforeMidnightTs = Math.floor(beforeMidnight.getTime() / 1000);

      const beforeMidnightLocal = timestampToDatetimeLocal(beforeMidnightTs);
      const beforeMidnightRoundTrip = datetimeLocalToTimestamp(beforeMidnightLocal);
      expect(beforeMidnightRoundTrip).toBe(beforeMidnightTs);

      // Just after midnight local time
      const afterMidnight = new Date();
      afterMidnight.setHours(0, 1, 0, 0);
      afterMidnight.setDate(afterMidnight.getDate() + 1); // Next day
      const afterMidnightTs = Math.floor(afterMidnight.getTime() / 1000);

      const afterMidnightLocal = timestampToDatetimeLocal(afterMidnightTs);
      const afterMidnightRoundTrip = datetimeLocalToTimestamp(afterMidnightLocal);
      expect(afterMidnightRoundTrip).toBe(afterMidnightTs);
    });

    it('should NOT shift timestamps like the buggy toISOString approach would', () => {
      // This test documents why we DON'T use toISOString()
      const timestamp = 1704110400;

      // The WRONG way (what caused the bug)
      const wrongWay = (ts: number) => {
        const date = new Date(ts * 1000);
        return date.toISOString().slice(0, 16);
      };

      // The RIGHT way (our implementation)
      const rightWay = timestampToDatetimeLocal;

      // Wrong way loses timezone info
      const wrongResult = wrongWay(timestamp);
      const wrongRoundTrip = datetimeLocalToTimestamp(wrongResult);

      // Right way preserves it
      const rightResult = rightWay(timestamp);
      const rightRoundTrip = datetimeLocalToTimestamp(rightResult);

      // Our way should preserve the timestamp
      expect(rightRoundTrip).toBe(timestamp);

      // The wrong way would shift it by timezone offset (unless in UTC timezone)
      const timezoneOffset = new Date().getTimezoneOffset() * 60; // in seconds
      if (timezoneOffset !== 0) {
        expect(wrongRoundTrip).not.toBe(timestamp);
      }
    });
  });

  describe('Timezone independence', () => {
    it('should work correctly regardless of user timezone', () => {
      // This test verifies the functions work correctly no matter the timezone
      // We can't actually change the timezone in tests, but we can verify
      // that our functions use local time consistently

      // Use a timestamp with 0 seconds for exact round-trip
      const now = new Date();
      now.setSeconds(0, 0);
      const nowSeconds = Math.floor(now.getTime() / 1000);

      // Convert to datetime-local
      const local = timestampToDatetimeLocal(nowSeconds);

      // Parse it back
      const parsed = datetimeLocalToTimestamp(local);

      // Should match exactly (since we set seconds to 0)
      expect(parsed).toBe(nowSeconds);

      // Verify the string represents local time
      const expectedHour = now.getHours().toString().padStart(2, '0');
      const expectedMinute = now.getMinutes().toString().padStart(2, '0');

      expect(local).toContain(`T${expectedHour}:${expectedMinute}`);
    });

    it('should handle dates that cross timezone boundaries correctly', () => {
      // For users in timezones far from UTC, dates can be different
      // E.g., in UTC+12, when it's Jan 2, it might still be Jan 1 in UTC

      const testDate = new Date('2024-01-01T23:00:00'); // 11 PM local time Jan 1
      const timestamp = Math.floor(testDate.getTime() / 1000);

      const local = timestampToDatetimeLocal(timestamp);
      const roundTrip = datetimeLocalToTimestamp(local);

      // Regardless of timezone, round-trip should work
      expect(roundTrip).toBe(timestamp);

      // The local representation should match what the user sees
      const expectedDay = testDate.getDate().toString().padStart(2, '0');
      const expectedMonth = (testDate.getMonth() + 1).toString().padStart(2, '0');

      expect(local).toContain(`${testDate.getFullYear()}-${expectedMonth}-${expectedDay}`);
    });
  });

  describe('Integration with form inputs', () => {
    it('should produce values compatible with HTML datetime-local inputs', () => {
      const timestamp = Math.floor(Date.now() / 1000);
      const result = timestampToDatetimeLocal(timestamp);

      // HTML5 datetime-local format: YYYY-MM-DDTHH:MM
      const htmlPattern = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/;
      expect(result).toMatch(htmlPattern);

      // Should be parseable by Date constructor
      expect(() => new Date(result)).not.toThrow();

      // Should work with input type="datetime-local"
      // This format is specifically what the input expects
      expect(result.length).toBe(16); // YYYY-MM-DDTHH:MM is exactly 16 chars
    });

    it('should handle values from datetime-local inputs correctly', () => {
      // Simulate values that would come from an HTML input
      const inputValues = [
        '2024-01-15T09:30',
        '2024-12-31T23:59',
        '2024-02-29T12:00', // Leap year
        '2024-07-04T00:00', // Midnight
      ];

      inputValues.forEach(value => {
        const timestamp = datetimeLocalToTimestamp(value);

        // Should produce valid timestamp
        expect(typeof timestamp).toBe('number');
        expect(timestamp).toBeGreaterThan(0);
        expect(timestamp.toString().length).toBeLessThanOrEqual(10);

        // Should round-trip correctly
        const backToLocal = timestampToDatetimeLocal(timestamp);
        const roundTrip = datetimeLocalToTimestamp(backToLocal);
        expect(roundTrip).toBe(timestamp);
      });
    });
  });

  describe('Error handling', () => {
    it('should handle invalid input gracefully', () => {
      // Test various invalid inputs

      // Invalid datetime strings
      expect(() => datetimeLocalToTimestamp('invalid')).not.toThrow();
      expect(datetimeLocalToTimestamp('invalid')).toBeNaN();

      expect(() => datetimeLocalToTimestamp('')).not.toThrow();
      expect(datetimeLocalToTimestamp('')).toBeNaN();

      expect(() => datetimeLocalToTimestamp('2024-13-01T12:00')).not.toThrow(); // Invalid month

      // For timestampToDatetimeLocal, invalid numbers
      expect(() => timestampToDatetimeLocal(NaN)).not.toThrow();
      expect(timestampToDatetimeLocal(NaN)).toBe('NaN-NaN-NaNTNaN:NaN');

      // Negative timestamps (before epoch) should still work
      expect(() => timestampToDatetimeLocal(-86400)).not.toThrow();
      const beforeEpoch = timestampToDatetimeLocal(-86400);
      expect(beforeEpoch).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/);
    });
  });
});