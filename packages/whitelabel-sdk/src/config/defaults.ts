import { BrandTheme } from './types';

/**
 * The SDK's default theme — the palette the app already ships with, expressed
 * as RGB triples. Generated from tailwind.config.js so the two cannot drift.
 *
 * A tenant config that omits a colour inherits these, so a partner supplying
 * only an accent still gets a coherent neutral ramp.
 */
export const DEFAULT_THEME: BrandTheme = {
  primary: {
    50: '236 253 245',
    100: '209 250 229',
    200: '167 243 208',
    300: '110 231 183',
    400: '52 211 153',
    500: '16 185 129',
    600: '5 150 105',
    700: '4 120 87',
    800: '6 95 70',
    900: '6 78 59',
  },
  secondary: {
    50: '248 250 252',
    100: '241 245 249',
    200: '226 232 240',
    300: '203 213 225',
    400: '148 163 184',
    500: '100 116 139',
    600: '71 85 105',
    700: '51 65 85',
    800: '30 41 59',
    900: '15 23 42',
  },
  radius: '0.5rem',
  fontFamily: "Inter, system-ui, -apple-system, sans-serif",
};
