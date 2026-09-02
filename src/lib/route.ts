import { distanceMiles } from './range';
import type { LatLng, Route, Station } from '../types';

/**
 * Route geometry: where a station sits relative to a route.
 *
 * Everything here works in a local flat projection (miles east/north of a
 * reference point) rather than on the sphere. Over the tens of miles that
 * matter for a corridor that error is negligible, and it makes point-to-segment
 * projection ordinary 2D algebra instead of spherical trigonometry.
 */

/** Miles per degree of latitude. Constant enough anywhere on earth. */
const MILES_PER_DEG_LAT = 69.047;

interface Point2D {
  x: number;
  y: number;
}

/** Projects lat/lng to miles east/north of `origin`. */
function toLocal(point: LatLng, origin: LatLng): Point2D {
  // Longitude degrees shrink toward the poles, so scale by cos(latitude).
  const milesPerDegLng = MILES_PER_DEG_LAT * Math.cos((origin.latitude * Math.PI) / 180);
  return {
    x: (point.longitude - origin.longitude) * milesPerDegLng,
    y: (point.latitude - origin.latitude) * MILES_PER_DEG_LAT,
  };
}

/**
 * Closest point on segment AB to P, as a fraction t along AB (clamped to the
 * segment) plus the perpendicular distance.
 */
function projectOntoSegment(p: Point2D, a: Point2D, b: Point2D): { t: number; distance: number } {
  const abx = b.x - a.x;
  const aby = b.y - a.y;
  const lengthSq = abx * abx + aby * aby;

  // Degenerate segment (duplicate points) — treat it as the single point A.
  if (lengthSq === 0) {
    return { t: 0, distance: Math.hypot(p.x - a.x, p.y - a.y) };
  }

  const rawT = ((p.x - a.x) * abx + (p.y - a.y) * aby) / lengthSq;
  const t = Math.min(1, Math.max(0, rawT));

  const closestX = a.x + t * abx;
  const closestY = a.y + t * aby;
  return { t, distance: Math.hypot(p.x - closestX, p.y - closestY) };
}

/** Cumulative distance to each point of the route, in miles. */
export function cumulativeDistances(route: Route): number[] {
  const cumulative: number[] = [0];
  for (let i = 1; i < route.points.length; i++) {
    cumulative.push(cumulative[i - 1] + distanceMiles(route.points[i - 1], route.points[i]));
  }
  return cumulative;
}

export interface RoutePosition {
  /** Miles from the route's start to the nearest point on the route. */
  alongMiles: number;
  /** Perpendicular miles from the route. */
  offsetMiles: number;
}

/**
 * Finds where a point sits relative to a route.
 *
 * Scans every segment rather than assuming monotonic approach, because routes
 * double back — a naive early exit picks the wrong lobe on a switchback or a
 * loop, and puts a station a hundred miles from where it belongs.
 */
export function positionOnRoute(
  point: LatLng,
  route: Route,
  cumulative = cumulativeDistances(route),
): RoutePosition | undefined {
  if (route.points.length === 0) return undefined;
  if (route.points.length === 1) {
    return { alongMiles: 0, offsetMiles: distanceMiles(point, route.points[0]) };
  }

  const origin = route.points[0];
  const p = toLocal(point, origin);

  let best: RoutePosition | undefined;
  for (let i = 0; i < route.points.length - 1; i++) {
    const a = toLocal(route.points[i], origin);
    const b = toLocal(route.points[i + 1], origin);
    const { t, distance } = projectOntoSegment(p, a, b);

    if (best === undefined || distance < best.offsetMiles) {
      const segmentLength = cumulative[i + 1] - cumulative[i];
      best = {
        alongMiles: cumulative[i] + t * segmentLength,
        offsetMiles: distance,
      };
    }
  }
  return best;
}

/** A station near the route, with its position along it. */
export interface CorridorStation {
  station: Station;
  alongMiles: number;
  /** Perpendicular miles from the route. */
  offsetMiles: number;
  /**
   * Extra driving the stop costs: off the route and back on again. A crude
   * doubling, but it errs toward overstating the cost of a detour, which is
   * the safe direction for a planner that might otherwise send someone
   * fifteen miles off a highway to save forty cents.
   */
  detourMiles: number;
}

/**
 * Selects the stations within `corridorMiles` of the route, ordered by how far
 * along the route they sit.
 */
export function stationsAlongRoute(
  stations: Station[],
  route: Route,
  corridorMiles = 5,
): CorridorStation[] {
  const cumulative = cumulativeDistances(route);

  const inCorridor: CorridorStation[] = [];
  for (const station of stations) {
    const position = positionOnRoute(station.coordinate, route, cumulative);
    if (!position || position.offsetMiles > corridorMiles) continue;

    inCorridor.push({
      station,
      alongMiles: position.alongMiles,
      offsetMiles: position.offsetMiles,
      detourMiles: position.offsetMiles * 2,
    });
  }

  return inCorridor.sort((a, b) => a.alongMiles - b.alongMiles);
}
