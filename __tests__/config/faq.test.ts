/**
 * Every language of the FAQ asks the same questions, in the same order, with the same links, and
 * the page renders whichever the locale picks, its structured data built from that same text.
 */
import { faqEn } from '@/config/faq/en';
import { faqEs } from '@/config/faq/es';
import { answerText, faqSchema } from '@/components/faq/FaqAnswer';
import type { FaqContent } from '@/config/faq/types';

const LINK = /\]\(([^)\s]+)\)/g;
const hrefs = (text: string) => Array.from(text.matchAll(LINK), (m) => m[1]);
const shape = (c: FaqContent) =>
  c.sections.map((s) => ({ id: s.id, items: s.items.map((i) => ({ id: i.id, links: hrefs(i.a), contract: !!i.showContractAddress })) }));

describe.each([['es', faqEs]])('the %s FAQ', (_locale, content) => {
  it('has the same sections and questions as English, in order, with the same links', () => {
    expect(shape(content)).toEqual(shape(faqEn));
    expect(hrefs(content.more.body)).toEqual(hrefs(faqEn.more.body));
  });

  it('has every string filled in, and no HTML entities left from the old page', () => {
    const strings = JSON.stringify(content);
    expect(strings).not.toMatch(/&[a-z]+;/);
    content.sections.forEach((s) => {
      [s.eyebrow, s.heading, ...s.items.flatMap((i) => [i.q, i.a])].forEach((t) => expect(t.trim()).not.toBe(''));
    });
  });

  it('is not English', () => {
    const same = content.sections.flatMap((s, si) => s.items.filter((i, ii) => i.q === faqEn.sections[si].items[ii].q));
    expect(same).toEqual([]);
  });
});

it('ids are unique', () => {
  const ids = faqEn.sections.flatMap((s) => s.items.map((i) => i.id));
  expect(new Set(ids).size).toBe(ids.length);
});

it('builds structured data from the visible text, one question per item', () => {
  const schema = faqSchema(faqEs);
  expect(schema.mainEntity).toHaveLength(faqEs.sections.reduce((n, s) => n + s.items.length, 0));
  expect(schema.mainEntity[0].name).toBe(faqEs.sections[0].items[0].q);
});

it('turns an answer into plain text for search engines', () => {
  expect(answerText('See [our policy](/dispute-policy).\n\n**Chargebacks:**\n\n- Bank decides\n- You lose')).toBe(
    'See our policy. Chargebacks: Bank decides. You lose.'
  );
});
