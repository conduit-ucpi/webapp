import { readFileSync } from 'fs';
import { join } from 'path';

/**
 * The words we may not use about disputes, and a promise we cannot keep.
 *
 * We do not describe the service as arbitration, and the Third Voter is a Third Voter. Support
 * cannot execute a resolution: the escrow pays out only when two of the three signed votes match.
 * Identifiers that mirror the contract or a service's API (arbiterAddress, the brand record's
 * `arbitration` link) are code, not wording, and these pages carry none of them.
 */
// The policy's words live in components/legal/DisputePolicyText.tsx and the FAQ's in config/faq/
// (one file per language); /plugin shows both. The pages are layout around them.
const PAGES = ['pages/dispute-policy.tsx', 'components/legal/DisputePolicyText.tsx', 'pages/plugin.tsx', 'pages/faq.tsx', 'config/faq/en.ts', 'config/faq/es.ts'];

describe('dispute wording', () => {
  it.each(PAGES)('%s never says arbitration, arbitrator or arbiter', (page) => {
    const source = readFileSync(join(process.cwd(), page), 'utf8');
    // "árbitro" (Spanish) does not start with the ASCII letters, so it is matched on its own.
    expect(source.match(/arbit\w*|árbitr\w*/gi) ?? []).toEqual([]);
  });

  it.each(PAGES)('%s calls the Third Voter by that name, and no other', (page) => {
    const source = readFileSync(join(process.cwd(), page), 'utf8');
    expect(source.match(/tie-?break\w*|desempat\w*|3rd voter\w*/gi) ?? []).toEqual([]);
  });

  it.each(PAGES)('%s never offers to execute a resolution for the parties', (page) => {
    const source = readFileSync(join(process.cwd(), page), 'utf8');
    expect(source).not.toMatch(/execute resolutions?/i);
  });

  it.each(PAGES)('%s never says funds stay frozen indefinitely or until buyer and seller both agree: any two of the three votes release them', (page) => {
    const source = readFileSync(join(process.cwd(), page), 'utf8');
    expect(source).not.toMatch(/frozen indefinitely|frozen until (both parties|mutual)/i);
  });

  it.each(PAGES)('%s never says the Third Voter decides: it casts one vote of three, which pays out only when a party matches it', (page) => {
    const source = readFileSync(join(process.cwd(), page), 'utf8');
    expect(source).not.toMatch(/Third Voter (decides|will decide)(?! how| its vote)/i);
  });
});
