import {
  APPROACH_MILES,
  CLEAR_MILES,
  updateApproaches,
  type ApproachablePlace,
} from '../approach';
import type { LatLng } from '../../types';

/** Miles per degree of latitude, matching lib/route.ts. */
const MPD = 69.047;

/** Circuity factor applied by drivingDistanceMiles. */
const CIRCUITY = 1.25;

const origin: LatLng = { latitude: 30, longitude: -97 };

/**
 * A place at a given *driving* distance due north, undoing the circuity factor
 * so tests read in the units the thresholds are expressed in.
 */
function placeAt(id: string, drivingMiles: number): ApproachablePlace {
  return {
    id,
    name: id,
    coordinate: { latitude: 30 + drivingMiles / CIRCUITY / MPD, longitude: -97 },
  };
}

describe('updateApproaches', () => {
  it('says nothing without a location', () => {
    expect(updateApproaches(undefined, [placeAt('a', 1)], [])).toEqual({
      alerts: [],
      alertingIds: [],
    });
  });

  it('stays quiet for a favorite that is still far off', () => {
    const result = updateApproaches(origin, [placeAt('far', 20)], []);
    expect(result.alerts).toHaveLength(0);
    expect(result.alertingIds).toEqual([]);
  });

  it('fires once inside the approach distance', () => {
    const result = updateApproaches(origin, [placeAt('near', APPROACH_MILES - 0.3)], []);
    expect(result.alerts.map((a) => a.place.id)).toEqual(['near']);
    expect(result.alertingIds).toEqual(['near']);
    expect(result.alerts[0].distance).toBeLessThanOrEqual(APPROACH_MILES);
  });

  it('gives enough warning to actually act on', () => {
    // Two miles is roughly two minutes at highway speed. An alert that fires as
    // you pass the exit is worse than no alert.
    expect(APPROACH_MILES).toBeGreaterThan(1.5);
  });

  describe('hysteresis', () => {
    // Without a gap between trigger and clear, GPS noise near the boundary
    // flaps the alert on and off while the driver sits at a light.
    it('clears at a longer distance than it triggers', () => {
      expect(CLEAR_MILES).toBeGreaterThan(APPROACH_MILES);
    });

    it('keeps alerting in the gap between trigger and clear', () => {
      const between = (APPROACH_MILES + CLEAR_MILES) / 2;

      // Not yet alerting at this distance: too far to trigger.
      expect(updateApproaches(origin, [placeAt('p', between)], []).alerts).toHaveLength(0);

      // Already alerting: stays up rather than flapping off.
      const held = updateApproaches(origin, [placeAt('p', between)], ['p']);
      expect(held.alerts.map((a) => a.place.id)).toEqual(['p']);
      expect(held.alertingIds).toEqual(['p']);
    });

    it('clears once the driver is genuinely past', () => {
      const result = updateApproaches(origin, [placeAt('p', CLEAR_MILES + 1)], ['p']);
      expect(result.alerts).toHaveLength(0);
      expect(result.alertingIds).toEqual([]);
    });
  });

  it('orders several approaching favorites nearest first', () => {
    const result = updateApproaches(
      origin,
      [placeAt('further', APPROACH_MILES - 0.2), placeAt('closer', 0.4)],
      [],
    );
    expect(result.alerts.map((a) => a.place.id)).toEqual(['closer', 'further']);
  });

  it('tracks each favorite independently', () => {
    const result = updateApproaches(
      origin,
      [placeAt('close', 1), placeAt('far', 40)],
      ['far'],
    );
    expect(result.alertingIds).toEqual(['close']);
    expect(result.alerts.map((a) => a.place.id)).toEqual(['close']);
  });

  it('handles an empty favorites list', () => {
    expect(updateApproaches(origin, [], [])).toEqual({ alerts: [], alertingIds: [] });
  });
});
