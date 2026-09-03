import type { LatLng, Route } from '../types';

/**
 * The seam between Guzzler and a directions service.
 *
 * Same shape as PriceFeed: the planner and the UI are written against this, so
 * dropping in Google Directions, Mapbox, or a self-hosted Valhalla is one class
 * and one line in `activeRouteProvider`.
 */
export interface RouteProvider {
  readonly name: string;

  /**
   * Resolves a free-text destination and returns a driving route to it.
   *
   * Geocoding lives behind this method rather than beside it because real
   * directions APIs bundle the two, and splitting them would mean two round
   * trips where providers offer one.
   */
  getRoute(origin: LatLng, destination: string, signal?: AbortSignal): Promise<Route>;

  /**
   * Destinations this provider can actually resolve, when that set is finite.
   *
   * A real geocoder resolves anything and leaves this undefined. The mock knows
   * a fixed list, and the UI offers them rather than letting someone type a
   * place it will silently invent a route to.
   */
  readonly knownDestinations?: readonly string[];
}

/** Rough centers for the cities the mock knows by name. */
const KNOWN_PLACES: Record<string, LatLng> = {
  atlanta: { latitude: 33.749, longitude: -84.388 },
  savannah: { latitude: 32.0809, longitude: -81.0912 },
  chattanooga: { latitude: 35.0456, longitude: -85.3097 },
  birmingham: { latitude: 33.5186, longitude: -86.8104 },
  charlotte: { latitude: 35.2271, longitude: -80.8431 },
  nashville: { latitude: 36.1627, longitude: -86.7816 },
  jacksonville: { latitude: 30.3322, longitude: -81.6557 },
  orlando: { latitude: 28.5383, longitude: -81.3792 },
  memphis: { latitude: 35.1495, longitude: -90.049 },
  'new orleans': { latitude: 29.9511, longitude: -90.0715 },
  austin: { latitude: 30.2672, longitude: -97.7431 },
  dallas: { latitude: 32.7767, longitude: -96.797 },
  houston: { latitude: 29.7604, longitude: -95.3698 },
  'san antonio': { latitude: 29.4241, longitude: -98.4936 },
  oklahoma: { latitude: 35.4676, longitude: -97.5164 },
  denver: { latitude: 39.7392, longitude: -104.9903 },
  phoenix: { latitude: 33.4484, longitude: -112.074 },
  albuquerque: { latitude: 35.0844, longitude: -106.6504 },
};

const MILES_PER_DEG_LAT = 69.047;

/** Same circuity factor the range math uses, so the two agree. */
const CIRCUITY = 1.25;

/**
 * A stand-in directions service.
 *
 * Draws a gently curved polyline between origin and destination — real roads
 * are neither straight nor smooth, but a curve exercises the corridor
 * projection (which must handle a route that isn't a single bearing) far better
 * than a straight line would.
 */
export class MockRouteProvider implements RouteProvider {
  readonly name = 'Demo route';

  /** Title-cased for display; matching is case-insensitive and substring-based. */
  readonly knownDestinations = Object.keys(KNOWN_PLACES)
    .map((name) => name.replace(/\b\w/g, (c) => c.toUpperCase()))
    .sort();

  async getRoute(origin: LatLng, destination: string): Promise<Route> {
    await new Promise((resolve) => setTimeout(resolve, 350));

    const query = destination.trim().toLowerCase();
    const match = Object.entries(KNOWN_PLACES).find(([name]) => query.includes(name));

    // Fail loudly on anything this mock can't resolve. It used to invent a
    // point 180 miles northeast, which meant typing a real local destination
    // silently produced a route to an empty field — indistinguishable from the
    // feature being broken.
    if (!match) {
      throw new Error(
        `Demo routing doesn't know "${destination.trim()}". Pick one of the suggested cities.`,
      );
    }

    const target: LatLng = match[1];
    const points = interpolate(origin, target);

    let straightLine = 0;
    for (let i = 1; i < points.length; i++) {
      straightLine += segmentMiles(points[i - 1], points[i]);
    }

    // Inflate to a plausible road distance, then assume interstate speeds.
    const distance = straightLine * CIRCUITY;

    return {
      points,
      distanceMiles: distance,
      durationMinutes: (distance / 62) * 60,
      destinationName: match[0].replace(/\b\w/g, (c) => c.toUpperCase()),
      destination: target,
    };
  }
}

/** Builds a curved polyline between two points. */
function interpolate(from: LatLng, to: LatLng, steps = 48): LatLng[] {
  const points: LatLng[] = [];

  for (let i = 0; i <= steps; i++) {
    const t = i / steps;

    // A single sine bow perpendicular to the straight line, peaking mid-route.
    // Amplitude scales with trip length so short hops don't look absurd.
    const bow = Math.sin(t * Math.PI) * 0.06;

    points.push({
      latitude: from.latitude + (to.latitude - from.latitude) * t + bow * (to.longitude - from.longitude) * 0.12,
      longitude: from.longitude + (to.longitude - from.longitude) * t - bow * (to.latitude - from.latitude) * 0.12,
    });
  }
  return points;
}

function segmentMiles(a: LatLng, b: LatLng): number {
  const milesPerDegLng = MILES_PER_DEG_LAT * Math.cos((a.latitude * Math.PI) / 180);
  return Math.hypot(
    (b.latitude - a.latitude) * MILES_PER_DEG_LAT,
    (b.longitude - a.longitude) * milesPerDegLng,
  );
}

/**
 * The directions service the app runs on.
 *
 * Swap for a real provider when one is chosen — see docs/ROUTING.md.
 */
export const activeRouteProvider: RouteProvider = new MockRouteProvider();
