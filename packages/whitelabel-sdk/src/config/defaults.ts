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
  // Tailwind's stock values for every other family the components name, and the three status
  // steps tailwind.config.js has always defined. Generated from tailwindcss/colors.
  palettes: {
    gray: { 50: '249 250 251', 100: '243 244 246', 200: '229 231 235', 300: '209 213 219', 400: '156 163 175', 500: '107 114 128', 600: '75 85 99', 700: '55 65 81', 800: '31 41 55', 900: '17 24 39', 950: '3 7 18' },
    neutral: { 50: '250 250 250', 100: '245 245 245', 200: '229 229 229', 300: '212 212 212', 400: '163 163 163', 500: '115 115 115', 600: '82 82 82', 700: '64 64 64', 800: '38 38 38', 900: '23 23 23', 950: '10 10 10' },
    red: { 50: '254 242 242', 100: '254 226 226', 200: '254 202 202', 300: '252 165 165', 400: '248 113 113', 500: '239 68 68', 600: '220 38 38', 700: '185 28 28', 800: '153 27 27', 900: '127 29 29', 950: '69 10 10' },
    orange: { 50: '255 247 237', 100: '255 237 213', 200: '254 215 170', 300: '253 186 116', 400: '251 146 60', 500: '249 115 22', 600: '234 88 12', 700: '194 65 12', 800: '154 52 18', 900: '124 45 18', 950: '67 20 7' },
    amber: { 50: '255 251 235', 100: '254 243 199', 200: '253 230 138', 300: '252 211 77', 400: '251 191 36', 500: '245 158 11', 600: '217 119 6', 700: '180 83 9', 800: '146 64 14', 900: '120 53 15', 950: '69 26 3' },
    yellow: { 50: '254 252 232', 100: '254 249 195', 200: '254 240 138', 300: '253 224 71', 400: '250 204 21', 500: '234 179 8', 600: '202 138 4', 700: '161 98 7', 800: '133 77 14', 900: '113 63 18', 950: '66 32 6' },
    green: { 50: '240 253 244', 100: '220 252 231', 200: '187 247 208', 300: '134 239 172', 400: '74 222 128', 500: '34 197 94', 600: '22 163 74', 700: '21 128 61', 800: '22 101 52', 900: '20 83 45', 950: '5 46 22' },
    emerald: { 50: '236 253 245', 100: '209 250 229', 200: '167 243 208', 300: '110 231 183', 400: '52 211 153', 500: '16 185 129', 600: '5 150 105', 700: '4 120 87', 800: '6 95 70', 900: '6 78 59', 950: '2 44 34' },
    blue: { 50: '239 246 255', 100: '219 234 254', 200: '191 219 254', 300: '147 197 253', 400: '96 165 250', 500: '59 130 246', 600: '37 99 235', 700: '29 78 216', 800: '30 64 175', 900: '30 58 138', 950: '23 37 84' },
    indigo: { 50: '238 242 255', 100: '224 231 255', 200: '199 210 254', 300: '165 180 252', 400: '129 140 248', 500: '99 102 241', 600: '79 70 229', 700: '67 56 202', 800: '55 48 163', 900: '49 46 129', 950: '30 27 75' },
    purple: { 50: '250 245 255', 100: '243 232 255', 200: '233 213 255', 300: '216 180 254', 400: '192 132 252', 500: '168 85 247', 600: '147 51 234', 700: '126 34 206', 800: '107 33 168', 900: '88 28 135', 950: '59 7 100' },
    pink: { 50: '253 242 248', 100: '252 231 243', 200: '251 207 232', 300: '249 168 212', 400: '244 114 182', 500: '236 72 153', 600: '219 39 119', 700: '190 24 93', 800: '157 23 77', 900: '131 24 67', 950: '80 7 36' },
    success: { 50: '240 253 244', 500: '34 197 94', 600: '22 163 74' },
    warning: { 50: '255 251 235', 500: '245 158 11', 600: '217 119 6' },
    error: { 50: '254 242 242', 500: '239 68 68', 600: '220 38 38' },
  },
  white: '255 255 255',
  black: '0 0 0',
  radius: '0.5rem',
  fontFamily: "Inter, system-ui, -apple-system, sans-serif",
  // Tailwind's stock `font-mono` stack.
  // The serif accent the pages set their display lines and quotes in.
  accentFontFamily: "'Newsreader', Georgia, serif",
  monoFontFamily: 'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", "Courier New", monospace',
  // The primary button as it has always looked: square, dark neutral with white text, and the
  // reverse in dark mode. Refers to the theme's own variables, so a brand that changes its
  // neutrals (COBRO's near-black) moves the button with them, as before.
  button: {
    radius: '0px',
    bg: 'rgb(var(--wl-secondary-900))',
    fg: 'rgb(var(--wl-white))',
    hoverBg: 'rgb(var(--wl-secondary-700))',
    darkBg: 'rgb(var(--wl-white))',
    darkFg: 'rgb(var(--wl-secondary-900))',
    darkHoverBg: 'rgb(var(--wl-secondary-100))',
  },
};
