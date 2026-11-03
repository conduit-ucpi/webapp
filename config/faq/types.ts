/**
 * The /faq page's words, one file per language (en.ts, es.ts). The page renders whichever the
 * active locale picks, and its FAQPage structured data is built from the same text, so what search
 * engines read is always what the visitor sees.
 *
 * Answers are a small Markdown: paragraphs split by a blank line, `- ` lists, **bold**, `code` and
 * [text](href) links (see components/faq/FaqAnswer.tsx). Every language has the same sections and
 * questions, by id, in the same order, with the same links: __tests__/config/faq.test.ts holds
 * them to that.
 */

export interface FaqItem {
  /** Stable across languages. */
  id: string;
  q: string;
  a: string;
  /** Show the escrow implementation address (from /api/config) under the answer. */
  showContractAddress?: boolean;
}

export interface FaqSection {
  id: string;
  eyebrow: string;
  heading: string;
  items: FaqItem[];
}

export interface FaqContent {
  seo: { title: string; description: string; keywords: string };
  hero: { eyebrow: string; heading: string };
  sections: FaqSection[];
  /** "Still have questions?" at the end. `body` is Markdown, like an answer. */
  more: { eyebrow: string; heading: string; body: string };
  footer: { home: string; support: string };
  contractAddress: { label: string; note: string };
}
