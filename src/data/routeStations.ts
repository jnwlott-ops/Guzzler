import { cumulativeDistances } from '../lib/route';
import type { LatLng, Region, Route, Station } from '../types';
import type { PriceFeed } from './priceFeed';

const MILES_PER_DEG_LAT = 69.047;

/**
 * How far apart to sample the route when asking the feed for stations.
 *
 * Must stay below the along-route reach of one window, or stations fall into
 * the gap between two queries and the planner never sees them.
 */
const SAMPLE_EVERY_MILES = 6;

/**
 * Half-width of each query window.
 *
 * Comfortably wider than the planner's 5-mile corridor and no wider: window
 * area is what the feed has to produce and what the corridor filter then has
 * to walk, and everything past the corridor edge is generated only to be
 * thrown away.
 */
const WINDOW_MILES = 8;

/**
 * Ceiling on requests for one route. A coast-to-coast trip gets sampled more
 * coarsely rather than firing hundreds of requests — that costs candidates,
 * never correctness, since the planner only ever works with what it is given.
 */
const MAX_WINDOWS = 120;

/**
 * How many windows to have in flight at once.
 *
 * Wall time is dominated by round trips, not bytes: a long route is 100+
 * windows, so six at a time meant twenty sequential waits before the driver
 * saw a plan.
 */
const CONCURRENCY = 12;

/** Points spaced along the route, always including its start and end. */
function sampleRoute(route: Route, everyMiles: number): LatLng[] {
  const cumulative = cumulativeDistances(route);
  const total = cumulative[cumulative.length - 1] ?? 0;
  if (route.points.length === 0) return [];
  if (total === 0) return [route.points[0]];

  const samples: LatLng[] = [route.points[0]];
  let nextAt = everyMiles;
  for (let i = 1; i < route.points.length; i++) {
    if (cumulative[i] >= nextAt) {
      samples.push(route.points[i]);
      // Skip past any points bunched inside the same window.
      while (nextAt <= cumulative[i]) nextAt += everyMiles;
    }
  }
  const last = route.points[route.points.length - 1];
  if (samples[samples.length - 1] !== last) samples.push(last);
  return samples;
}

/**
 * A query window centred on `point`, clamped to what the feed will answer for.
 *
 * The clamp is the whole point. Ask for a window wider than `maxSpanDegrees`
 * and a feed is entitled to return nothing — which is exactly the failure this
 * module exists to fix, so reproducing it here would be a quiet disaster: every
 * window empty, no error, and a plan that reports no stations on the route.
 *
 * Longitude needs clamping separately from latitude. A degree of longitude is
 * only ~57 miles at Georgia's latitude, so the same width in miles is a larger
 * span in degrees, and it crosses the limit first.
 */
function windowAround(point: LatLng, halfWidthMiles: number, maxSpan?: number): Region {
  const milesPerDegLng = Math.max(
    1,
    MILES_PER_DEG_LAT * Math.cos((point.latitude * Math.PI) / 180),
  );
  const cap = maxSpan === undefined ? Infinity : maxSpan * 0.98;
  return {
    latitude: point.latitude,
    longitude: point.longitude,
    latitudeDelta: Math.min((halfWidthMiles * 2) / MILES_PER_DEG_LAT, cap),
    longitudeDelta: Math.min((halfWidthMiles * 2) / milesPerDegLng, cap),
  };
}

/** How far along the route one window actually reaches, worst case. */
function windowReachMiles(point: LatLng, halfWidthMiles: number, maxSpan?: number): number {
  const region = windowAround(point, halfWidthMiles, maxSpan);
  const milesPerDegLng = Math.max(
    1,
    MILES_PER_DEG_LAT * Math.cos((point.latitude * Math.PI) / 180),
  );
  // A route can run any direction, so the narrower axis is the one that counts.
  return Math.min(
    (region.latitudeDelta * MILES_PER_DEG_LAT) / 2,
    (region.longitudeDelta * milesPerDegLng) / 2,
  );
}

/**
 * Every station along a route, independent of where the map happens to be
 * looking.
 *
 * This exists because planning used to run on whatever the map had loaded for
 * the visible region. Zoom out to see a 176-mile trip and the feed's own
 * too-many-cells guard returns nothing, so the planner got an empty corridor
 * and reported that no station on the route sold your grade — which was not
 * true, and not something the driver could act on.
 *
 * A feed that can answer for a whole route in one call should say so with
 * `getStationsAlongRoute`. Otherwise the route is chopped into overlapping
 * windows and queried piecewise, which any region-based feed can serve.
 */
export async function fetchStationsAlongRoute(
  feed: PriceFeed,
  route: Route,
  signal?: AbortSignal,
): Promise<Station[]> {
  if (feed.getStationsAlongRoute) {
    return feed.getStationsAlongRoute(route, WINDOW_MILES, signal);
  }

  const maxSpan = feed.maxSpanDegrees;
  // Never step further than a window reaches, or stations fall through the gap.
  const reach = windowReachMiles(route.points[0], WINDOW_MILES, maxSpan);
  const step = Math.max(1, Math.min(SAMPLE_EVERY_MILES, reach * 1.6));

  let samples = sampleRoute(route, step);
  if (samples.length > MAX_WINDOWS) {
    // Thin evenly rather than truncating — a plan missing the back half of the
    // route is worse than one sampled a little more coarsely throughout.
    const stride = Math.ceil(samples.length / MAX_WINDOWS);
    samples = samples.filter((_, i) => i % stride === 0 || i === samples.length - 1);
  }

  const byId = new Map<string, Station>();
  for (let i = 0; i < samples.length; i += CONCURRENCY) {
    const batch = samples.slice(i, i + CONCURRENCY);
    const results = await Promise.all(
      batch.map((point) =>
        feed
          .getStationsInRegion(windowAround(point, WINDOW_MILES, maxSpan), signal)
          // One dead window should not lose the whole route.
          .catch(() => [] as Station[]),
      ),
    );
    for (const station of results.flat()) byId.set(station.id, station);
  }

  return [...byId.values()];
}
