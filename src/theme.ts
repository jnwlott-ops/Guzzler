import type { PriceVerdict } from './lib/pricing';

/**
 * Guzzler's look: a hot rod decal on a black dashboard.
 *
 * The name is a joke and the app should sound like it means the joke. So the
 * reference is arcade — Crazy Taxi flame-job swag: near-black ground, a flame
 * ramp from cream through orange to deep red, heavy slanted type that leans
 * like it's already moving.
 *
 * There is exactly one rule that keeps this from wrecking the map, and every
 * color below obeys it:
 *
 *   Brand is a GRADIENT and lives on chrome. Data is FLAT and lives on pins.
 *
 * A driver glancing down at 70mph is reading price verdicts off pin color. If
 * the brand and the data share a hue, that glance gets slower, and this app is
 * only worth anything if that glance is fast. So the flame ramp never touches
 * a pin, and `gouge` was pulled toward pink-red specifically so it can never
 * be mistaken for the flame's tail.
 */

/**
 * The flame, cool tip to hot base. Ordered for a top-to-bottom gradient fill,
 * which is how a real flame job is painted: light where it licks, deep where
 * it burns.
 */
export const flame = {
  tip: '#FFF07A',
  gold: '#FFC53D',
  orange: '#FF7A00',
  deep: '#E02D1B',
} as const;

/** The flame as a gradient stop array, for expo-linear-gradient. */
export const FLAME_GRADIENT = [flame.tip, flame.gold, flame.orange, flame.deep] as const;

export const colors = {
  /** Near-black. Flames need something to burn against. */
  background: '#0E1116',
  /** A raised surface within the panel: input fields, inactive segments. */
  surface: '#191E26',
  /** Hairlines. Visible on the panel without becoming a drawn box. */
  border: '#2C333D',

  /** Warm cream rather than white — pure white is clinical, this is not. */
  text: '#FFF4E2',
  textMuted: '#93A0B0',

  /**
   * The flat stand-in for the flame, where a gradient is overkill or
   * unavailable: a selected control, an icon, the route line on the map.
   */
  accent: flame.gold,
  /** Text on an accent or flame fill. Near-black — hot yellow demands it. */
  onAccent: '#1A0F00',

  /**
   * The active face of a control inside the panel. Deliberately quiet: only
   * the primary action gets fire, and every other selected state uses this, so
   * the flame keeps meaning something.
   */
  raised: '#333C48',

  /**
   * An inverted emphasis surface, for the rare element that should sit *above*
   * the panel rather than in it. A separate token because using the text color
   * as a background silently breaks the moment the theme flips.
   */
  strong: '#FFF4E2',
  onStrong: '#0E1116',

  /**
   * Verdict colors — flat, always, and never drawn from the flame ramp.
   *
   * `gouge` is a pink-red rather than the flame's `deep` scarlet, so a pin can
   * never be confused with brand chrome. `typical` is neutral slate because
   * the middle case genuinely is "nothing to see here." Pins also carry the
   * price as text, so color is never the only cue for red-green color vision
   * deficiency.
   */
  deal: '#3DDC84',
  typical: '#7C8595',
  gouge: '#FF4D6D',
  unknown: '#5A6472',
} as const;

/**
 * The voice, for the few places the brand gets to shout: the primary action,
 * the splash, a best-in-view badge. Heavy, slanted and shouting — which is
 * exactly why it stays off anything a driver has to *read* rather than
 * recognize. Prices, names and addresses are set in the plain face.
 */
export const brandType = {
  fontWeight: '900',
  fontStyle: 'italic',
  letterSpacing: 0.6,
  textTransform: 'uppercase',
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
