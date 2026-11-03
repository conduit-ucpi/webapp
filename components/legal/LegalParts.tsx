import type { ReactNode } from 'react';

/** A numbered part heading within Schedule 1 (e.g. "3. United Kingdom"). */
export function Clause({ n, heading }: { n: string; heading: string }) {
  return (
    <h3 className="text-lg font-semibold text-secondary-900 dark:text-white mt-6 mb-3">
      {n}. {heading}
    </h3>
  );
}

/** A numbered sub-clause within Schedule 1, keeping its number hanging in the margin. */
export function Sub({ n, children }: { n: string; children: ReactNode }) {
  return (
    <p className="text-secondary-700 dark:text-secondary-200 mb-3 pl-12 -indent-12">
      <span className="inline-block w-12 align-top tabular-nums">{n}</span>
      {children}
    </p>
  );
}
