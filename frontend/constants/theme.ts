/**
 * AllergyGenie – shared design tokens
 * Import { C, S, R } from '@/constants/theme' everywhere.
 *
 * C = colours   S = spacing/sizing   R = border-radius
 */

// ── Colour palette ────────────────────────────────────────────────────────────
export const C = {
  // Primary teal family
  teal:        '#0d8fa1',
  tealDark:    '#0a7080',
  tealDeep:    '#085f6d',
  tealLight:   '#e8f8fa',
  tealMid:     '#b2e4eb',
  tealSoft:    '#d0eff4',

  // Background shades
  bg:          '#f0f9fb',
  bgWhite:     '#ffffff',
  bgCard:      '#f8fbfc',
  bgHero:      '#e8f7f9',

  // Text
  navy:        '#0e2244',
  navyLight:   '#132744',
  slate:       '#3b4a5f',
  slateMid:    '#475569',
  slateLight:  '#64748b',
  slateXLight: '#94a3b8',

  // Borders
  border:      '#ddf0f4',
  borderCard:  '#c9dde2',
  borderInput: '#cfd8df',

  // Status
  danger:      '#ef4444',
  dangerBg:    '#fff1f2',
  dangerBorder:'#fecdd3',
  warning:     '#f59e0b',
  warningBg:   '#fef3c7',
  success:     '#10b981',
  successBg:   '#d1fae5',

  // Stats strip
  statBg:      '#0b6e80',

  // Home page decorative
  accent:      '#16bfd6',
  heroGrad1:   '#e8f7f9',

  // Misc
  white:       '#ffffff',
  black:       '#000000',
  overlay:     'rgba(0,0,0,0.45)',
};

// ── Spacing scale ─────────────────────────────────────────────────────────────
export const S = {
  xs:  4,
  sm:  8,
  md:  12,
  lg:  16,
  xl:  24,
  xxl: 32,
  pg:  20,   // page horizontal padding (desktop)
  pgSm:14,   // page horizontal padding (mobile)
};

// ── Border-radius ─────────────────────────────────────────────────────────────
export const R = {
  sm:  8,
  md:  12,
  lg:  16,
  xl:  24,
  pill:999,
};
