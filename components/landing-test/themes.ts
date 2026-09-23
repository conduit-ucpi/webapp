import { LandingTheme } from './theme';

/**
 * The look from landing-test-05 that got picked: charcoal, one lime accent, Space Grotesk
 * with JetBrains Mono for code. Pages 06–10 all wear it and differ only in layout and
 * content, so it lives here rather than in any one of them.
 */
export const BENTO: LandingTheme = {
  bg: '#131313',
  fg: '#f5f5f2',
  muted: '#9a9a94',
  card: '#1d1d1b',
  border: '#2c2c29',
  accent: '#c8ff3d',
  accentFg: '#131313',
  accentSoft: '#26291a',
  radius: '20px',
  btnRadius: '12px',
  font: "'Space Grotesk', Inter, system-ui, sans-serif",
  fontDisplay: "'Space Grotesk', Inter, system-ui, sans-serif",
  fontMono: "'JetBrains Mono', ui-monospace, SFMono-Regular, Menlo, monospace",
};

export const BENTO_FONTS_HREF =
  'https://fonts.googleapis.com/css2?family=Space+Grotesk:wght@400;500;600&family=JetBrains+Mono:wght@400;500&display=swap';
