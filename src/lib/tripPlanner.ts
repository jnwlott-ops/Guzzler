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

/** Rating for a stop, damped by how many people have actually rated it. */
function effectiveRating(station: Station): number | undefined {
  const { overall, restroom, reviewCount } = station.ratings;
  const base = overall ?? restroom;
  if (base === undefined || reviewCount === 0) return undefined;

  const confidence = Math.min(reviewCount, CONFIDENCE_REVIEWS) / CONFIDENCE_REVIEWS;
  // Pull toward neutral when we barely have any opinions.
  return 3 + (base - 3) * confidence;
}

export interface PlanTripOptions {
  corridor: CorridorStation[];
  route: Route;
  vehicle: Vehicle;
  grade: FuelGrade;
  /** How strongly ratings override price. Defaults to RATING_DOLLARS. */
  ratingDollars?: number;
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
}: PlanTripOptions): TripPlan {
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

  // Only stations that actually sell the grade can be planned around.
  const candidates = corridor.filter((c) => priceFor(c.station, grade) !== undefined);

  if (candidates.length === 0) {
    return {
      feasible: false,
      reachableToMiles: startRange,
      shortfallMiles: totalMiles - startRange,
      reason: 'No stations along this route sell that grade.',
    };
  }

  const n = candidates.length;
  const cost = new Array<number>(n).fill(Infinity);
  const previous = new Array<number>(n).fill(-1);
  const legMiles = new Array<number>(n).fill(0);

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
        reachable.length === 0
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
    const units = miles / vehicle.efficiency;

    // Range available for this leg: the full tank, except the first leg which
    // runs on whatever was already aboard.
    const available = index === order[0] && previous[index] === -1 ? startRange : fullRange;

    return {
      station: c.station,
      alongMiles: c.alongMiles,
      detourMiles: c.detourMiles,
      pricePerGallon: price,
      units,
      fuelCost: units * price,
      arriveWithMiles: Math.max(0, available - miles),
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
