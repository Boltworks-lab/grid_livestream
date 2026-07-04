/**
 * Design tokens extracted from the prototypes (prototypes/css/grid.css :root and
 * prototypes/mobile/index.html — both declare the identical palette).
 * Pure data: no React, consumable from web CSS-in-JS, RN StyleSheet, and Tailwind config.
 * Names keep the prototype's shorthand (bg0..bg4, t1..t3) so cross-referencing the
 * reference implementation stays trivial.
 */

export const color = {
  /** Surface stack, darkest (page) to lightest (elevated) */
  bg0: '#0B0B12',
  bg1: '#13131D',
  bg2: '#1B1B28',
  bg3: '#252536',
  bg4: '#2F2F44',

  /** Brand */
  purple: '#8B5CF6',
  purple2: '#A78BFA',
  purpleDim: '#4C3A8C',

  /** Diamonds / earnings */
  amber: '#F59E0B',
  amber2: '#FBBF24',
  amberDim: '#7A4F0A',

  /** Accents */
  teal: '#2DD4BF',
  green: '#10B981',
  red: '#EF4444',
  pink: '#EC4899',
  blue: '#3B82F6',

  /** Text, primary to faint */
  t1: '#F1F0FA',
  t2: '#9D9BB8',
  t3: '#615F7E',

  white: '#FFFFFF',
} as const;

/** Translucent overlays (kept as rgba strings, exactly as the prototypes use them) */
export const alpha = {
  purpleGlow: 'rgba(139,92,246,.16)',
  amberGlow: 'rgba(245,158,11,.13)',
  border: 'rgba(255,255,255,.07)',
  borderAccent: 'rgba(139,92,246,.2)',
  scrim: 'rgba(0,0,0,.55)',
} as const;

/** Signature gradients (135deg in CSS; RN uses start/end points) */
export const gradient = {
  brand: ['#8B5CF6', '#3B82F6'],
  goLive: ['#8B5CF6', '#EC4899'],
  top: ['#F59E0B', '#EC4899'],
} as const;

/** Corner radii (px). r/rl/rx follow the prototype naming. */
export const radius = {
  r: 10,
  rl: 14,
  rx: 18,
  pill: 99,
} as const;

/**
 * Spacing scale (px), derived from the paddings/gaps that recur in the prototypes
 * (the prototypes hardcode values; this is the consolidated scale to build with).
 */
export const space = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 14,
  xl: 18,
  xxl: 24,
} as const;

export const font = {
  sans: "'Inter', sans-serif",
  mono: "'JetBrains Mono', monospace",
  /** Base app font size in px (desktop .app) */
  baseSize: 14,
} as const;

export const tokens = { color, alpha, gradient, radius, space, font } as const;
export type Tokens = typeof tokens;
