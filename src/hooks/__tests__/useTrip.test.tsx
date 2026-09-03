import { act, create, type ReactTestRenderer } from 'react-test-renderer';
import { useTrip, type TripState, type UseTripOptions } from '../useTrip';
import type { FeasibleTripPlan } from '../../lib/tripPlanner';
import type { Vehicle } from '../../types';

// Feeds and providers are module-level singletons, so they are stubbed here
// rather than injected — this test is about the hook's wiring, not their data.
jest.mock('../../data/priceFeed', () => ({ activeFeed: { name: 'test' } }));

jest.mock('../../data/routeProvider', () => {
  const MPD = 69.047;
  const points = Array.from({ length: 41 }, (_, i) => ({
    latitude: 33 + (300 * (i / 40)) / MPD,
    longitude: -84,
  }));
  return {
    activeRouteProvider: {
      name: 'test',
      getRoute: async () => ({
        points,
        distanceMiles: 300,
        durationMinutes: 300,
        destinationName: 'North',
        destination: points[points.length - 1],
      }),
    },
  };
});

// Stations spread along the route so the planner has real choices.
jest.mock('../../data/routeStations', () => {
  const MPD = 69.047;
  return {
    fetchStationsAlongRoute: async () =>
      [40, 90, 140, 190, 240].map((miles) => ({
        id: `s${miles}`,
        name: `s${miles}`,
        brand: 'Shell',
        address: '',
        coordinate: { latitude: 33 + miles / MPD, longitude: -84 },
        prices: {
          regular: { grade: 'regular', price: 3, reportedAt: '', source: 'feed' },
          diesel: { grade: 'diesel', price: 4, reportedAt: '', source: 'feed' },
        },
        amenities: [],
        ratings: { reviewCount: 0 },
      })),
  };
});

const car = (overrides: Partial<Vehicle> = {}): Vehicle => ({
  label: 'v',
  fuelType: 'gas',
  capacity: 12,
  efficiency: 25,
  level: 1,
  ...overrides,
});

/** Renders the hook and exposes its latest value. */
function mountTrip(options: UseTripOptions) {
  const box: { current: TripState | undefined; props: UseTripOptions } = {
    current: undefined,
    props: options,
  };
  function Probe(props: UseTripOptions) {
    box.current = useTrip(props);
    return null;
  }
  let renderer!: ReactTestRenderer;
  act(() => {
    renderer = create(<Probe {...options} />);
  });
  return {
    get state() {
      return box.current!;
    },
    async update(next: Partial<UseTripOptions>) {
      box.props = { ...box.props, ...next };
      await act(async () => {
        renderer.update(<Probe {...box.props} />);
      });
    },
    async settle() {
      await act(async () => {
        await Promise.resolve();
      });
    },
  };
}

const origin = { latitude: 33, longitude: -84 };

describe('useTrip re-plans when its inputs change', () => {
  it('reacts to the fuel level dropping', async () => {
    // The bug: the plan was computed once and never again, so a driver who
    // changed their fuel level kept a plan built for the tank they no longer
    // had — the one number a fuel app must not be stale about.
    const harness = mountTrip({ origin, vehicle: car({ level: 1 }), grade: 'regular' });

    await act(async () => {
      await harness.state.start('north');
    });

    const full = harness.state.plan as FeasibleTripPlan;
    expect(full.feasible).toBe(true);
    const stopsWhenFull = full.stops.length;

    await harness.update({ vehicle: car({ level: 0.5 }) });

    const low = harness.state.plan as FeasibleTripPlan;
    expect(low.feasible).toBe(true);
    expect(low.stops.length).toBeGreaterThanOrEqual(stopsWhenFull);
    // Arriving at the same stop with a half-empty tank means buying more fuel
    // there, so the trip costs more. Under the old wiring both numbers were
    // identical, because the plan was never recomputed at all.
    expect(low.fuelCost).toBeGreaterThan(full.fuelCost);
    expect(low.stops[0].units).toBeGreaterThan(full.stops[0].units);

    // And down where nothing on the route is reachable, it says so rather
    // than leaving the old plan standing.
    await harness.update({ vehicle: car({ level: 0.1 }) });
    expect(harness.state.plan?.feasible).toBe(false);
  });

  it('reacts to a fuel grade change', async () => {
    const harness = mountTrip({ origin, vehicle: car(), grade: 'regular' });
    await act(async () => {
      await harness.state.start('north');
    });

    const regular = harness.state.plan as FeasibleTripPlan;
    await harness.update({ grade: 'diesel' });
    const diesel = harness.state.plan as FeasibleTripPlan;

    expect(diesel.feasible).toBe(true);
    // Diesel is a dollar dearer in the fixture, so the same trip costs more.
    expect(diesel.fuelCost).toBeGreaterThan(regular.fuelCost);
  });

  it('keeps the driver\'s rejections when re-planning for a new tank', async () => {
    const harness = mountTrip({ origin, vehicle: car(), grade: 'regular' });
    await act(async () => {
      await harness.state.start('north');
    });

    const first = (harness.state.plan as FeasibleTripPlan).stops[0].station;
    await act(async () => {
      harness.state.reject(first);
    });
    await harness.settle();

    expect(harness.state.rejected.map((s) => s.id)).toContain(first.id);

    await harness.update({ vehicle: car({ level: 0.5 }) });

    // A no stays a no across a re-plan: rejections are decisions about
    // stations, not about the tank.
    expect(harness.state.rejected.map((s) => s.id)).toContain(first.id);
    const after = harness.state.plan as FeasibleTripPlan;
    if (after.feasible) {
      expect(after.stops.map((s) => s.station.id)).not.toContain(first.id);
    }
  });
});
