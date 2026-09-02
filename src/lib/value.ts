import { medianPrice, priceFor, verdictFor, type PriceVerdict } from './pricing';
import type { Amenity, FuelGrade, Station } from '../types';

/**
 * What the map is currently ranking on.
 * - `price`  — cheapest fuel wins, ignoring everything else.
 * - `value`  — price weighted against what drivers say the stop is actually like.
 */
export type RankMode = 'price' | 'value';

/**
 * How much of the value score price accounts for. The rest comes from driver
 * ratings. Price stays dominant on purpose — this is still a gas-price app, and
 * a spotless restroom shouldn't rescue a station charging 80 cents over.
 */
const PRICE_WEIGHT = 0.65;
const RATING_WEIGHT = 1 - PRICE_WEIGHT;

/**
 * Ratings below this many reviews get pulled toward neutral, so one glowing
 * review can't vault an unknown station over a well-reviewed one.
 */
const CONFIDENCE_REVIEWS = 5;

/** Neutral score used wherever we genuinely don't know. */
const NEUTRAL = 50;

export interface RankedStation {
  station: Station;
  price: number | undefined;
  /** 0-100, higher is better. Undefined when the station posts no price. */
  value: number | undefined;
  /** Price relative to the local median. Drives pin color in `price` mode. */
  priceVerdict: PriceVerdict;
  /** Value relative to other stations in view. Drives pin color in `value` mode. */
  valueVerdict: PriceVerdict;
  /** Best station under the active mode. */
  isBest: boolean;
}

export interface RankingResult {
  ranked: RankedStation[];
  median: number | undefined;
  /** The winner under the active mode, if there is one. */
  best: RankedStation | undefined;
}

/**
 * Converts a station's price into 0-100, where 100 is the cheapest in view.
 *
 * Scaled against the visible range rather than an absolute dollar figure,
 * because "cheap" only means anything locally — $4.10 is a steal in one metro
 * and a gouge in another.
 */
function pricePoints(price: number, min: number, max: number): number {
  // Everything in view costs the same, so price can't distinguish anything.
  if (max <= min) return NEUTRAL;
  return ((max - price) / (max - min)) * 100;
}

/**
 * Converts driver ratings into 0-100, damped by how many people have rated.
 *
 * A 5.0 from two people lands well short of a 4.6 from fifty — the shrinkage
 * toward neutral is what stops a handful of reviews from deciding the ranking.
 */
function ratingPoints(station: Station): number {
  const { overall, restroom, reviewCount } = station.ratings;

  const scores = [overall, restroom].filter((s): s is number => s !== undefined);
  if (scores.length === 0 || reviewCount === 0) return NEUTRAL;

  // Restroom is weighted equally with overall: it is the thing travelers
  // actually pick stops on, and it's what makes this ranking worth having.
  const mean = scores.reduce((sum, s) => sum + s, 0) / scores.length;
  const raw = ((mean - 1) / 4) * 100;

  const confidence = Math.min(reviewCount, CONFIDENCE_REVIEWS) / CONFIDENCE_REVIEWS;
  return NEUTRAL + (raw - NEUTRAL) * confidence;
}

/**
 * Blends price and driver ratings into a single 0-100 score.
 *
 * Note what this function does not take: `station.sponsored`. Paid placement is
 * structurally incapable of moving this number, which is the property the whole
 * business model rests on.
 */
export function valueScore(
  station: Station,
  grade: FuelGrade,
  minPrice: number,
  maxPrice: number,
): number | undefined {
  const price = priceFor(station, grade);
  if (price === undefined) return undefined;

  const score = pricePoints(price, minPrice, maxPrice) * PRICE_WEIGHT + ratingPoints(station) * RATING_WEIGHT;
  return Math.round(score);
}

/** Splits stations into good/typical/poor bands by their position in view. */
function bandFor(score: number | undefined, sorted: number[]): PriceVerdict {
  if (score === undefined || sorted.length === 0) return 'unknown';

  // Percentile within the visible set, so the bands stay meaningful whether
  // the user is looking at a dense city or a sparse stretch of interstate.
  const rank = sorted.filter((s) => s < score).length / sorted.length;
  if (rank >= 0.7) return 'deal';
  if (rank <= 0.3) return 'gouge';
  return 'typical';
}

/**
 * Ranks the visible stations under the active mode.
 *
 * Everything is computed against what's currently on screen, so panning to a
 * new area re-baselines the comparison rather than carrying a stale sense of
 * what "normal" costs.
 */
export function rankStations(
  stations: Station[],
  grade: FuelGrade,
  mode: RankMode,
): RankingResult {
  const median = medianPrice(stations, grade);

  const prices = stations
    .map((s) => priceFor(s, grade))
    .filter((p): p is number => p !== undefined);

  const minPrice = prices.length > 0 ? Math.min(...prices) : 0;
  const maxPrice = prices.length > 0 ? Math.max(...prices) : 0;

  const withScores = stations.map((station) => ({
    station,
    price: priceFor(station, grade),
    value: valueScore(station, grade, minPrice, maxPrice),
  }));

  const sortedValues = withScores
    .map((s) => s.value)
    .filter((v): v is number => v !== undefined)
    .sort((a, b) => a - b);

  // The winner under the active mode: lowest price, or highest value score.
  let bestId: string | undefined;
  let bestMetric = -Infinity;
  for (const entry of withScores) {
    const metric =
      mode === 'price'
        ? entry.price === undefined
          ? undefined
          : -entry.price
        : entry.value;
    if (metric !== undefined && metric > bestMetric) {
      bestMetric = metric;
      bestId = entry.station.id;
    }
  }

  const ranked: RankedStation[] = withScores.map((entry) => ({
    station: entry.station,
    price: entry.price,
    value: entry.value,
    priceVerdict: verdictFor(entry.price, median),
    valueVerdict: bandFor(entry.value, sortedValues),
    isBest: entry.station.id === bestId,
  }));

  return {
    ranked,
    median,
    best: ranked.find((r) => r.isBest),
  };
}

/** The verdict that should color a pin, given the active mode. */
export function verdictForMode(ranked: RankedStation, mode: RankMode): PriceVerdict {
  return mode === 'price' ? ranked.priceVerdict : ranked.valueVerdict;
}

/** True when a station offers every amenity the user filtered on. */
export function matchesFilters(station: Station, required: Amenity[]): boolean {
  return required.every((amenity) => station.amenities.includes(amenity));
}

/** Formats a 1-5 rating for display, e.g. "4.3". */
export function formatRating(rating: number | undefined): string {
  return rating === undefined ? '--' : rating.toFixed(1);
}
