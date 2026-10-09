/**
 * CSV that people open in Excel and Sheets: quoted, and never run as a formula.
 */

import { csvCell, toCsv } from '@/utils/csv';

describe('csvCell', () => {
  it('quotes text and doubles embedded quotes, so commas and newlines stay in their cell', () => {
    expect(csvCell('Fit-out, "phase 2"\nsecond line')).toBe('"Fit-out, ""phase 2""\nsecond line"');
  });

  it('defuses anything a spreadsheet would run as a formula', () => {
    for (const evil of ['=HYPERLINK("http://x","click")', '+1+1', '-2+3', '@SUM(A1)', '\t=1', '\r=1']) {
      expect(csvCell(evil).startsWith(`"'`)).toBe(true);
    }
    expect(csvCell('alice@example.com')).toBe('"alice@example.com"');
  });

  it('leaves numbers as numbers and blanks the missing', () => {
    expect(csvCell(12.5)).toBe('12.5');
    expect(csvCell(NaN)).toBe('');
    expect(csvCell(null)).toBe('');
    expect(csvCell(undefined)).toBe('');
  });
});

describe('toCsv', () => {
  it('writes the header then one CRLF-separated line per row', () => {
    expect(toCsv(['A', 'B'], [['x', 1], [null, 'y']])).toBe('"A","B"\r\n"x",1\r\n,"y"');
  });
});
