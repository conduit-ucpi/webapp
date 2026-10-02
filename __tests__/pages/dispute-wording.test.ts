import { readFileSync } from 'fs';
import { join } from 'path';

/**
 * The words we may not use about disputes, and a promise we cannot keep.
 *
 * We do not describe the service as arbitration, and the third voter is a tiebreaker. Support
 * cannot execute a resolution: the escrow pays out only when two of the three signed votes match.
 * Identifiers that mirror the contract or a service's API (arbiterAddress, the brand record's
 * `arbitration` link) are code, not wording, and these pages carry none of them.
 */
const PAGES = ['pages/dispute-policy.tsx', 'pages/faq.tsx'];

describe('dispute wording', () => {
  it.each(PAGES)('%s never says arbitration, arbitrator or arbiter', (page) => {
    const source = readFileSync(join(process.cwd(), page), 'utf8');
    expect(source.match(/arbit\w*/gi) ?? []).toEqual([]);
  });

  it.each(PAGES)('%s never offers to execute a resolution for the parties', (page) => {
    const source = readFileSync(join(process.cwd(), page), 'utf8');
    expect(source).not.toMatch(/execute resolutions?/i);
  });

  it.each(PAGES)('%s never says funds stay frozen indefinitely or until buyer and seller both agree: any two of the three votes release them', (page) => {
    const source = readFileSync(join(process.cwd(), page), 'utf8');
    expect(source).not.toMatch(/frozen indefinitely|frozen until (both parties|mutual)/i);
  });

  it.each(PAGES)('%s never says the tiebreaker decides: it casts one vote of three, which pays out only when a party matches it', (page) => {
    const source = readFileSync(join(process.cwd(), page), 'utf8');
    expect(source).not.toMatch(/tiebreaker (decides|will decide)/i);
  });
});
