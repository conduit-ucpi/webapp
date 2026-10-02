import { Fragment, ReactNode } from 'react';

/**
 * The Markdown the arbitration policy is written in, as React elements.
 *
 * Deliberately small: headings, paragraphs, flat lists, quotes, bold, italic and code — what the
 * policy uses. Built from elements, never `dangerouslySetInnerHTML`, because the text arrives from
 * a backend at runtime and the static frontend exists precisely so that a compromised box cannot
 * put markup on this site. Anything this does not recognise is shown as the literal text.
 */

type Block =
  | { kind: 'heading'; text: string }
  | { kind: 'paragraph'; text: string }
  | { kind: 'quote'; text: string }
  | { kind: 'list'; ordered: boolean; items: { label?: string; text: string }[] };

const BULLET = /^- (.*)$/;
const NUMBERED = /^(\d+[a-z]?)\. (.*)$/;

export function parseBlocks(markdown: string): Block[] {
  const blocks: Block[] = [];
  let current = null as Block | null;
  const flush = () => {
    if (current) blocks.push(current);
    current = null;
  };

  for (const raw of markdown.split('\n')) {
    const line = raw.trimEnd();
    const trimmed = line.trim();
    if (!trimmed) {
      flush();
      continue;
    }
    if (trimmed.startsWith('#')) {
      flush();
      blocks.push({ kind: 'heading', text: trimmed.replace(/^#+\s*/, '') });
      continue;
    }
    const indented = /^\s/.test(line);
    const bullet = indented ? null : BULLET.exec(trimmed);
    const numbered = indented ? null : NUMBERED.exec(trimmed);
    if (bullet || numbered) {
      const ordered = !!numbered;
      const item = numbered ? { label: numbered[1], text: numbered[2] } : { text: bullet![1] };
      if (current?.kind === 'list' && current.ordered === ordered) {
        current.items.push(item);
      } else {
        flush();
        current = { kind: 'list', ordered, items: [item] };
      }
      continue;
    }
    if (trimmed.startsWith('>')) {
      const text = trimmed.replace(/^>\s?/, '');
      if (current?.kind === 'quote') current.text += ` ${text}`;
      else {
        flush();
        current = { kind: 'quote', text };
      }
      continue;
    }
    // A wrapped line continues whatever it follows: the last list item, a quote or a paragraph.
    if (current?.kind === 'list') current.items[current.items.length - 1].text += ` ${trimmed}`;
    else if (current) current.text += ` ${trimmed}`;
    else current = { kind: 'paragraph', text: trimmed };
  }
  flush();
  return blocks;
}

export function renderInline(text: string): ReactNode[] {
  const INLINE = /`([^`]+)`|\*\*(.+?)\*\*|\*([^*\s](?:[^*]*[^*\s])?)\*/g;
  const out: ReactNode[] = [];
  let last = 0;
  let m: RegExpExecArray | null;
  while ((m = INLINE.exec(text)) !== null) {
    const at = m.index;
    if (at > last) out.push(text.slice(last, at));
    const key = out.length;
    if (m[1] !== undefined) out.push(<code key={key} className="px-1 rounded bg-secondary-100 dark:bg-secondary-700 text-sm">{m[1]}</code>);
    else if (m[2] !== undefined) out.push(<strong key={key}>{renderInline(m[2])}</strong>);
    else out.push(<em key={key}>{m[3]}</em>);
    last = at + m[0].length;
  }
  if (last < text.length) out.push(text.slice(last));
  return out;
}

export default function RulesMarkdown({ markdown }: { markdown: string }) {
  return (
    <>
      {parseBlocks(markdown).map((block, i) => {
        switch (block.kind) {
          case 'heading':
            return <h4 key={i} className="text-lg font-semibold text-secondary-700 dark:text-secondary-200 mt-5 mb-2">{renderInline(block.text)}</h4>;
          case 'quote':
            return <blockquote key={i} className="border-l-4 border-secondary-300 dark:border-secondary-600 pl-4 italic mb-3">{renderInline(block.text)}</blockquote>;
          case 'list':
            return (
              <ul key={i} className={`${block.ordered ? 'list-none' : 'list-disc pl-5'} space-y-1 mb-3`}>
                {block.items.map((item, j) => (
                  <li key={j}>
                    {item.label && <Fragment><span className="font-medium">{item.label}.</span>{' '}</Fragment>}
                    {renderInline(item.text)}
                  </li>
                ))}
              </ul>
            );
          default:
            return <p key={i} className="mb-3">{renderInline(block.text)}</p>;
        }
      })}
    </>
  );
}
