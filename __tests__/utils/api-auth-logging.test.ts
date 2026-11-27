/**
 * A request with no session is refused with a 401, and that is the system working. It was logged
 * as an error, and on production (2026-11-20) one unauthenticated scan of thirty routes paged the
 * error alert. A refusal is one plain line; a real fault is still an error.
 */
import fs from 'fs';
import path from 'path';
import { logApiFailure, requireAuth } from '@/utils/api-auth';

const ALERT_WORDS = /\b(error|failed|exception)\b/i;

describe('logApiFailure', () => {
  let error: jest.SpyInstance;
  let log: jest.SpyInstance;
  beforeEach(() => {
    error = jest.spyOn(console, 'error').mockImplementation(() => {});
    log = jest.spyOn(console, 'log').mockImplementation(() => {});
  });
  afterEach(() => jest.restoreAllMocks());

  const missingSession = () => {
    try {
      requireAuth({ headers: {} } as never);
    } catch (e) {
      return e;
    }
    throw new Error('requireAuth let a request with no session through');
  };

  it.each([
    ['Get all contracts API error:', 'Get all contracts'],
    ['Admin contracts fetch error:', 'Admin contracts'],
    ['Admin contract lookup error:', 'Admin contract'],
    ['Proxy to userservice /api/user/api-keys failed:', 'Proxy to userservice /api/user/api-keys'],
  ])('a missing session under "%s" is one line with none of the words the alert counts', (label, what) => {
    logApiFailure(label, missingSession());
    expect(error).not.toHaveBeenCalled();
    expect(log).toHaveBeenCalledTimes(1);
    expect(log.mock.calls[0][0]).toBe(`Refused, no session (401): ${what}`);
    expect(log.mock.calls[0][0]).not.toMatch(ALERT_WORDS);
  });

  it('a real fault is still logged as an error, with the fault', () => {
    const fault = new Error('connect ECONNREFUSED');
    logApiFailure('Get all contracts API error:', fault);
    expect(error).toHaveBeenCalledWith('Get all contracts API error:', fault);
    expect(log).not.toHaveBeenCalled();
  });
});

describe('every route that answers 401 for a missing session', () => {
  const files: string[] = [];
  const walk = (dir: string) => {
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      const full = path.join(dir, entry.name);
      if (entry.isDirectory()) walk(full);
      else if (/\.tsx?$/.test(entry.name)) files.push(full);
    }
  };
  walk(path.join(process.cwd(), 'pages', 'api'));
  walk(path.join(process.cwd(), 'lib', 'server'));

  it('does not log that refusal with console.error first', () => {
    const offenders = files.filter(file =>
      /console\.error\([^\n]*\);?\s*\n\s*if \(error instanceof Error && error\.message === 'Authentication required'\)/.test(
        fs.readFileSync(file, 'utf8')
      )
    );
    expect(offenders.map(f => path.relative(process.cwd(), f))).toEqual([]);
  });
});

describe('logBackendAnswer', () => {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const { logBackendAnswer } = require('@/utils/api-auth');
  let error: jest.SpyInstance;
  let log: jest.SpyInstance;
  beforeEach(() => {
    error = jest.spyOn(console, 'error').mockImplementation(() => {});
    log = jest.spyOn(console, 'log').mockImplementation(() => {});
  });
  afterEach(() => jest.restoreAllMocks());

  it.each([
    [401, '{"error":"Unauthorized","message":"Auth token required"}', 'Chain service refused the request (401): Auth token required'],
    [403, '', 'Chain service refused the request (403)'],
    [404, '{"error":"Contract not found"}', 'Chain service refused the request (404): Contract not found'],
    [400, '{"error":"Invalid Request","message":"The request body could not be read"}', 'Chain service refused the request (400): The request body could not be read'],
    [401, '{"success":false}', 'Chain service refused the request (401)'],
    [400, '<html>Internal error</html>', 'Chain service refused the request (400)'],
  ])('a %i is a refusal: one line, none of the words the alert counts', (status, body, line) => {
    logBackendAnswer('Chain service', status, body);
    expect(error).not.toHaveBeenCalled();
    expect(log).toHaveBeenCalledWith(line);
    expect(line).not.toMatch(ALERT_WORDS);
  });

  it('a 5xx is a fault and is still an error', () => {
    logBackendAnswer('Chain service', 503, 'upstream down');
    expect(error).toHaveBeenCalledWith('Chain service error:', 503, 'upstream down');
    expect(log).not.toHaveBeenCalled();
  });
});
