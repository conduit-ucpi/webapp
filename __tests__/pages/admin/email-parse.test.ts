import { parseAddresses } from '@/pages/admin/email';

describe('parseAddresses', () => {
  it('splits on commas, semicolons, spaces and new lines, dropping quotes and duplicates', () => {
    const { valid, invalid } = parseAddresses('"a@x.com"\n: "b@y.com", <c@z.io>; A@X.com  not-an-email,, b@y');
    expect(valid).toEqual(['a@x.com', 'b@y.com', 'c@z.io']);
    expect(invalid).toEqual(['not-an-email', 'b@y']);
  });
});
