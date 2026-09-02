import type { PriceVerdict } from './lib/pricing';

export const colors = {
  background: '#FFFFFF',
  surface: '#F5F6F8',
  border: '#E2E5EA',
  text: '#12171F',
  textMuted: '#6B7480',
  accent: '#1B6BFF',

  /** Verdict colors, chosen to stay distinguishable for red-green color vision
   *  deficiency: the pins also differ in label, so color is never the only cue. */
  deal: '#1B8A4B',
  typical: '#8A6D1F',
  gouge: '#C43A31',
  unknown: '#8B949E',
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
