/**
 * @jest-environment node
 *
 * The auth providers render on the server when ISR regenerates a page, and
 * that render builds the TokenManager singleton. There is no browser storage
 * there: on Node 25+ `localStorage` is a global that is undefined without
 * --localstorage-file, so reading it threw, and the caught error was logged at
 * error level — which raised a production alert once per deploy, on the first
 * regeneration of `/` an hour after the build.
 */
import { TokenManager } from '@/lib/auth/core/TokenManager';
import { mLog } from '@/utils/mobileLogger';

describe('TokenManager without a browser (server render)', () => {
  it('has no window here, as on the server', () => {
    expect(typeof window).toBe('undefined');
  });

  it('constructs, sets and clears a token without logging an error', () => {
    const errorSpy = jest.spyOn(mLog, 'error');

    const tm = new TokenManager();
    tm.setToken('header.payload.signature');
    tm.clearToken();

    expect(errorSpy).not.toHaveBeenCalled();
    errorSpy.mockRestore();
  });
});
