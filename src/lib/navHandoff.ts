import type { LatLng } from '../types';

/**
 * Handing a destination to whichever nav app the driver actually uses.
 *
 * Guzzler plans; the driver's own nav executes. That split is deliberate —
 * turn-by-turn is solved, free, and already has their muscle memory — but it
 * means every stop we choose has to survive the trip through a URL.
 *
 * The three apps disagree sharply about how much of a plan they'll accept, and
 * the limits are low enough to shape the product. They're encoded here so
 * nobody rediscovers Waze's single-stop cap the hard way.
 */

export type NavApp = 'google' | 'apple' | 'waze';

export interface NavAppInfo {
  id: NavApp;
  label: string;
  /**
   * Intermediate stops the app accepts in a link, beyond the destination.
   *
   * Google documents up to 9, but only ~3 when the link opens on mobile — and
   * mobile is the whole use case, so 3 is the number that matters. Waze takes
   * exactly one. Apple Maps takes none: `saddr`/`daddr` only.
   */
  maxWaypoints: number;
}

export const NAV_APPS: Record<NavApp, NavAppInfo> = {
  google: { id: 'google', label: 'Google Maps', maxWaypoints: 3 },
  waze: { id: 'waze', label: 'Waze', maxWaypoints: 1 },
  apple: { id: 'apple', label: 'Apple Maps', maxWaypoints: 0 },
};

/** The lowest common denominator across every nav app: one stop at a time. */
export const UNIVERSAL_MAX_WAYPOINTS = 0;

export interface HandoffRequest {
  /** Where the driver is going on this leg. */
  destination: LatLng;
  /** Human-readable destination, used where the app supports a label. */
  label?: string;
  /**
   * Stops to pass through on the way. Silently truncated to what the target
   * app accepts — a link that fails to open is worse than a shorter plan.
   */
  waypoints?: LatLng[];
}

export interface HandoffResult {
  url: string;
  /** Stops that did not fit and must be relayed later, in order. */
  dropped: LatLng[];
}

function coord(point: LatLng): string {
  // Six decimals is about 10cm — far more than a nav app needs, and short
  // enough to keep URLs well under any length limit.
  return `${point.latitude.toFixed(6)},${point.longitude.toFixed(6)}`;
}

/**
 * Builds a directions link for one nav app, truncating the plan to fit.
 *
 * Returns the stops that didn't fit rather than dropping them silently, so the
 * caller can relay them at the next leg instead of losing them.
 */
export function buildDirectionsUrl(app: NavApp, request: HandoffRequest): HandoffResult {
  const info = NAV_APPS[app];
  const requested = request.waypoints ?? [];

  const carried = requested.slice(0, info.maxWaypoints);
  const dropped = requested.slice(info.maxWaypoints);

  const destination = coord(request.destination);

  switch (app) {
    case 'google': {
      const params = new URLSearchParams({
        api: '1',
        destination,
        travelmode: 'driving',
      });
      // Pipe-separated, per the Maps URLs spec. URLSearchParams encodes the
      // pipe, which Google accepts.
      if (carried.length > 0) {
        params.set('waypoints', carried.map(coord).join('|'));
      }
      return { url: `https://www.google.com/maps/dir/?${params.toString()}`, dropped };
    }

    case 'waze': {
      // Waze's deep link takes a single destination. Its one intermediate stop
      // can't be set from a URL, so everything but the destination is relayed.
      const params = new URLSearchParams({ ll: destination, navigate: 'yes' });
      return { url: `https://waze.com/ul?${params.toString()}`, dropped: requested };
    }

    case 'apple': {
      const params = new URLSearchParams({ daddr: destination, dirflg: 'd' });
      if (request.label) params.set('q', request.label);
      return { url: `https://maps.apple.com/?${params.toString()}`, dropped: requested };
    }
  }
}

/**
 * True when the whole plan fits in one handoff to this app.
 *
 * Almost always false for a multi-stop trip, which is why the relay exists.
 */
export function fitsInOneHandoff(app: NavApp, stopCount: number): boolean {
  // One destination plus however many intermediate stops the app allows.
  return stopCount <= NAV_APPS[app].maxWaypoints + 1;
}
