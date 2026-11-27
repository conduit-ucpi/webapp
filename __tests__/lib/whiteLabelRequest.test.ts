/** A partner's white-label request: their brand config JSON, email address and domains, as an email to us. */
import {
  attachmentProblem,
  describeJsonError,
  buildPayload,
  EMPTY_REQUEST,
  WHITE_LABEL_INBOX,
  buildEmail,
  mailtoHref,
  parseDomains,
  validateRequest,
  type WhiteLabelRequest,
} from '@/lib/whiteLabelRequest';

const CONFIG = JSON.stringify({ id: 'cobro', name: 'COBRO', theme: { primary: { 500: '15 122 110' } } });
const READY: WhiteLabelRequest = {
  ...EMPTY_REQUEST,
  contactName: 'Ana Ruiz',
  contactEmail: 'ana@cobro.example',
  productionDomains: 'https://cobro.example, www.cobro.example',
  testDomains: 'staging.cobro.example',
  configJson: CONFIG,
};

it("needs the partner's own email address", () => {
  expect(validateRequest({ ...READY, contactEmail: '' }).contactEmail).toMatch(/email address/);
  expect(validateRequest({ ...READY, contactEmail: 'not-an-email' }).contactEmail).toBeTruthy();
  expect(validateRequest(READY)).toEqual({});
});

it('needs the config, with an id and a name', () => {
  expect(validateRequest({ ...READY, configJson: '' }).configJson).toMatch(/Paste your brand config/);
  expect(validateRequest({ ...READY, configJson: '{not json' }).configJson).toMatch(/not valid JSON/);
  expect(validateRequest({ ...READY, configJson: '[]' }).configJson).toMatch(/JSON object/);
  expect(validateRequest({ ...READY, configJson: '{"name":"X"}' }).configJson).toMatch(/"id"/);
  expect(validateRequest({ ...READY, configJson: '{"id":"Bad Id","name":"X"}' }).configJson).toMatch(/"id"/);
  expect(validateRequest({ ...READY, configJson: '{"id":"cobro"}' }).configJson).toMatch(/"name"/);
});

it('needs at least one production domain, and real domain names', () => {
  expect(validateRequest({ ...READY, productionDomains: '' }).productionDomains).toBeTruthy();
  expect(validateRequest({ ...READY, testDomains: 'not a domain' }).testDomains).toMatch(/not a domain name/);
  expect(parseDomains('https://WWW.Cobro.example/shop,\ncobro.example  ')).toEqual(['www.cobro.example', 'cobro.example']);
});

it('builds the email to us: contact, brand id and name from the config, domains, and the config itself', () => {
  const email = buildEmail(READY);
  expect(email.to).toBe(WHITE_LABEL_INBOX);
  expect(email.subject).toBe('White-label request: cobro (COBRO)');
  expect(email.body).toContain('Contact: Ana Ruiz <ana@cobro.example>');
  expect(email.body).toContain('Production domains: cobro.example, www.cobro.example');
  expect(email.body).toContain('Test domains: staging.cobro.example');
  expect(email.body).toContain('Brand config:\n' + JSON.stringify(JSON.parse(CONFIG), null, 2));

  const href = mailtoHref(email);
  expect(href.startsWith(`mailto:${WHITE_LABEL_INBOX}?subject=`)).toBe(true);
  expect(decodeURIComponent(href.split('&body=')[1])).toBe(email.body);
});

it('builds the body for our route, with domains cleaned up and no recipient', () => {
  const body = buildPayload(READY, [{ filename: 'logo.png', contentType: 'image/png', contentBase64: 'iVBO', size: 4 }]);
  expect(body).toEqual({
    contactName: 'Ana Ruiz',
    contactEmail: 'ana@cobro.example',
    productionDomains: ['cobro.example', 'www.cobro.example'],
    testDomains: ['staging.cobro.example'],
    config: CONFIG,
    notes: null,
    attachments: [{ filename: 'logo.png', contentType: 'image/png', contentBase64: 'iVBO' }],
  });
});

it('checks attachments against the same limits emailservice does', () => {
  const file = (filename: string, size = 10) => ({ filename, contentType: '', contentBase64: '', size });
  expect(attachmentProblem([file('logo.png'), file('font.woff2')])).toBeNull();
  expect(attachmentProblem([file('payload.exe')])).toMatch(/not a PNG/);
  expect(attachmentProblem([file('big.png', 1_000_001)])).toMatch(/larger than 1 MB/);
  expect(attachmentProblem(Array.from({ length: 7 }, (_, i) => file(`l${i}.png`)))).toMatch(/at most 6/);
});

describe('saying where a pasted config went wrong', () => {
  // The config a partner actually pasted: \' is not a JSON escape.
  const PASTED = [
    '{"id":"cobro","name":"COBRO","theme":',
    '  {"secondary":{"900":"17 17 17"},',
    '    "fontFamily":"\\\'Manrope\\\', ui-sans-serif"',
    '  }',
    '}',
  ].join('\n');

  it('names the line and column, and says how to fix a backslashed apostrophe', () => {
    const problem = validateRequest({ ...READY, configJson: PASTED }).configJson ?? '';
    expect(problem).toMatch(/^The brand config is not valid JSON at line 3, column \d+\./);
    expect(problem).toContain("Write ' on its own");
  });

  it("reads Firefox's line-and-column wording too, and copes with Safari's, which has neither", () => {
    expect(describeJsonError('{}', new SyntaxError('JSON.parse: bad escaped character at line 9 column 20 of the JSON data')))
      .toBe('The brand config is not valid JSON at line 9, column 20.');
    expect(describeJsonError('{}', new SyntaxError("JSON Parse error: Invalid escape character '")))
      .toBe('The brand config is not valid JSON.');
  });

  it('points out a trailing comma and single-quoted names', () => {
    expect(describeJsonError('{"id":"a",}', new SyntaxError('x'))).toContain('Remove the comma');
    expect(describeJsonError("{'id':'a'}", new SyntaxError('x'))).toContain('double quotes');
  });

  it('accepts the same config once the backslashes are gone', () => {
    expect(validateRequest({ ...READY, configJson: PASTED.split("\\'").join("'") }).configJson).toBeUndefined();
  });
});
