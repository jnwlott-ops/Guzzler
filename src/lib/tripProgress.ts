import { drivingDistanceMiles } from './range';
import type { PlannedStop } from './tripPlanner';
import type { LatLng } from '../types';

/**
 * Where the driver is in a plan they're executing in someone else's nav app.
 *
 * We can't see their navigation, so progress is inferred from position alone:
 * arriving near a planned stop means they took it, and leaving again means
 * it's time to hand off the next one. Crude, but it needs no integration with
 * an app we don't control.
 */

/** Within this distance of a stop, treat the driver as having arrived. */
export const ARRIVAL_MILES = 0.3;

/**
 * Past this distance after arriving, treat the stop as done.
 *
 * Wider than arrival for the same reason approach alerts use two thresholds:
 * a single radius flaps between arrived and departed while the driver sits at
 * the pump with GPS drifting.
 */
export const DEPARTURE_MILES = 0.8;

export type LegPhase =
  /** Driving toward the current stop. */
  | 'enroute'
  /** Parked at it. */
  | 'arrived'
  /** Pulled away — time to hand off the next leg. */
  | 'departed';

export interface TripProgress {
  /** Index into the plan's stops, or the length once every stop is done. */
  stopIndex: number;
  phase: LegPhase;
  /** The stop being driven to, if any remain. */
  currentStop: PlannedStop | undefined;
  /** The one after that, for "next up" copy. */
  nextStop: PlannedStop | undefined;
  /** Estimated driving miles to the current stop. */
  milesToCurrent: number | undefined;
  /** True once every planned stop has been visited. */
  complete: boolean;
}

export interface ProgressInput {
  stops: PlannedStop[];
  origin: LatLng | undefined;
  /** Progress from the previous tick, so arrival/departure can be sequenced. */
  previous?: Pick<TripProgress, 'stopIndex' | 'phase'>;
}

/**
 * Advances trip progress from the driver's current position.
 *
 * Pure, and takes its own previous output — the caller holds the state, and
 * every transition is directly testable without a device.
 */
export function advanceProgress({ stops, origin, previous }: ProgressInput): TripProgress {
  const startIndex = previous?.stopIndex ?? 0;
  const startPhase = previous?.phase ?? 'enroute';

  const done = (index: number): TripProgress => ({
    stopIndex: index,
    phase: 'departed',
    currentStop: undefined,
    nextStop: undefined,
    milesToCurrent: undefined,
    complete: true,
  });

  if (stops.length === 0) return done(0);
  if (startIndex >= stops.length) return done(stops.length);

  const currentStop = stops[startIndex];

  // Without a position we can't infer anything — hold the previous state
  // rather than guessing the driver has moved.
  if (!origin) {
    return {
      stopIndex: startIndex,
      phase: startPhase,
      currentStop,
      nextStop: stops[startIndex + 1],
      milesToCurrent: undefined,
      complete: false,
    };
  }

  const distance = drivingDistanceMiles(origin, currentStop.station.coordinate);

  // Departed: they'd arrived, and have now pulled well clear. Advance.
  if (startPhase === 'arrived' && distance > DEPARTURE_MILES) {
    const nextIndex = startIndex + 1;
    if (nextIndex >= stops.length) return done(stops.length);

    return {
      stopIndex: nextIndex,
      phase: 'enroute',
      currentStop: stops[nextIndex],
      nextStop: stops[nextIndex + 1],
      milesToCurrent: drivingDistanceMiles(origin, stops[nextIndex].station.coordinate),
      complete: false,
    };
  }

  // Arrived: close enough to the stop to count as taken.
  const phase: LegPhase =
    startPhase === 'arrived' || distance <= ARRIVAL_MILES ? 'arrived' : 'enroute';

  return {
    stopIndex: startIndex,
    phase,
    currentStop,
    nextStop: stops[startIndex + 1],
    milesToCurrent: distance,
    complete: false,
  };
}
