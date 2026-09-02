import type { FuelGrade, Station } from '../types';

/**
 * How a station's price compares to what's normal nearby. This is the core of
 * Guzzler's pitch: an absolute price means nothing to a traveler who doesn't
 * know the local going rate, but "38 cents over the local median" does.
 */
export type PriceVerdict = 'deal' | 'typical' | 'gouge' | 'unknown';

/**
 * Fraction above/below the local median that separates the three verdicts.
 * At a $3.29 median this puts the bands at roughly +/- 10 cents, which is about
 * the point where driving to a different station starts to be worth it.
 */
const VERDICT_THRESHOLD = 0.03;

export function priceFor(station: Station, grade: FuelGrade): number | undefined {
  return station.prices[grade]?.price;
}

/** Median price for `grade` across the given stations, or undefined if none post it. */
export function medianPrice(stations: Station[], grade: FuelGrade): number | undefined {
  const prices = stations
    .map((station) => priceFor(station, grade))
    .filter((price): price is number => price !== undefined)
    .sort((a, b) => a - b);

  if (prices.length === 0) return undefined;

  const mid = Math.floor(prices.length / 2);
  return prices.length % 2 === 0 ? (prices[mid - 1] + prices[mid]) / 2 : prices[mid];
}

/**
 * Classify a station against the local median.
 *
 * The median rather than the mean on purpose: one $6.00 highway-exit gouger
 * shouldn't drag the "normal" price up and make itself look reasonable.
 */
export function verdictFor(price: number | undefined, median: number | undefined): PriceVerdict {
  if (price === undefined || median === undefined || median <= 0) return 'unknown';

  const delta = (price - median) / median;
  if (delta < -VERDICT_THRESHOLD) return 'deal';
  if (delta > VERDICT_THRESHOLD) return 'gouge';
  return 'typical';
}

/** Cheapest station for a grade, used to highlight the best nearby option. */
export function cheapestStation(stations: Station[], grade: FuelGrade): Station | undefined {
  let best: Station | undefined;
  let bestPrice = Infinity;

  for (const station of stations) {
    const price = priceFor(station, grade);
    if (price !== undefined && price < bestPrice) {
      best = station;
      bestPrice = price;
    }
  }
  return best;
}

/**
 * What a driver saves filling up here instead of at the median station.
 * Positive means cheaper than median.
 */
export function savingsPerTank(
  price: number | undefined,
  median: number | undefined,
  tankGallons = 14,
): number | undefined {
  if (price === undefined || median === undefined) return undefined;
  return (median - price) * tankGallons;
}

export function formatPrice(price: number | undefined): string {
  return price === undefined ? '--' : `$${price.toFixed(2)}`;
}

/** Compact price for map pins, where horizontal space is tight: "3.29" → "329". */
export function formatPinPrice(price: number | undefined): string {
  return price === undefined ? '--' : price.toFixed(2).replace('.', '');
}

/** Relative age of a price, e.g. "12m ago". Freshness is a trust signal. */
export function formatAge(reportedAt: string | undefined): string {
  if (!reportedAt) return 'no data';

  const minutes = Math.floor((Date.now() - new Date(reportedAt).getTime()) / 60000);
  if (minutes < 1) return 'just now';
  if (minutes < 60) return `${minutes}m ago`;

  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;

  return `${Math.floor(hours / 24)}d ago`;
}
