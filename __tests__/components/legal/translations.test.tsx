/**
 * The Terms of Service and Privacy Policy translations cannot wander from the English.
 *
 * 1. SAME SHAPE. Every section, numbered heading, Schedule 1 clause, list item, link, code name and
 *    button in the English has its counterpart in the translation, in the same order. Adding or
 *    removing a clause on one side only fails here.
 * 2. SAME ENGLISH. Each translation records, as TRANSLATED_FROM, a fingerprint of the English text it
 *    was translated from. Any change to the English — one word — fails here until the translation
 *    is brought up to date and its TRANSLATED_FROM set to the new fingerprint, which the failure
 *    prints.
 */
import { createHash } from 'crypto';
import { render } from '@testing-library/react';
import type { ComponentType } from 'react';
import TermsTextEn from '@/components/legal/TermsText';
import TermsTextEs, { TRANSLATED_FROM as TERMS_ES_FROM } from '@/components/legal/TermsText.es';
import PrivacyTextEn from '@/components/legal/PrivacyText';
import PrivacyTextEs, { TRANSLATED_FROM as PRIVACY_ES_FROM } from '@/components/legal/PrivacyText.es';

jest.mock('@/lib/consent', () => ({ openConsentSettings: jest.fn() }));

const rendered = (Text: ComponentType) => render(<Text />).container;

/** What must match across languages: structure, numbers, and anything that is not prose. */
function shape(root: HTMLElement): string[] {
  return Array.from(root.querySelectorAll('section, h2, h3, li, a, code, button, strong, span')).map((el) => {
    const tag = el.tagName.toLowerCase();
    const text = (el.textContent ?? '').trim();
    switch (tag) {
      case 'section':
        return `section#${el.id}`;
      case 'h2':
      case 'h3':
        // The number a heading starts with (e.g. "11." or "3."), not its words.
        return `${tag} ${/^\d+\./.exec(text)?.[0] ?? ''}`;
      case 'a':
        return `a ${el.getAttribute('href')}`;
      case 'code':
        return `code ${text}`;
      case 'span':
        // Schedule 1 sub-clause numbers ("2.4").
        return /^\d+\.\d+$/.test(text) ? `clause ${text}` : 'span';
      default:
        return tag;
    }
  });
}

/** The English text's fingerprint: every word as rendered, whitespace collapsed. */
const fingerprint = (root: HTMLElement) =>
  createHash('sha256').update((root.textContent ?? '').replace(/\s+/g, ' ').trim()).digest('hex').slice(0, 16);

describe.each([
  ['Terms of Service', 'components/legal/TermsText.es.tsx', TermsTextEn, TermsTextEs, TERMS_ES_FROM],
  ['Privacy Policy', 'components/legal/PrivacyText.es.tsx', PrivacyTextEn, PrivacyTextEs, PRIVACY_ES_FROM],
])('the Spanish %s', (_name, file, English, Spanish, translatedFrom) => {
  it('has the same sections, numbers, list items, links, names and buttons as the English, in order', () => {
    expect(shape(rendered(Spanish))).toEqual(shape(rendered(English)));
  });

  it('was translated from the English as it stands now', () => {
    const current = fingerprint(rendered(English));
    if (translatedFrom !== current) {
      throw new Error(
        `The English changed since ${file} was translated. Update the Spanish to match, then set ` +
          `TRANSLATED_FROM in ${file} to '${current}'.`
      );
    }
  });

  it('is not the English', () => {
    expect(rendered(Spanish).textContent).not.toEqual(rendered(English).textContent);
  });
});
