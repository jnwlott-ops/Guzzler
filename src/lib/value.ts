import { medianPrice, priceFor, verdictFor, type PriceVerdict } from './pricing';
import { drivingDistanceMiles, reachabilityOf, type RangeEstimate, type Reachability } from './range';
import type { Amenity, FuelGrade, LatLng, Station } from '../types';

/**
 * What the map is currently ranking on.
 * - `price`  — cheapest fuel wins, ignoring everything else.
 * - `value`  — price weighted against what drivers say the stop is actually like.
 */
export type RankMode = 'price' | 'value';

/**
 * Default share of the value score that price accounts for; the rest comes from
 * driver ratings. The driver can move this — someone on a budget road trip and
 * someone hunting a decent lunch want different answers from the same map — so
 * every scoring function takes it as a parameter rather than reading a constant.
 */
export const DEFAULT_PRICE_WEIGHT = 0.65;

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
  /** Estimated driving miles from the driver. Undefined without a location. */
  distance: number | undefined;
  /** Whether the driver can actually get here on what's in the tank. */
  reachability: Reachability;
}

export interface RankingResult {
  ranked: RankedStation[];
  median: number | undefined;
  /** The winner under the active mode, if there is one. */
  best: RankedStation | undefined;
}

/** Where the driver is and how far they can get, for reachability scoring. */
export interface ReachContext {
  origin: LatLng | undefined;
  range: RangeEstimate | undefined;
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
export function ratingPoints(station: Station): number {
  const { overall, restroom, food, reviewCount } = station.ratings;

  // Restroom and food are weighted equally with overall: they are the two
  // things travelers actually pick stops on, and they're what no price feed
  // can sell us. A stop with no food rating simply isn't judged on food.
  const scores = [overall, restroom, food].filter((s): s is number => s !== undefined);
  if (scores.length === 0 || reviewCount === 0) return NEUTRAL;

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
  priceWeight: number = DEFAULT_PRICE_WEIGHT,
): number | undefined {
  const price = priceFor(station, grade);
  if (price === undefined) return undefined;

  // Clamped so a bad preference value can't produce a score outside 0-100.
  const weight = Math.min(1, Math.max(0, priceWeight));

  const score =
    pricePoints(price, minPrice, maxPrice) * weight + ratingPoints(station) * (1 - weight);
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
  reach?: ReachContext,
  priceWeight: number = DEFAULT_PRICE_WEIGHT,
): RankingResult {
  const median = medianPrice(stations, grade);

  const prices = stations
    .map((s) => priceFor(s, grade))
    .filter((p): p is number => p !== undefined);

  const minPrice = prices.length > 0 ? Math.min(...prices) : 0;
  const maxPrice = prices.length > 0 ? Math.max(...prices) : 0;

  const withScores = stations.map((station) => {
    const distance = reach?.origin
      ? drivingDistanceMiles(reach.origin, station.coordinate)
      : undefined;

    return {
      station,
      price: priceFor(station, grade),
      value: valueScore(station, grade, minPrice, maxPrice, priceWeight),
      distance,
      reachability:
        distance === undefined
          ? ('comfortable' as Reachability)
          : reachabilityOf(distance, reach?.range),
    };
  });

  const sortedValues = withScores
    .map((s) => s.value)
    .filter((v): v is number => v !== undefined)
    .sort((a, b) => a - b);

  // The winner under the active mode: lowest price, or highest value score.
  // Unreachable stations are excluded outright — the cheapest gas in the state
  // is not a recommendation if the driver runs dry forty miles short of it.
  let bestId: string | undefined;
  let bestMetric = -Infinity;
  for (const entry of withScores) {
    if (entry.reachability === 'unreachable') continue;

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
    distance: entry.distance,
    reachability: entry.reachability,
  }));

  return {
    ranked,
    median,
    best: ranked.find((r) => r.isBest),
  };
}

/**
 * The advice a driver at a gouging exit actually needs: can I make it to
 * something cheaper, and is the detour worth it?
 *
 * This is the point of the range feature. Highway-exit pricing works precisely
 * because drivers don't know whether they can safely pass it up — putting a
 * number on that is what turns the price map into a decision.
 */
export interface RangeDeal {
  /** The cheapest station the driver can comfortably reach. */
  target: RankedStation;
  /** The nearest station, i.e. the default "just pull in here" option. */
  nearest: RankedStation;
  /** Savings on a full fill-up by driving on. Positive means worth it. */
  savings: number;
  /** Extra driving miles the detour costs versus the nearest station. */
  extraMiles: number;
}

/**
 * Finds whether pressing on beats filling up at the nearest station.
 *
 * Only considers `comfortable` stations: advice that spends the driver's
 * reserve to save three dollars is bad advice, however good the arithmetic
 * looks.
 */
export function findRangeDeal(
  ranked: RankedStation[],
  tankGallons: number,
): RangeDeal | undefined {
  const usable = ranked.filter(
    (r) => r.price !== undefined && r.distance !== undefined && r.reachability === 'comfortable',
  );
  if (usable.length < 2) return undefined;

  const nearest = usable.reduce((a, b) => (a.distance! <= b.distance! ? a : b));
  const cheapest = usable.reduce((a, b) => (a.price! <= b.price! ? a : b));

  if (cheapest.station.id === nearest.station.id) return undefined;

  const savings = (nearest.price! - cheapest.price!) * tankGallons;
  const extraMiles = cheapest.distance! - nearest.distance!;

  // Not worth surfacing for pocket change, and never worth surfacing when the
  // "deal" is more expensive than just stopping.
  if (savings < 1) return undefined;

  return { target: cheapest, nearest, savings, extraMiles };
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
