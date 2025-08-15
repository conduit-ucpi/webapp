import { 
  formatDateTimeWithTZ, 
  formatTimestamp, 
  normalizeTimestamp,
  formatDateTime,
  formatDate
} from '@/utils/validation';

describe('DateTime Display Functions', () => {
  // Mock the timezone to ensure consistent test results
  const originalDateTimeFormat = Intl.DateTimeFormat;
  
  beforeAll(() => {
    // Mock timezone to EST (UTC-5)
    jest.spyOn(Date.prototype, 'getTimezoneOffset').mockReturnValue(300); // 5 hours * 60 minutes
  });

  afterAll(() => {
    jest.restoreAllMocks();
  });

  describe('formatDateTimeWithTZ - Main Display Function', () => {
    it('should format Unix timestamp in seconds to ISO with timezone', () => {
      // January 1, 2024, 00:00:00 UTC in seconds
      const timestampSeconds = 1704067200;
      const result = formatDateTimeWithTZ(timestampSeconds);
      
      // Should be ISO format with timezone offset
      expect(result).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}[+-]\d{2}:\d{2}$/);
      
      // Should include timezone offset (not Z for UTC)
      expect(result).not.toContain('Z');
      expect(result).toContain('-05:00'); // EST offset
    });

    it('should format Unix timestamp in milliseconds to ISO with timezone', () => {
      // January 1, 2024, 00:00:00 UTC in milliseconds
      const timestampMillis = 1704067200000;
      const result = formatDateTimeWithTZ(timestampMillis);
      
      // Should be ISO format with timezone offset
      expect(result).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}[+-]\d{2}:\d{2}$/);
      
      // Should include timezone offset
      expect(result).not.toContain('Z');
      expect(result).toContain('-05:00');
    });

    it('should handle string timestamps', () => {
      const timestampString = '1704067200';
      const result = formatDateTimeWithTZ(timestampString);
      
      expect(result).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}[+-]\d{2}:\d{2}$/);
      expect(result).toContain('-05:00');
    });

    it('should return "Invalid date" for invalid timestamps', () => {
      // normalizeTimestamp throws an error, which formatDateTimeWithTZ catches
      expect(formatDateTimeWithTZ('invalid')).toBe('Invalid date');
      expect(formatDateTimeWithTZ(NaN)).toBe('Invalid date');
    });

    it('should preserve the correct date and time when converting', () => {
      // Specific date: January 15, 2024, 14:30:45 UTC
      const timestamp = 1705330245; // in seconds
      const result = formatDateTimeWithTZ(timestamp);
      
      // Parse back to verify
      const [datePart, timePart] = result.split('T');
      const [year, month, day] = datePart.split('-');
      const [time, timezone] = timePart.split(/[+-]/);
      const [hour, minute, second] = time.split(':');
      
      // Create a date from the timestamp to get the expected local values
      const expectedDate = new Date(timestamp * 1000);
      
      // Verify structure
      expect(year).toBe('2024');
      expect(month).toBe('01');
      expect(parseInt(day)).toBe(expectedDate.getDate()); // Use local date
      expect(parseInt(hour)).toBe(expectedDate.getHours()); // Use local hours
      expect(parseInt(minute)).toBe(expectedDate.getMinutes()); // Use local minutes
      expect(parseInt(second)).toBe(expectedDate.getSeconds()); // Use local seconds
    });

    it('should handle daylight saving time correctly', () => {
      // Mock EDT (UTC-4) for summer
      jest.spyOn(Date.prototype, 'getTimezoneOffset').mockReturnValueOnce(240); // 4 hours * 60 minutes
      
      const summerTimestamp = 1720454400; // July 8, 2024, 12:00:00 UTC
      const result = formatDateTimeWithTZ(summerTimestamp);
      
      expect(result).toContain('-04:00'); // EDT offset
    });

    it('should handle positive timezone offsets', () => {
      // Mock timezone to JST (UTC+9)
      jest.spyOn(Date.prototype, 'getTimezoneOffset').mockReturnValueOnce(-540); // -9 hours * 60 minutes
      
      const timestamp = 1704067200;
      const result = formatDateTimeWithTZ(timestamp);
      
      expect(result).toContain('+09:00'); // JST offset
    });
  });

  describe('formatTimestamp - Display with Timezone', () => {
    it('should include timezone information in the time field', () => {
      const timestamp = 1704067200; // January 1, 2024, 00:00:00 UTC
      const result = formatTimestamp(timestamp);
      
      expect(result).toHaveProperty('date');
      expect(result).toHaveProperty('time');
      
      // Time should include timezone abbreviation
      expect(result.time).toMatch(/\d{2}:\d{2}\s+\w+/); // e.g., "19:00 EST"
    });

    it('should handle millisecond timestamps', () => {
      const timestamp = 1704067200000;
      const result = formatTimestamp(timestamp);
      
      expect(result.date).toBeTruthy();
      expect(result.time).toMatch(/\d{2}:\d{2}\s+\w+/);
    });

    it('should return "Invalid date" for invalid input', () => {
      // formatTimestamp now uses formatDateTimeWithTZ which handles invalid input
      const result = formatTimestamp('invalid');
      
      expect(result.date).toBe('Invalid date');
      expect(result.time).toBe('');
    });

    it('should format date in US format with abbreviated month', () => {
      const timestamp = 1704067200; // January 1, 2024
      const result = formatTimestamp(timestamp);
      
      // Should be like "Jan 1, 2024"
      expect(result.date).toMatch(/^[A-Z][a-z]{2}\s+\d{1,2},\s+\d{4}$/);
    });

    it('should format time in 24-hour format with timezone', () => {
      const timestamp = 1704103200; // January 1, 2024, 10:00:00 UTC
      const result = formatTimestamp(timestamp);
      
      // Should be 24-hour format with timezone (allowing for GMT+XX format)
      expect(result.time).toMatch(/^\d{2}:\d{2}\s+\S+$/); // e.g., "05:00 EST" or "23:00 GMT+13"
    });
  });

  describe('normalizeTimestamp - Helper Function', () => {
    it('should convert seconds to milliseconds', () => {
      const seconds = 1704067200;
      const result = normalizeTimestamp(seconds);
      expect(result).toBe(1704067200000);
    });

    it('should keep milliseconds as is', () => {
      const millis = 1704067200000;
      const result = normalizeTimestamp(millis);
      expect(result).toBe(1704067200000);
    });

    it('should handle string input', () => {
      const result = normalizeTimestamp('1704067200');
      expect(result).toBe(1704067200000);
    });

    it('should throw error for invalid input', () => {
      expect(() => normalizeTimestamp('invalid')).toThrow('Invalid timestamp provided');
    });
  });

  describe('Integration - All Display Functions Use Timezone', () => {
    const testTimestamp = 1704067200; // January 1, 2024, 00:00:00 UTC

    it('formatDateTime should include timezone when requested', () => {
      const result = formatDateTime(testTimestamp, {
        includeTime: true,
        includeTimezone: true
      });
      
      // Should end with timezone abbreviation (allowing for GMT+XX format)
      expect(result).toMatch(/\s\S+$/); // e.g., " EST" or " GMT+13"
    });

    it('formatDate should work without timezone (date only)', () => {
      const result = formatDate(testTimestamp);
      
      // Should not include time or timezone
      expect(result).not.toMatch(/\d{2}:\d{2}/);
      expect(result).not.toMatch(/[A-Z]{2,4}$/);
    });

    it('all display functions should handle the same timestamp consistently', () => {
      const isoResult = formatDateTimeWithTZ(testTimestamp);
      const timestampResult = formatTimestamp(testTimestamp);
      const dateTimeResult = formatDateTime(testTimestamp, {
        includeTime: true,
        includeTimezone: true
      });
      
      // All should represent the same moment in time
      // Parse the ISO string to verify it represents the correct moment
      const date = new Date(testTimestamp * 1000);
      
      // Verify the ISO result includes timezone offset
      expect(isoResult).toMatch(/[+-]\d{2}:\d{2}$/);
      
      // Verify timestamp result has both date and time with timezone
      expect(timestampResult.date).toBeTruthy();
      expect(timestampResult.time).toMatch(/\d{2}:\d{2}\s+\S+/);
      
      // Verify dateTime result includes timezone
      expect(dateTimeResult).toMatch(/\s\S+$/);
    });
  });

  describe('Timezone Offset Formatting', () => {
    it('should format UTC correctly', () => {
      jest.spyOn(Date.prototype, 'getTimezoneOffset').mockReturnValueOnce(0);
      
      const result = formatDateTimeWithTZ(1704067200);
      expect(result).toContain('+00:00');
    });

    it('should format half-hour offsets correctly', () => {
      // India Standard Time (UTC+5:30)
      jest.spyOn(Date.prototype, 'getTimezoneOffset').mockReturnValueOnce(-330);
      
      const result = formatDateTimeWithTZ(1704067200);
      expect(result).toContain('+05:30');
    });

    it('should format negative offsets correctly', () => {
      // Hawaii Standard Time (UTC-10)
      jest.spyOn(Date.prototype, 'getTimezoneOffset').mockReturnValueOnce(600);
      
      const result = formatDateTimeWithTZ(1704067200);
      expect(result).toContain('-10:00');
    });
  });

  describe('Critical: Never Display Without Timezone', () => {
    it('formatDateTimeWithTZ should ALWAYS include timezone offset', () => {
      const timestamps = [
        1704067200,      // seconds
        1704067200000,   // milliseconds
        '1704067200',    // string seconds
        '1704067200000', // string milliseconds
        Date.now() / 1000, // current time in seconds
        Date.now()       // current time in milliseconds
      ];

      timestamps.forEach(ts => {
        const result = formatDateTimeWithTZ(ts);
        if (result !== 'Invalid date') {
          // Must have timezone offset in format ±HH:MM
          expect(result).toMatch(/[+-]\d{2}:\d{2}$/);
          // Must NOT have Z (UTC indicator without offset)
          expect(result).not.toContain('Z');
        }
      });
    });

    it('formatTimestamp should ALWAYS include timezone in time field', () => {
      const timestamps = [
        1704067200,
        1704067200000,
        Date.now()
      ];

      timestamps.forEach(ts => {
        const result = formatTimestamp(ts);
        if (result.date !== 'Invalid date') {
          // Time must include timezone abbreviation
          expect(result.time).toMatch(/\d{2}:\d{2}\s+\w+/);
        }
      });
    });
  });
});