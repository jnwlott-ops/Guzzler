import { drivingDistanceMiles } from './range';
import type { LatLng } from '../types';

/**
 * The minimum a place needs for approach detection. Deliberately narrower than
 * `Station` so a saved favorite — which carries no live prices — works here
 * without being inflated into a full station.
 */
export interface ApproachablePlace {
  id: string;
  name: string;
  coordinate: LatLng;
}

/**
 * Tells a driver they're coming up on a place they've saved, while there's
 * still time to act on it.
 *
 * The point is lead time. An alert that fires as you pass the exit is worse
 * than no alert, so the trigger distance is measured in "minutes of warning at
 * highway speed" rather than a flat radius.
 */

/** Miles of warning before a favorite. About two minutes at 65mph. */
export const APPROACH_MILES = 2.2;

/**
 * How far past the trigger a driver must get before the same favorite can
 * alert again.
 *
 * Without this gap, sitting at a light near the boundary flaps the alert on and
 * off as GPS noise pushes distance back and forth across the line. Clearing at
 * a longer distance than triggering means an alert ends only once you've
 * genuinely left.
 */
export const CLEAR_MILES = 3.5;

export interface ApproachAlert<T extends ApproachablePlace = ApproachablePlace> {
  place: T;
  /** Estimated driving miles at the moment the alert fired. */
  distance: number;
}

/**
 * The set of favorites currently being approached.
 *
 * Pure: takes the previously-alerting ids and returns the new set, so the
 * caller owns the state and this stays trivially testable.
 */
export function updateApproaches<T extends ApproachablePlace>(
  origin: LatLng | undefined,
  favorites: readonly T[],
  previouslyAlerting: readonly string[],
): { alerts: ApproachAlert<T>[]; alertingIds: string[] } {
  if (!origin) return { alerts: [], alertingIds: [] };

  const wasAlerting = new Set(previouslyAlerting);
  const alerts: ApproachAlert<T>[] = [];
  const alertingIds: string[] = [];

  for (const place of favorites) {
    const distance = drivingDistanceMiles(origin, place.coordinate);

    if (wasAlerting.has(place.id)) {
      // Already alerting: keep it up until the driver is clearly past.
      if (distance <= CLEAR_MILES) {
        alertingIds.push(place.id);
        alerts.push({ place, distance });
      }
      continue;
    }

    if (distance <= APPROACH_MILES) {
      alertingIds.push(place.id);
      alerts.push({ place, distance });
    }
  }

  // Nearest first — if two favorites are coming up, the closer one is the one
  // the driver has to decide about.
  alerts.sort((a, b) => a.distance - b.distance);
  return { alerts, alertingIds };
}
