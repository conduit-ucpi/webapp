import type { ReactNode } from 'react';

const BODY = 'text-secondary-700 dark:text-secondary-200';

/** A numbered section of a legal text (e.g. "3. What Stabledrop is, and is not"). */
export function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="mb-8">
      <h2 className="text-2xl font-semibold text-secondary-900 dark:text-white mb-4">{title}</h2>
      {children}
    </section>
  );
}

/** A heading within a section. */
export function Heading({ children }: { children: ReactNode }) {
  return <h3 className="text-lg font-semibold text-secondary-900 dark:text-white mt-6 mb-3">{children}</h3>;
}

/** A numbered sub-clause, keeping its number hanging in the margin. */
export function Sub({ n, children }: { n: string; children: ReactNode }) {
  return (
    <p className={`${BODY} mb-3 pl-12 -indent-12`}>
      <span className="inline-block w-12 align-top tabular-nums">{n}</span>
      {children}
    </p>
  );
}

/** An unnumbered paragraph: lined up under the sub-clause it continues, or `flush` when it stands alone. */
export function Para({ flush = false, children }: { flush?: boolean; children: ReactNode }) {
  return <p className={`${BODY} mb-3 ${flush ? '' : 'pl-12'}`}>{children}</p>;
}

/** A list under a clause. `lettered` when each item carries its own "(a)", so no bullet is added. */
export function Items({ flush = false, lettered = false, children }: { flush?: boolean; lettered?: boolean; children: ReactNode }) {
  const indent = flush ? 'pl-6' : 'pl-16';
  return <ul className={`${lettered ? 'list-none' : 'list-disc'} ${indent} ${BODY} space-y-2 mb-3`}>{children}</ul>;
}

/** A defined term and its meaning. */
export function Def({ term, children }: { term: string; children?: ReactNode }) {
  return (
    <p className={`${BODY} mb-3`}>
      <strong>{term}:</strong> {children}
    </p>
  );
}

/** A link in a legal text. */
export function A({ href, children }: { href: string; children: ReactNode }) {
  return (
    <a href={href} className="text-primary-600 hover:text-primary-500">
      {children}
    </a>
  );
}
