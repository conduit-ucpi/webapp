import { execFileSync } from 'child_process';

const MONTHS = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
];

/**
 * The date a file's text last changed, per git, as 'D Month YYYY'.
 *
 * BUILD TIME ONLY — call it from getStaticProps. It shells out to git, so it
 * must never reach the client bundle; Next strips getStaticProps and everything
 * it imports, which is what keeps that true.
 *
 * This exists for the "Last Updated" line on the legal pages. That line used to
 * be `formatDateTimeWithTZ(Date.now())` evaluated during static generation, so
 * it reported the moment CI happened to run as the date the terms were revised —
 * never true, and it moved on every unrelated deploy. It also made that page the
 * one file that differed between two builds of the same commit, which defeats
 * the rebuild-and-compare integrity check that generateBuildId in next.config.js
 * exists to enable.
 *
 * git is the right source: it already records when the text changed, nobody has
 * to remember to update a constant, and it is DETERMINISTIC for a given commit,
 * so two rebuilds still agree. Both CI jobs check out with fetch-depth: 0, and
 * `next build` only ever runs inside the checkout (the Dockerfile copies
 * .next/standalone rather than rebuilding), so the history is always present.
 *
 * KNOWN LIMITATION — granularity. This tracks the FILE, and on the legal pages
 * the prose and its JSX markup share one. Restyling therefore bumps the date as
 * if the terms had been revised, which is the wrong direction to be wrong in for
 * a legal document. The fix, when it matters, is to move the prose into its own
 * module and pass that path instead.
 *
 * @param file    repo-relative path, e.g. 'pages/terms-of-service.tsx'
 * @param fallback used only when git cannot answer; see the warning below
 */
function gitDate(file: string): string | null {
  let iso = '';
  try {
    // %cs = committer date, YYYY-MM-DD. Not %as (author date): a rebase or
    // cherry-pick can carry an author date older than when the text landed here.
    iso = execFileSync('git', ['log', '-1', '--format=%cs', '--', file], {
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'ignore'],
    }).trim();
  } catch {
    iso = '';
  }

  return /^\d{4}-\d{2}-\d{2}$/.test(iso) ? iso : null;
}

function warnNoDate(file: string, fallback: string): void {
  // Loud, because a silent fallback is worse than useless here: a rebuild
  // without history would emit a different page, and the integrity monitor
  // would report that as tampering.
  console.warn(
    `[lastTextChange] No git date for ${file} — falling back to '${fallback}'. ` +
      'A build without git history will not reproduce byte-for-byte.'
  );
}

/** 'D Month YYYY', for display to a reader. */
export function lastTextChange(file: string, fallback: string): string {
  const iso = gitDate(file);
  if (!iso) {
    warnNoDate(file, fallback);
    return fallback;
  }
  const [y, m, d] = iso.split('-');
  // A fixed table, not toLocaleDateString: that reads ICU data from the host and
  // would make the output depend on which machine ran the build.
  return `${Number(d)} ${MONTHS[Number(m) - 1]} ${y}`;
}

/**
 * 'YYYY-MM-DD', for schema.org `dateModified` in JSON-LD, which requires ISO
 * 8601 rather than prose.
 */
export function lastTextChangeISO(file: string, fallback: string): string {
  const iso = gitDate(file);
  if (!iso) {
    warnNoDate(file, fallback);
    return fallback;
  }
  return iso;
}
