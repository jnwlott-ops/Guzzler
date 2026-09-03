import { priceFor } from './pricing';
import type { CorridorStation } from './route';
import type { FuelGrade, Route, Station, Vehicle } from '../types';

/**
 * Picks the fuel stops for a trip.
 *
 * The framing matters: this is not "find the highest-rated station." It's a
 * constrained optimization — never run below reserve, and among the plans that
 * satisfy that, spend the least once detours and stop quality are priced in.
 * A 4.8-rated stop fifteen miles off the interstate is usually worse than a 4.2
 * at the exit, and a planner that only chased ratings would keep choosing it.
 *
 * Solved as a shortest-path DP over stations ordered along the route. Stations
 * in a corridor number in the dozens to low hundreds, so the O(n^2) transition
 * scan is comfortably fast and avoids the stranding a greedy scan can cause:
 * greedily taking the cheapest reachable station can leave you unable to reach
 * anything at all from there.
 */

/**
 * Same reserve the range math uses: an eighth of a full tank stays untouched.
 * Kept in sync with lib/range.ts deliberately — a planner that spends the
 * reserve the map promised to protect would be worse than no planner.
 */
const RESERVE_FRACTION = 0.125;

/**
 * Dollars per rating point above neutral (3.0) that we'll trade away on price.
 *
 * At $1.50, a 5-star stop carries a $3 advantage — enough to break a near-tie,
 * not enough to override a 40-cent-per-gallon gap on a full tank. This is the
 * knob for how much "highest rated" should override "cheapest".
 */
const RATING_DOLLARS = 1.5;

/** Reviews needed before a rating counts at full strength. Matches lib/value.ts. */
const CONFIDENCE_REVIEWS = 5;

/**
 * Dollars per extra mile of detour, beyond the fuel it burns — the cost of the
 * time and the aggravation. Roughly what an extra couple of minutes is worth.
 */
const DETOUR_DOLLARS_PER_MILE = 0.25;

/**
 * Round-trip detour miles a stop can cost before it counts as taking the
 * driver off the beaten path.
 *
 * Below this, a stop is effectively on the way — the station at the exit, a
 * block off the highway — and goes into the plan without ceremony. Above it,
 * the driver approves or rejects before it becomes a live suggestion. Three
 * miles round trip is roughly four minutes; beyond that it's a decision, not a
 * detail, and it isn't ours to make quietly.
 */
export const ON_THE_WAY_DETOUR_MILES = 3;

/**
 * What making a stop costs at all, independent of fuel: pulling off, queuing,
 * filling, getting back on. Call it ten minutes.
 *
 * Without this the planner treats stops as free and will happily insert extra
 * ones — it once chained two stations a mile apart to collect a well-rated
 * stop's bonus for thirteen cents of fuel.
 */
const STOP_DOLLARS = 4;

export interface PlannedStop {
  station: Station;
  /** Miles from the trip start where this stop sits. */
  alongMiles: number;
  /** Extra miles driven to reach it and rejoin the route. */
  detourMiles: number;
  pricePerGallon: number;
  /** Gallons (or kWh) bought here, refilling what the previous leg burned. */
  units: number;
  /** What this stop costs in fuel. */
  fuelCost: number;
  /** Miles of range left on arrival, above reserve. */
  arriveWithMiles: number;
  /**
   * True when this stop takes the driver meaningfully off their route, so it
   * needs an explicit yes before it counts as a suggestion.
   */
  requiresApproval: boolean;
}

export interface FeasibleTripPlan {
  feasible: true;
  stops: PlannedStop[];
  /** Total spent on fuel across every stop. */
  fuelCost: number;
  totalDetourMiles: number;
  /** Range left above reserve when arriving at the destination. */
  arriveWithMiles: number;
}

export interface InfeasibleTripPlan {
  feasible: false;
  /** How far along the route the driver can actually get. */
  reachableToMiles: number;
  /** How much further they'd need to go to reach the next option. */
  shortfallMiles: number;
  reason: string;
}

export type TripPlan = FeasibleTripPlan | InfeasibleTripPlan;

/**
 * The off-route stops still waiting on a yes or no.
 *
 * A plan is not a live suggestion until this is empty: anything that pulls the
 * driver off their route is theirs to accept, not ours to assume.
 */
export function stopsAwaitingApproval(
  plan: TripPlan,
  approvedStationIds: readonly string[],
): PlannedStop[] {
  if (!plan.feasible) return [];

  const approved = new Set(approvedStationIds);
  return plan.stops.filter((stop) => stop.requiresApproval && !approved.has(stop.station.id));
}

/** True when every off-route stop has been explicitly accepted. */
export function isPlanLive(plan: TripPlan, approvedStationIds: readonly string[]): boolean {
  return plan.feasible && stopsAwaitingApproval(plan, approvedStationIds).length === 0;
}

/** Rating for a stop, damped by how many people have actually rated it. */
function effectiveRating(station: Station): number | undefined {
  const { overall, restroom, food, reviewCount } = station.ratings;

  // Averaged across every axis the stop has been rated on, so a place with a
  // good restroom and good food outranks one with only a good restroom.
  const scores = [overall, restroom, food].filter((s): s is number => s !== undefined);
  if (scores.length === 0 || reviewCount === 0) return undefined;

  const base = scores.reduce((sum, s) => sum + s, 0) / scores.length;

  const confidence = Math.min(reviewCount, CONFIDENCE_REVIEWS) / CONFIDENCE_REVIEWS;
  // Pull toward neutral when we barely have any opinions.
  return 3 + (base - 3) * confidence;
}

/**
 * Translates the driver's price-vs-quality preference into dollars per rating
 * point, so the trip planner obeys the same dial as the map.
 *
 * At the default weight of 0.65 this returns the planner's original $1.50. Set
 * to "Best stops" and a five-star stop is worth roughly twice as much detour
 * and price premium; set to "Cheapest" and ratings barely move the plan.
 */
export function ratingDollarsFor(priceWeight: number): number {
  const weight = Math.min(1, Math.max(0, priceWeight));
  // (1 - weight) is the share the driver gives to quality; 0.35 is the default
  // share, so this scales the baseline rather than replacing it.
  return RATING_DOLLARS * ((1 - weight) / 0.35);
}

/**
 * How much road each thinning bin covers, and how many stops survive in each.
 *
 * See `thinCandidates`. Ten miles is short enough that the choice inside a bin
 * barely matters — four stations in the same ten-mile stretch are the same
 * stop as far as a plan is concerned — and long enough to bound the search.
 */
const BIN_MILES = 10;
const PER_BIN = 4;

/**
 * Reduces a corridor to the stops actually worth searching over.
 *
 * The search is O(n squared) in candidates, which was fine when the corridor
 * came from one map screen and held dozens. Fetching stations along the whole
 * route changed that overnight: Atlanta to Austin yields about 10,700
 * candidates, and the search took nineteen seconds on a desktop — call it a
 * frozen minute on a phone.
 *
 * Only a handful of stops end up in any plan, and among stations within the
 * same ten miles of road the cheap ones dominate: a costlier neighbour can
 * only win by being on the way, which the detour term already prices. So each
 * bin keeps its best few by the same dollars the planner optimizes in, and the
 * rest cannot change the answer.
 *
 * Stations the driver chose are exempt — a pin thinned away would turn their
 * choice into an infeasible plan.
 */
function thinCandidates(
  candidates: CorridorStation[],
  grade: FuelGrade,
  ratingDollars: number,
  pinned: ReadonlySet<string>,
): CorridorStation[] {
  const bins = new Map<number, CorridorStation[]>();
  const kept: CorridorStation[] = [];

  for (const candidate of candidates) {
    if (pinned.has(candidate.station.id)) {
      kept.push(candidate);
      continue;
    }
    const bin = Math.floor(candidate.alongMiles / BIN_MILES);
    const existing = bins.get(bin);
    if (existing) existing.push(candidate);
    else bins.set(bin, [candidate]);
  }

  /** Same currency the search uses, minus the fuel volume it cannot know yet. */
  const attractiveness = (c: CorridorStation): number => {
    const rating = effectiveRating(c.station);
    return (
      priceFor(c.station, grade)! +
      c.detourMiles * DETOUR_DOLLARS_PER_MILE -
      (rating === undefined ? 0 : (rating - 3) * ratingDollars) / 10
    );
  };

  for (const bin of bins.values()) {
    bin.sort((a, b) => attractiveness(a) - attractiveness(b));
    kept.push(...bin.slice(0, PER_BIN));
  }

  return kept.sort((a, b) => a.alongMiles - b.alongMiles);
}

export interface PlanTripOptions {
  corridor: CorridorStation[];
  route: Route;
  vehicle: Vehicle;
  grade: FuelGrade;
  /** How strongly ratings override price. Defaults to RATING_DOLLARS. */
  ratingDollars?: number;
  /**
   * Stations the driver has rejected. Excluded outright and re-planned around,
   * so a "no" stays a no rather than resurfacing on the next recalculation.
   */
  excludedStationIds?: readonly string[];
  /**
   * Stations the driver has chosen. The plan must route through every one of
   * them, in route order, and says so plainly when it cannot rather than
   * quietly dropping the choice and picking its own stop again.
   */
  pinnedStationIds?: readonly string[];
}

/**
 * Plans the stops for a trip, or explains why it can't be done.
 *
 * Returns an infeasible plan rather than a best-effort one when there's a gap
 * too long to cross: "you can get 210 miles and then you're stuck" is useful,
 * and a plan that quietly runs the tank dry is not.
 */
export function planTrip({
  corridor,
  route,
  vehicle,
  grade,
  ratingDollars = RATING_DOLLARS,
  excludedStationIds = [],
  pinnedStationIds = [],
}: PlanTripOptions): TripPlan {
  const excluded = new Set(excludedStationIds);
  const pinned = new Set(pinnedStationIds);
  const totalMiles = route.distanceMiles;

  // Range on a full tank, and on what's in the tank right now, both measured
  // down to (not into) the reserve.
  const reserveMiles = vehicle.capacity * RESERVE_FRACTION * vehicle.efficiency;
  const fullRange = Math.max(0, vehicle.capacity * vehicle.efficiency - reserveMiles);
  const startRange = Math.max(
    0,
    vehicle.capacity * Math.min(1, Math.max(0, vehicle.level)) * vehicle.efficiency - reserveMiles,
  );

  // Already within reach — no stops needed, and saying so is the right answer.
  if (totalMiles <= startRange) {
    return {
      feasible: true,
      stops: [],
      fuelCost: 0,
      totalDetourMiles: 0,
      arriveWithMiles: startRange - totalMiles,
    };
  }

  // Only stations that sell the grade, and that the driver hasn't rejected.
  const sellsGrade = corridor.filter((c) => priceFor(c.station, grade) !== undefined);
  const usable = sellsGrade.filter((c) => !excluded.has(c.station.id));
  const candidates = thinCandidates(usable, grade, ratingDollars, pinned);

  if (candidates.length === 0) {
    return {
      feasible: false,
      reachableToMiles: startRange,
      shortfallMiles: totalMiles - startRange,
      reason:
        corridor.length === 0
          ? // No data is not the same as no options, and telling someone to
            // change fuel grade when we simply have no stations for this road
            // sends them off fixing the wrong thing.
            "We don't have station data along this route yet."
          : sellsGrade.length === 0
            ? 'No stations along this route sell that grade.'
            : 'Every usable stop on this route has been turned down.',
    };
  }

  const n = candidates.length;
  const cost = new Array<number>(n).fill(Infinity);
  const previous = new Array<number>(n).fill(-1);
  const legMiles = new Array<number>(n).fill(0);

  /**
   * Honouring the driver's chosen stops, expressed as edges the search may not
   * take.
   *
   * Candidates are sorted by distance along the route, so "this plan includes
   * every pin" is the same statement as "no leg jumps over one". Forbidding
   * those legs is enough — there is nothing to add to the cost function, and a
   * pin that cannot be reached simply leaves the search with no route to the
   * end, which surfaces as an ordinary infeasible plan rather than a silently
   * ignored choice.
   */
  const pinnedIndexes = candidates
    .map((c, i) => (pinned.has(c.station.id) ? i : -1))
    .filter((i) => i !== -1);

  /** `from` is -1 for the start of the trip, `to` is n for the destination. */
  const skipsPin = (from: number, to: number): boolean =>
    pinnedIndexes.some((p) => p > from && p < to);

  /** What stopping at `j` costs, having burned `miles` since the last fill. */
  const stopCost = (j: number, miles: number): number => {
    const c = candidates[j];
    const price = priceFor(c.station, grade)!;

    // Under fill-to-full, units bought exactly replace what the leg burned.
    const units = miles / vehicle.efficiency;
    const fuel = units * price;

    // Detour fuel is already inside `miles`; this is the time cost on top.
    const detourPenalty = c.detourMiles * DETOUR_DOLLARS_PER_MILE;

    const rating = effectiveRating(c.station);
    // Scale the bonus by how much of a fill this stop actually gets. A stop
    // where you buy a third of a tank earns a third of the goodwill —
    // otherwise the planner can farm the bonus with a token splash of fuel.
    const fillFraction = Math.min(1, units / vehicle.capacity);
    const ratingBonus =
      rating === undefined ? 0 : (rating - 3) * ratingDollars * fillFraction;

    return STOP_DOLLARS + fuel + detourPenalty - ratingBonus;
  };

  // Seed: stops reachable on the fuel already aboard.
  for (let j = 0; j < n; j++) {
    if (skipsPin(-1, j)) continue;
    const miles = candidates[j].alongMiles + candidates[j].detourMiles;
    if (miles <= startRange) {
      cost[j] = stopCost(j, miles);
      legMiles[j] = miles;
    }
  }

  // Relax forward. Candidates are sorted by alongMiles, so i < j is always the
  // earlier stop and one pass suffices.
  for (let i = 0; i < n; i++) {
    if (!Number.isFinite(cost[i])) continue;

    for (let j = i + 1; j < n; j++) {
      if (skipsPin(i, j)) continue;
      const miles = candidates[j].alongMiles - candidates[i].alongMiles + candidates[j].detourMiles;
      if (miles > fullRange) continue;

      const candidateCost = cost[i] + stopCost(j, miles);
      if (candidateCost < cost[j]) {
        cost[j] = candidateCost;
        previous[j] = i;
        legMiles[j] = miles;
      }
    }
  }

  // Finish: the cheapest last stop from which the destination is reachable.
  let bestLast = -1;
  let bestTotal = Infinity;
  for (let i = 0; i < n; i++) {
    if (!Number.isFinite(cost[i])) continue;
    if (skipsPin(i, n)) continue;
    if (totalMiles - candidates[i].alongMiles > fullRange) continue;

    if (cost[i] < bestTotal) {
      bestTotal = cost[i];
      bestLast = i;
    }
  }

  if (bestLast === -1) {
    // Nothing works. Report how far they can actually get, which is the part
    // the driver can act on.
    const reachable = candidates.filter((_, i) => Number.isFinite(cost[i]));

    const furthest = reachable.reduce(
      (max, c) => Math.max(max, c.alongMiles),
      startRange,
    );
    const nextNeeded = candidates.find((c) => c.alongMiles > furthest);

    return {
      feasible: false,
      reachableToMiles: furthest,
      shortfallMiles: (nextNeeded?.alongMiles ?? totalMiles) - furthest - fullRange,
      reason:
        pinnedIndexes.length > 0
          ? "Your chosen stop doesn't work on this route — it's out of range, or the leg after it is too long. Undo it to let Guzzler pick."
          : reachable.length === 0
            ? 'No station on this route is reachable on the fuel you have.'
            : 'There is a stretch of this route longer than a full tank.',
    };
  }

  // Walk the chain back to the start.
  const order: number[] = [];
  for (let at = bestLast; at !== -1; at = previous[at]) order.unshift(at);

  const stops: PlannedStop[] = order.map((index) => {
    const c = candidates[index];
    const price = priceFor(c.station, grade)!;
    const miles = legMiles[index];

    // Range available for this leg: the full tank, except the first leg which
    // runs on whatever was already aboard.
    const available = index === order[0] && previous[index] === -1 ? startRange : fullRange;

    // Bought here = what it takes to fill from whatever is left on arrival.
    //
    // Charging only for the leg just driven is right for every stop after the
    // first, because you leave each one full. It is badly wrong for the first:
    // a driver who sets off on a quarter tank and stops two miles later buys a
    // whole tank, not two miles' worth. That mistake priced a 176-mile trip at
    // four cents.
    const units = (fullRange - (available - miles)) / vehicle.efficiency;

    return {
      station: c.station,
      alongMiles: c.alongMiles,
      detourMiles: c.detourMiles,
      pricePerGallon: price,
      units,
      fuelCost: units * price,
      arriveWithMiles: Math.max(0, available - miles),
      requiresApproval: c.detourMiles > ON_THE_WAY_DETOUR_MILES,
    };
  });

  const lastStop = candidates[bestLast];
  return {
    feasible: true,
    stops,
    fuelCost: stops.reduce((sum, s) => sum + s.fuelCost, 0),
    totalDetourMiles: stops.reduce((sum, s) => sum + s.detourMiles, 0),
    arriveWithMiles: Math.max(0, fullRange - (totalMiles - lastStop.alongMiles)),
  };
}

export interface StopAlternative {
  station: Station;
  alongMiles: number;
  detourMiles: number;
  pricePerGallon: number;
  /**
   * False when this stop is further along than the fuel aboard at the previous
   * stop can carry the driver. Still listed — "you'd never make it" is
   * information — but never presented as a choice they can just take.
   */
  reachable: boolean;
  /** True for the stop currently in the plan. */
  isCurrent: boolean;
}

export interface StopAlternativesOptions {
  plan: FeasibleTripPlan;
  /** Which stop in the plan is being reconsidered. */
  stopIndex: number;
  corridor: CorridorStation[];
  route: Route;
  vehicle: Vehicle;
  grade: FuelGrade;
  excludedStationIds?: readonly string[];
}

/**
 * The other places the driver could stop instead of the one Guzzler picked.
 *
 * Scoped to the leg the stop sits in — between the stop before it and the one
 * after — because that is the window where a swap is even meaningful. Offering
 * every station on a 500-mile route would be a list, not a choice.
 *
 * This deliberately does not re-run the search per candidate. Picking one pins
 * it and the planner re-plans for real; `reachable` here is the cheap check
 * that catches the obviously impossible before the driver taps it.
 */
export function stopAlternatives({
  plan,
  stopIndex,
  corridor,
  route,
  vehicle,
  grade,
  excludedStationIds = [],
}: StopAlternativesOptions): StopAlternative[] {
  const current = plan.stops[stopIndex];
  if (!current) return [];

  const excluded = new Set(excludedStationIds);
  const previous = plan.stops[stopIndex - 1];
  const next = plan.stops[stopIndex + 1];

  // The window this stop lives in: after the previous fill, before the next.
  const from = previous?.alongMiles ?? 0;
  const to = next?.alongMiles ?? route.distanceMiles;

  const reserveMiles = vehicle.capacity * RESERVE_FRACTION * vehicle.efficiency;
  const fullRange = Math.max(0, vehicle.capacity * vehicle.efficiency - reserveMiles);
  const startRange = Math.max(
    0,
    vehicle.capacity * Math.min(1, Math.max(0, vehicle.level)) * vehicle.efficiency - reserveMiles,
  );
  // Fuel aboard entering this leg: a full tank, unless this is the first stop.
  const available = previous ? fullRange : startRange;

  return corridor
    .filter((c) => c.alongMiles > from && c.alongMiles < to)
    .filter((c) => !excluded.has(c.station.id))
    .map((c) => {
      const price = priceFor(c.station, grade);
      if (price === undefined) return undefined;
      return {
        station: c.station,
        alongMiles: c.alongMiles,
        detourMiles: c.detourMiles,
        pricePerGallon: price,
        reachable: c.alongMiles - from + c.detourMiles <= available,
        isCurrent: c.station.id === current.station.id,
      };
    })
    .filter((a): a is StopAlternative => a !== undefined)
    .sort((a, b) => {
      // Reachable first, then cheapest — the two things a driver is deciding on.
      if (a.reachable !== b.reachable) return a.reachable ? -1 : 1;
      return a.pricePerGallon - b.pricePerGallon;
    });
}
