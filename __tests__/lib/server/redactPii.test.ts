import { installLogRedaction, maskAddress, maskEmail, redact, redactString } from '@/lib/server/redactPii';

/**
 * Personal data never reaches the server log in the clear. The case that prompted this: every
 * identity call logged `{"email":"charliepank@gmail.com","walletAddress":"0xd366…","userType":"admin"}`
 * to Grafana, and request bodies full of emails were logged by a dozen routes besides.
 */
describe('redactPii', () => {
  const EMAIL = 'charliepank@gmail.com';
  const WALLET = '0xd36698991ef328275c8f9598a33b2378d7ece183';
  const TX_HASH = '0x' + 'ab'.repeat(32);

  it('masks an email down to two characters and the domain', () => {
    expect(maskEmail(EMAIL)).toBe('ch***@gmail.com');
    expect(maskEmail('a@b.co')).toBe('a***@b.co');
    expect(maskEmail('first.last+tag@mail.example.org')).toBe('fi***@mail.example.org');
  });

  it('masks a wallet or contract address but keeps its ends for correlation', () => {
    expect(maskAddress(WALLET)).toBe('0xd366***e183');
    expect(maskAddress('0xCFc37A6AB183dd4aED08C204D1c2773c0b1BDf46')).toBe('0xCFc3***Df46');
  });

  it('leaves transaction hashes alone - they are not personal', () => {
    expect(redactString(`tx ${TX_HASH} mined`)).toBe(`tx ${TX_HASH} mined`);
  });

  it('masks inside running text, including the old identity bodyPreview', () => {
    const preview = `{"userId":"6aad5fb82da63a01bdd3176e","email":"${EMAIL}","walletAddress":"${WALLET}","userType":"admin"}`;
    const out = redactString(preview);
    expect(out).not.toContain(EMAIL);
    expect(out).not.toContain(WALLET);
    expect(out).toContain('ch***@gmail.com');
    expect(out).toContain('0xd366***e183');
    expect(out).toContain('"userType":"admin"');
  });

  it('walks objects and arrays without mutating them', () => {
    const body = { buyerEmail: EMAIL, parties: [{ wallet: WALLET }], amount: 1000, nested: { note: `ask ${EMAIL}` } };
    const snapshot = JSON.stringify(body);

    const out = redact(body) as typeof body;

    expect(out.buyerEmail).toBe('ch***@gmail.com');
    expect(out.parties[0].wallet).toBe('0xd366***e183');
    expect(out.amount).toBe(1000);
    expect(out.nested.note).toBe('ask ch***@gmail.com');
    expect(JSON.stringify(body)).toBe(snapshot);
  });

  it('masks an Error message and stack, keeping its name', () => {
    const err = new TypeError(`no user for ${EMAIL}`);
    const out = redact(err) as Error;
    expect(out.name).toBe('TypeError');
    expect(out.message).toBe('no user for ch***@gmail.com');
    expect(out.stack).not.toContain(EMAIL);
  });

  it('survives cycles and leaves non-plain objects as they are', () => {
    const cyclic: Record<string, unknown> = { email: EMAIL };
    cyclic.self = cyclic;
    const out = redact(cyclic) as Record<string, unknown>;
    expect(out.email).toBe('ch***@gmail.com');
    expect(out.self).toBe(out);

    const date = new Date(0);
    expect(redact(date)).toBe(date);
  });

  it('installLogRedaction masks every console method, once', () => {
    const written: unknown[][] = [];
    const sink = { log: (...a: unknown[]) => written.push(a), info: (...a: unknown[]) => written.push(a), warn: (...a: unknown[]) => written.push(a), error: (...a: unknown[]) => written.push(a), debug: (...a: unknown[]) => written.push(a) } as unknown as Console;

    installLogRedaction(sink);
    installLogRedaction(sink); // idempotent: not masked twice, not wrapped twice

    sink.log('Request body:', { email: EMAIL });
    sink.error(new Error(`failed for ${WALLET}`));
    sink.warn(`user ${EMAIL}`);

    expect(written[0]).toEqual(['Request body:', { email: 'ch***@gmail.com' }]);
    expect((written[1][0] as Error).message).toBe('failed for 0xd366***e183');
    expect(written[2]).toEqual(['user ch***@gmail.com']);
  });

  it('never prints a credential - tokens, bearer values, cookie and api-key values', () => {
    const jwt = 'eyJhbGciOiJIUzUxMiJ9.eyJzdWIiOiI2YWFkMGY3MWQwZTFlNDM3ZjkxYjQ1MWEifQ.c2lnbmF0dXJlLWJ5dGVz';
    const header = `cookie: '_ga=GA1.1.45; privy-session=t; AUTH-TOKEN=${jwt}; privy-id-token=${jwt}'`;
    const out = redactString(header);
    expect(out).not.toContain('eyJhbGciOiJIUzUxMiJ9');
    expect(out).toContain('_ga=GA1.1.45');

    expect(redactString(`Authorization: Bearer ${jwt}`)).toBe('Authorization: Bearer ***');
    expect(redactString("X-API-Key: 'api_key_blah_blah'")).toBe("X-API-Key: '***'");
    expect(redactString('sessionCookie extracted: false')).toBe('sessionCookie extracted: false');
  });

  it('masks the value of a credential-named key whatever it looks like', () => {
    const out = redact({ Authorization: 'Token abc', cookie: 'a=b', apiKey: 'k1', amount: 5 }) as Record<string, unknown>;
    expect(out).toEqual({ Authorization: '***', cookie: '***', apiKey: '***', amount: 5 });
  });
});
