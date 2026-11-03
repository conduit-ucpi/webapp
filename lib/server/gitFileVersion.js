const { execFileSync } = require('child_process');

/**
 * The last commit that changed a file, per git: its full SHA and committer date (YYYY-MM-DD).
 *
 * BUILD TIME ONLY — it shells out to git, which the running container does not have. Plain
 * CommonJS so next.config.js can call it as well as lastTextChange.ts: the Terms of Service page
 * and the version the SIWE statement names must come from one lookup, or they could disagree.
 *
 * %cs, not %as: a rebase or cherry-pick can carry an author date older than when the text
 * landed here.
 *
 * @param {string} file repo-relative path, e.g. 'pages/terms-of-service.tsx'
 * @returns {{ sha: string, date: string } | null} null when git cannot answer
 */
function gitFileVersion(file) {
  let out = '';
  try {
    out = execFileSync('git', ['log', '-1', '--format=%H %cs', '--', file], {
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'ignore'],
    }).trim();
  } catch {
    out = '';
  }

  const match = /^([0-9a-f]{40}) (\d{4}-\d{2}-\d{2})$/.exec(out);
  return match ? { sha: match[1], date: match[2] } : null;
}

/**
 * The Terms of Service text (English, the version that applies), whose last change is the terms
 * version a sign-in accepts. Only the words live in it — the page, its layout and the Spanish
 * translation are elsewhere — so restyling or translating never issues a new version.
 * (Until 2026-11 it was pages/terms-of-service.tsx, so `git show <old sha>:pages/terms-of-service.tsx`
 * recovers versions from before then.)
 */
const TERMS_FILE = 'components/legal/TermsText.tsx';

/**
 * The terms version as it appears in the SIWE statement and on the page: the first 12 hex
 * digits of the SHA. Short enough that wallets don't truncate the statement, long enough to be
 * unambiguous in this repo, and `git show <it>:components/legal/TermsText.tsx` recovers the text.
 */
const TERMS_VERSION_LENGTH = 12;

module.exports = { gitFileVersion, TERMS_FILE, TERMS_VERSION_LENGTH };
