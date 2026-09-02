import { advanceProgress, ARRIVAL_MILES, DEPARTURE_MILES } from '../tripProgress';
import type { PlannedStop } from '../tripPlanner';
import type { LatLng, Station } from '../../types';

const MPD = 69.047;
const CIRCUITY = 1.25;

const origin: LatLng = { latitude: 30, longitude: -97 };

/** A point at a given *driving* distance due north of the origin. */
function at(drivingMiles: number): LatLng {
  return { latitude: 30 + drivingMiles / CIRCUITY / MPD, longitude: -97 };
}

function stop(id: string, drivingMiles: number): PlannedStop {
  const station: Station = {
    id,
    name: id,
    brand: id,
    address: '',
    coordinate: at(drivingMiles),
    prices: { regular: { grade: 'regular', price: 3, reportedAt: '', source: 'feed' } },
    amenities: [],
    ratings: { reviewCount: 0 },
  };

  return {
    station,
    alongMiles: drivingMiles,
    detourMiles: 0,
    pricePerGallon: 3,
    units: 10,
    fuelCost: 30,
    arriveWithMiles: 100,
    requiresApproval: false,
  };
}

const plan = [stop('first', 100), stop('second', 300), stop('third', 500)];

describe('advanceProgress', () => {
  it('starts en route to the first stop', () => {
    const progress = advanceProgress({ stops: plan, origin });

    expect(progress.stopIndex).toBe(0);
    expect(progress.phase).toBe('enroute');
    expect(progress.currentStop!.station.id).toBe('first');
    expect(progress.nextStop!.station.id).toBe('second');
    expect(progress.complete).toBe(false);
  });

  it('reports an empty plan as complete', () => {
    const progress = advanceProgress({ stops: [], origin });
    expect(progress.complete).toBe(true);
    expect(progress.currentStop).toBeUndefined();
  });

  it('holds its previous state without a position', () => {
    // Losing GPS must not be read as the driver having moved.
    const progress = advanceProgress({
      stops: plan,
      origin: undefined,
      previous: { stopIndex: 1, phase: 'arrived' },
    });

    expect(progress.stopIndex).toBe(1);
    expect(progress.phase).toBe('arrived');
    expect(progress.milesToCurrent).toBeUndefined();
  });

  it('marks arrival on reaching the stop', () => {
    const progress = advanceProgress({
      stops: plan,
      origin: at(100 - ARRIVAL_MILES / 2),
      previous: { stopIndex: 0, phase: 'enroute' },
    });

    expect(progress.phase).toBe('arrived');
    expect(progress.stopIndex).toBe(0);
  });

  describe('departure hysteresis', () => {
    it('stays arrived while sitting at the pump', () => {
      // Between the arrival and departure radii. A single threshold would flap
      // between arrived and departed as GPS drifts at a standstill.
      const between = 100 + (ARRIVAL_MILES + DEPARTURE_MILES) / 2;
      const progress = advanceProgress({
        stops: plan,
        origin: at(between),
        previous: { stopIndex: 0, phase: 'arrived' },
      });

      expect(progress.phase).toBe('arrived');
      expect(progress.stopIndex).toBe(0);
    });

    it('advances to the next leg once clear of the stop', () => {
      const progress = advanceProgress({
        stops: plan,
        origin: at(100 + DEPARTURE_MILES + 1),
        previous: { stopIndex: 0, phase: 'arrived' },
      });

      expect(progress.stopIndex).toBe(1);
      expect(progress.phase).toBe('enroute');
      expect(progress.currentStop!.station.id).toBe('second');
      expect(progress.nextStop!.station.id).toBe('third');
    });

    it('clears at a wider radius than it arrives', () => {
      expect(DEPARTURE_MILES).toBeGreaterThan(ARRIVAL_MILES);
    });
  });

  it('does not advance while merely driving past a later stop', () => {
    // Distance to the *current* stop is what matters; being near a future one
    // must not skip the plan forward.
    const progress = advanceProgress({
      stops: plan,
      origin: at(300),
      previous: { stopIndex: 0, phase: 'enroute' },
    });

    expect(progress.stopIndex).toBe(0);
    expect(progress.phase).toBe('enroute');
  });

  it('completes after departing the final stop', () => {
    const progress = advanceProgress({
      stops: plan,
      origin: at(500 + DEPARTURE_MILES + 1),
      previous: { stopIndex: 2, phase: 'arrived' },
    });

    expect(progress.complete).toBe(true);
    expect(progress.currentStop).toBeUndefined();
    expect(progress.nextStop).toBeUndefined();
  });

  it('stays complete once past the end', () => {
    const progress = advanceProgress({
      stops: plan,
      origin,
      previous: { stopIndex: 3, phase: 'departed' },
    });
    expect(progress.complete).toBe(true);
  });

  it('walks a whole trip end to end', () => {
    let state = advanceProgress({ stops: plan, origin });
    const visited: string[] = [];

    for (const miles of [100, 101, 300, 301, 500, 501]) {
      state = advanceProgress({ stops: plan, origin: at(miles), previous: state });
      if (state.phase === 'arrived' && state.currentStop) {
        const id = state.currentStop.station.id;
        if (!visited.includes(id)) visited.push(id);
      }
    }

    expect(visited).toEqual(['first', 'second', 'third']);
    expect(state.complete).toBe(true);
  });
});
