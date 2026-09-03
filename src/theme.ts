import type { PriceVerdict } from './lib/pricing';

/**
 * Guzzler's look: the chrome is an instrument panel floating over the world.
 *
 * Dark rather than white on purpose. This is a driving app, so the map is the
 * thing being read and the controls should recede into a dashboard around it —
 * and a dark panel is far kinder at night, which is when hunting for fuel
 * actually hurts. It also gets the app off the default white-card-and-iOS-blue
 * look that every React Native project starts with.
 */
export const colors = {
  /** The instrument panel itself — asphalt at dusk. */
  background: '#14181E',
  /** A raised surface within the panel: input fields, inactive segments. */
  surface: '#1E242D',
  /** Hairlines. Visible on the panel without becoming a drawn box. */
  border: '#2E3641',

  /** Instrument lettering — warm white rather than pure, so it doesn't glare. */
  text: '#F3F1EC',
  textMuted: '#98A2B0',

  /**
   * Signal yellow. The color of fuel price signage and highway warnings, and
   * the one place Guzzler spends brand: active controls, the route line, the
   * star on the best station.
   */
  accent: '#FFC53D',
  /** Text on an accent fill. Near-black rather than white — yellow needs it. */
  onAccent: '#1A1400',

  /**
   * The active face of a control inside the panel — a segment that is switched
   * on. Deliberately quiet: only one control per screen gets the accent, and
   * every other selected state uses this instead, so the yellow keeps meaning
   * something.
   */
  raised: '#39424F',

  /**
   * An inverted emphasis surface, for the rare element that should sit *above*
   * the panel rather than in it. A separate token because using the text color
   * as a background silently breaks the moment the theme flips.
   */
  strong: '#F3F1EC',
  onStrong: '#14181E',

  /**
   * Verdict colors. Brightened for a dark ground, and deliberately *not* the
   * accent — semantic color carries data, brand color carries identity, and
   * letting them share a hue makes both harder to read.
   *
   * "Typical" is neutral slate rather than amber: the middle case genuinely is
   * "nothing to see here," and reserving amber keeps it from competing with
   * the brand and with gouge. Pins also carry text, so color is never the only
   * cue for red-green color vision deficiency.
   */
  deal: '#35D07F',
  typical: '#7C8595',
  gouge: '#FF5C5C',
  unknown: '#5A6472',
} as const;

export const verdictColor: Record<PriceVerdict, string> = {
  deal: colors.deal,
  typical: colors.typical,
  gouge: colors.gouge,
  unknown: colors.unknown,
};

export const verdictLabel: Record<PriceVerdict, string> = {
  deal: 'Below local average',
  typical: 'Around local average',
  gouge: 'Above local average',
  unknown: 'No recent price',
};

export const spacing = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 24,
} as const;

export const radius = {
  sm: 6,
  md: 10,
  lg: 16,
} as const;
