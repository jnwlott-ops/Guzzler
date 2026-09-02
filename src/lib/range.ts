import type { LatLng, Vehicle } from '../types';

/**
 * How far the driver can actually get, and which stations are inside that.
 *
 * The honest caveat, stated once here because the whole feature depends on it:
 * a circle drawn on a map is not a range map. Real reachable area follows
 * roads, so it is a lumpy isochrone, not a disc — mountains, rivers, and
 * one-way interstates all dent it. We correct for that with a circuity factor
 * (below) and label the rings as estimates, but a driver planning a desert
 * crossing on our circle would be trusting it further than it deserves.
 *
 * Replacing this with a real isochrone (Mapbox, HERE, Valhalla) is the right
 * fix and is tracked in docs/RANGE.md.
 */

/**
 * Road distance divided by straight-line distance, averaged over US road
 * networks. Roughly 1.2-1.4 depending on terrain and grid density; 1.25 is a
 * middle estimate that errs toward showing a smaller circle than the optimistic
 * crow-flies one.
 */
const CIRCUITY = 1.25;

/**
 * Fraction of the tank we treat as untouchable reserve. Most drivers start
 * looking for fuel around an eighth of a tank, and "you can technically reach
 * this on fumes" is not advice worth giving.
 */
const RESERVE_FRACTION = 0.125;

const EARTH_RADIUS_MILES = 3958.8;

export interface RangeEstimate {
  /** Miles the vehicle can travel on what's in the tank right now. */
  totalMiles: number;
  /** Miles before dipping into reserve. The number to actually plan on. */
  comfortableMiles: number;
  /** Straight-line radius matching totalMiles, corrected for road circuity. */
  maxRadiusMiles: number;
  /** Straight-line radius matching comfortableMiles. */
  comfortableRadiusMiles: number;
}

/** Whether a station is worth driving to on the fuel currently aboard. */
export type Reachability = 'comfortable' | 'reserve' | 'unreachable';

/**
 * Works out how far the vehicle can go on its current level.
 *
 * Returns undefined rather than zero for an unusable profile, so callers can
 * distinguish "no vehicle set up" from "genuinely empty".
 */
export function estimateRange(vehicle: Vehicle | undefined): RangeEstimate | undefined {
  if (!vehicle) return undefined;
  if (!(vehicle.capacity > 0) || !(vehicle.efficiency > 0)) return undefined;

  const level = Math.min(1, Math.max(0, vehicle.level));
  const totalMiles = vehicle.capacity * level * vehicle.efficiency;

  // Reserve is measured against the full tank, not the current level: an eighth
  // of a tank is the same number of gallons whether you're full or nearly out.
  const reserveMiles = vehicle.capacity * RESERVE_FRACTION * vehicle.efficiency;
  const comfortableMiles = Math.max(0, totalMiles - reserveMiles);

  return {
    totalMiles,
    comfortableMiles,
    maxRadiusMiles: totalMiles / CIRCUITY,
    comfortableRadiusMiles: comfortableMiles / CIRCUITY,
  };
}

/** Great-circle distance in miles. */
export function distanceMiles(from: LatLng, to: LatLng): number {
  const toRad = (deg: number) => (deg * Math.PI) / 180;

  const dLat = toRad(to.latitude - from.latitude);
  const dLng = toRad(to.longitude - from.longitude);
  const lat1 = toRad(from.latitude);
  const lat2 = toRad(to.latitude);

  const a =
    Math.sin(dLat / 2) ** 2 + Math.sin(dLng / 2) ** 2 * Math.cos(lat1) * Math.cos(lat2);

  return 2 * EARTH_RADIUS_MILES * Math.asin(Math.min(1, Math.sqrt(a)));
}

/**
 * Estimated *driving* distance to a point, by inflating the straight-line
 * distance by the circuity factor. Crude, but consistently crude, and it errs
 * toward telling the driver something is further away than it is.
 */
export function drivingDistanceMiles(from: LatLng, to: LatLng): number {
  return distanceMiles(from, to) * CIRCUITY;
}

/** Classifies a station against what's in the tank. */
export function reachabilityOf(
  distance: number,
  range: RangeEstimate | undefined,
): Reachability {
  // With no vehicle set up we can't judge, so treat everything as reachable
  // rather than greying out a map the driver never asked us to filter.
  if (!range) return 'comfortable';
  if (distance <= range.comfortableMiles) return 'comfortable';
  if (distance <= range.totalMiles) return 'reserve';
  return 'unreachable';
}

/** Miles → metres, for react-native-maps' Circle radius. */
export function milesToMeters(miles: number): number {
  return miles * 1609.344;
}

export function formatMiles(miles: number): string {
  return miles >= 100 ? `${Math.round(miles)} mi` : `${miles.toFixed(miles < 10 ? 1 : 0)} mi`;
}

/** "3/4 tank", "Full", "Empty" — friendlier than a raw percentage. */
export function formatLevel(level: number): string {
  if (level >= 0.99) return 'Full';
  if (level <= 0.01) return 'Empty';

  const eighths = Math.round(level * 8);
  const fractions: Record<number, string> = {
    1: '1/8',
    2: '1/4',
    3: '3/8',
    4: '1/2',
    5: '5/8',
    6: '3/4',
    7: '7/8',
  };
  return `${fractions[eighths] ?? `${Math.round(level * 100)}%`} tank`;
}
