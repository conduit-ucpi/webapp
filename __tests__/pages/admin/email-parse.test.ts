import { parseAddresses, STANDARD_BODY, STANDARD_SUBJECT } from '@/pages/admin/email';
import { plainTextToHtml } from '@/pages/api/admin/bulk-email';

describe('parseAddresses', () => {
  it('splits on commas, semicolons, spaces and new lines, dropping quotes and duplicates', () => {
    const { valid, invalid } = parseAddresses('"a@x.com"\n: "b@y.com", <c@z.io>; A@X.com  not-an-email,, b@y');
    expect(valid).toEqual(['a@x.com', 'b@y.com', 'c@z.io']);
    expect(invalid).toEqual(['not-an-email', 'b@y']);
  });
});

describe('the standard message', () => {
  it('fits what /api/admin/bulk-email accepts and renders as three paragraphs and a sign-off', () => {
    expect(STANDARD_SUBJECT.length).toBeLessThanOrEqual(200);
    expect(STANDARD_SUBJECT).not.toMatch(/[\r\n]/);
    const html = plainTextToHtml(STANDARD_BODY);
    expect(html.match(/<p>/g)).toHaveLength(4);
    expect(html.endsWith('<p>Charlie<br>Stabledrop</p>')).toBe(true);
    expect(html).not.toMatch(/escrow/i);
  });
});
