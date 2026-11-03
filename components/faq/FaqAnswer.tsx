import { ReactNode } from 'react';
import Link from 'next/link';
import { parseBlocks, renderInline } from '@/components/dispute-rules/RulesMarkdown';
import type { FaqContent } from '@/config/faq/types';

/**
 * An FAQ answer's Markdown (see config/faq/types.ts) as React elements: the dispute policy's
 * parser and inline styles, plus [text](href) links, which the FAQ needs and the policy must not
 * have (its text arrives from a backend at runtime; this text ships in the bundle).
 */

const LINK = /\[([^\]]+)\]\(([^)\s]+)\)/g;
const LINK_CLASS = 'text-primary-600 dark:text-primary-400 hover:text-primary-700 dark:hover:text-primary-300 underline';

export function renderWithLinks(text: string): ReactNode[] {
  const out: ReactNode[] = [];
  let last = 0;
  let m: RegExpExecArray | null;
  LINK.lastIndex = 0;
  while ((m = LINK.exec(text)) !== null) {
    if (m.index > last) out.push(...renderInline(text.slice(last, m.index)));
    const [, label, href] = m;
    const key = `l${out.length}`;
    if (href.startsWith('/')) out.push(<Link key={key} href={href} className={LINK_CLASS}>{label}</Link>);
    else if (href.startsWith('mailto:')) out.push(<a key={key} href={href} className={LINK_CLASS}>{label}</a>);
    else out.push(<a key={key} href={href} target="_blank" rel="noopener noreferrer" className={LINK_CLASS}>{label}</a>);
    last = m.index + m[0].length;
  }
  if (last < text.length) out.push(...renderInline(text.slice(last)));
  return out;
}

/** The same answer as plain text, for the FAQPage structured data. */
export function answerText(markdown: string): string {
  return parseBlocks(markdown)
    .map((block) =>
      block.kind !== 'list'
        ? block.text
        : block.ordered
          ? block.items.map((item) => `${item.label}. ${item.text}`).join(' ')
          : block.items.map((item) => item.text.replace(/[.;:]?$/, '.')).join(' ')
    )
    .join(' ')
    .replace(LINK, '$1')
    .replace(/\*\*(.+?)\*\*/g, '$1')
    .replace(/`([^`]+)`/g, '$1')
    .replace(/\s+/g, ' ')
    .trim();
}

/** FAQPage structured data, from the same text the visitor reads. */
export function faqSchema(content: FaqContent) {
  return {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    "mainEntity": content.sections.flatMap((section) =>
      section.items.map((item) => ({
        "@type": "Question",
        "name": item.q,
        "acceptedAnswer": { "@type": "Answer", "text": answerText(item.a) },
      }))
    ),
  };
}

export default function FaqAnswer({ markdown }: { markdown: string }) {
  return (
    <div className="text-sm text-secondary-500 dark:text-secondary-400 leading-relaxed space-y-3">
      {parseBlocks(markdown).map((block, i) => {
        // Answers number steps inline ("1. Get USDC… 2. Ask…"): kept as the text it was written as.
        if (block.kind === 'list' && block.ordered) {
          return <p key={i}>{renderWithLinks(block.items.map((item) => `${item.label}. ${item.text}`).join(' '))}</p>;
        }
        if (block.kind === 'list') {
          return (
            <ul key={i} className="list-disc pl-5 space-y-1">
              {block.items.map((item, j) => <li key={j}>{renderWithLinks(item.text)}</li>)}
            </ul>
          );
        }
        // A paragraph that is wholly bold is a label ("Chargebacks:"), styled as one.
        const label = /^\*\*[^*]+\*\*$/.test(block.text);
        return (
          <p key={i} className={label ? 'font-medium text-secondary-900 dark:text-white' : undefined}>
            {label ? block.text.slice(2, -2) : renderWithLinks(block.text)}
          </p>
        );
      })}
    </div>
  );
}
