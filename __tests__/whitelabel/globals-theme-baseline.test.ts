import fs from 'fs';
import path from 'path';
import { DEFAULT_THEME } from '@/config/defaults';
import { themeToVars, varsToCssBlock } from '@/theme/cssVars';

/**
 * styles/globals.css carries the SDK's default theme at :root so the static build's first paint
 * is right before any JavaScript runs. It is a copy, so this keeps it one: every default variable,
 * with the same value.
 */
describe('globals.css theme baseline', () => {
  it('matches the SDK default theme exactly', () => {
    const css = fs.readFileSync(path.join(__dirname, '../../styles/globals.css'), 'utf8');
    expect(css).toContain(varsToCssBlock(themeToVars(DEFAULT_THEME)));
  });
});
