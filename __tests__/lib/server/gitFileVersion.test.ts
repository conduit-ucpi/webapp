/**
 * @jest-environment node
 */
import { execFileSync } from 'child_process';
import { gitFileVersion, TERMS_FILE, TERMS_VERSION_LENGTH } from '@/lib/server/gitFileVersion';
import { lastTextChange, lastTextChangeVersion } from '@/lib/server/lastTextChange';

/**
 * The terms version a SIWE sign-in names (next.config.js → /api/config) and the one the Terms
 * page shows both come from gitFileVersion. These pin that they are the same commit, and that it
 * is the commit git itself reports for the file.
 */
describe('gitFileVersion', () => {
  it('is the last commit that changed the file, as git reports it', () => {
    const expected = execFileSync('git', ['log', '-1', '--format=%H %cs', '--', TERMS_FILE], {
      encoding: 'utf8',
    }).trim();

    const found = gitFileVersion(TERMS_FILE);
    expect(found && `${found.sha} ${found.date}`).toBe(expected);
  });

  it('gives the page the same version and date the rest of the build uses', () => {
    const found = gitFileVersion(TERMS_FILE)!;
    const { date, version } = lastTextChangeVersion(TERMS_FILE, 'fallback');

    expect(version).toBe(found.sha.slice(0, TERMS_VERSION_LENGTH));
    expect(version).toMatch(/^[0-9a-f]{12}$/);
    expect(date).toBe(lastTextChange(TERMS_FILE, 'fallback'));
  });

  it('returns null for a file git has never seen, and the page falls back with no version', () => {
    const warn = jest.spyOn(console, 'warn').mockImplementation(() => {});
    expect(gitFileVersion('no/such/file.tsx')).toBeNull();
    expect(lastTextChangeVersion('no/such/file.tsx', '1 January 2026')).toEqual({
      date: '1 January 2026',
      version: null,
    });
    warn.mockRestore();
  });
});
