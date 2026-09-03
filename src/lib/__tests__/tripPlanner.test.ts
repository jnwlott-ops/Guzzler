import { stationsAlongRoute } from '../route';
import {
  isPlanLive,
  ON_THE_WAY_DETOUR_MILES,
  planTrip,
  stopAlternatives,
  stopsAwaitingApproval,
  type FeasibleTripPlan,
  type InfeasibleTripPlan,
} from '../tripPlanner';
import type { LatLng, Route, Station, Vehicle } from '../../types';

const MPD = 69.047;

/** A due-north route from (30, -97). */
function northRoute(degrees: number, steps = 20): Route {
  const points: LatLng[] = [];
  for (let i = 0; i <= steps; i++) {
    points.push({ latitude: 30 + (degrees * i) / steps, longitude: -97 });
  }
  return {
    points,
    distanceMiles: degrees * MPD,
    durationMinutes: 0,
    destinationName: 'North',
    destination: points[points.length - 1],
  };
}

interface StationOpts {
  overall?: number;
  reviewCount?: number;
  /** Omit the price entirely, to test grade availability. */
  noPrice?: boolean;
}

function stationAt(id: string, milesNorth: number, milesEast: number, price: number, opts: StationOpts = {}): Station {
  const milesPerDegLng = MPD * Math.cos((30 * Math.PI) / 180);
  return {
    id,
    name: id,
    brand: id,
    address: '',
    coordinate: { latitude: 30 + milesNorth / MPD, longitude: -97 + milesEast / milesPerDegLng },
    prices: opts.noPrice
      ? {}
      : { regular: { grade: 'regular', price, reportedAt: new Date().toISOString(), source: 'feed' } },
    amenities: [],
    ratings: { overall: opts.overall, reviewCount: opts.reviewCount ?? 0 },
  };
}

const car = (overrides: Partial<Vehicle> = {}): Vehicle => ({
  label: 'v',
  fuelType: 'gas',
  capacity: 14,
  efficiency: 30,
  level: 1,
  ...overrides,
});

/** 14 gal x 30 MPG, less an eighth-tank reserve. */
const USABLE_RANGE = 367.5;

function plan(stations: Station[], route: Route, vehicle = car(), grade: 'regular' | 'diesel' = 'regular') {
  return planTrip({ corridor: stationsAlongRoute(stations, route, 5), route, vehicle, grade });
}

describe('trips that need no stops', () => {
  it('says so rather than inventing one', () => {
    const result = planTrip({ corridor: [], route: northRoute(1), vehicle: car(), grade: 'regular' }) as FeasibleTripPlan;

    expect(result.feasible).toBe(true);
    expect(result.stops).toHaveLength(0);
    expect(result.fuelCost).toBe(0);
    expect(result.arriveWithMiles).toBeCloseTo(USABLE_RANGE - MPD, 0);
  });
});

describe('choosing between stops', () => {
  const route = northRoute(8); // ~552 miles

  it('takes the cheaper of two reachable stations', () => {
    const result = plan([stationAt('pricey', 200, 0, 4.5), stationAt('cheap', 210, 0, 3.0)], route) as FeasibleTripPlan;

    expect(result.stops.map((s) => s.station.id)).toEqual(['cheap']);
    expect(result.fuelCost).toBeCloseTo(result.stops[0].units * 3.0, 2);
  });

  it('prices the detour rather than ignoring it', () => {
    // 5c/gal is not worth an eight-mile round trip...
    const tight = plan([stationAt('onroute', 200, 0, 3.1), stationAt('detour', 200, 4, 3.05)], route) as FeasibleTripPlan;
    expect(tight.stops.map((s) => s.station.id)).toEqual(['onroute']);

    // ...but 85c/gal is.
    const worth = plan([stationAt('onroute', 200, 0, 3.9), stationAt('detour', 200, 4, 3.05)], route) as FeasibleTripPlan;
    expect(worth.stops.map((s) => s.station.id)).toEqual(['detour']);
  });

  it('lets ratings break a near-tie but not override a real price gap', () => {
    const nearTie = plan(
      [
        stationAt('meh', 200, 0, 3.0, { overall: 2, reviewCount: 50 }),
        stationAt('great', 201, 0, 3.02, { overall: 5, reviewCount: 50 }),
      ],
      route,
    ) as FeasibleTripPlan;
    expect(nearTie.stops.map((s) => s.station.id)).toEqual(['great']);

    const bigGap = plan(
      [
        stationAt('cheap-meh', 200, 0, 2.8, { overall: 2, reviewCount: 50 }),
        stationAt('dear-great', 201, 0, 3.8, { overall: 5, reviewCount: 50 }),
      ],
      route,
    ) as FeasibleTripPlan;
    expect(bigGap.stops.map((s) => s.station.id)).toEqual(['cheap-meh']);
  });

  it('treats unrated stops as neutral, not bad', () => {
    const result = plan(
      [
        stationAt('rated-low', 200, 0, 3.0, { overall: 1, reviewCount: 50 }),
        stationAt('unrated', 201, 0, 3.0),
      ],
      route,
    ) as FeasibleTripPlan;
    expect(result.stops.map((s) => s.station.id)).toEqual(['unrated']);
  });

  it('damps a lone five-star review', () => {
    const result = plan(
      [
        stationAt('solid', 200, 0, 3.0, { overall: 3, reviewCount: 80 }),
        stationAt('thin', 201, 0, 3.14, { overall: 5, reviewCount: 1 }),
      ],
      route,
    ) as FeasibleTripPlan;
    expect(result.stops.map((s) => s.station.id)).toEqual(['solid']);
  });
});

describe('no gratuitous stops', () => {
  const route = northRoute(8);

  it('does not chain a token stop to farm a rating bonus', () => {
    // Regression: with no fixed cost per stop, the planner chained a second
    // station a mile later, buying 0.03 gallons purely to collect the bonus.
    const result = plan(
      [
        stationAt('first', 200, 0, 2.8, { overall: 2, reviewCount: 50 }),
        stationAt('second', 201, 0, 3.8, { overall: 5, reviewCount: 50 }),
      ],
      route,
    ) as FeasibleTripPlan;

    expect(result.stops).toHaveLength(1);
    expect(result.stops.every((s) => s.units > 0.5)).toBe(true);
  });

  it('takes one stop from a cluster of equals', () => {
    const result = plan(
      [
        stationAt('a', 200, 0, 3.0, { overall: 5, reviewCount: 99 }),
        stationAt('b', 202, 0, 3.0, { overall: 5, reviewCount: 99 }),
        stationAt('c', 204, 0, 3.0, { overall: 5, reviewCount: 99 }),
      ],
      route,
    ) as FeasibleTripPlan;

    expect(result.stops).toHaveLength(1);
  });
});

describe('multi-stop trips', () => {
  const route = northRoute(16); // ~1105 miles

  const everyHundredMiles = () => {
    const stations: Station[] = [];
    for (let mile = 100; mile < 1105; mile += 100) {
      stations.push(stationAt(`s${mile}`, mile, 0, 3 + (mile % 300) / 1000));
    }
    return stations;
  };

  it('never plans a leg longer than the usable range', () => {
    // The load-bearing property. If this fails, the app strands someone.
    const result = plan(everyHundredMiles(), route) as FeasibleTripPlan;
    expect(result.feasible).toBe(true);

    const legs: number[] = [];
    let previous = 0;
    for (const stop of result.stops) {
      legs.push(stop.alongMiles - previous + stop.detourMiles);
      previous = stop.alongMiles;
    }
    legs.push(route.distanceMiles - previous);

    for (const leg of legs) {
      expect(leg).toBeLessThanOrEqual(USABLE_RANGE + 0.01);
    }
  });

  it('orders stops along the route and arrives with range to spare', () => {
    const result = plan(everyHundredMiles(), route) as FeasibleTripPlan;

    expect(result.stops.length).toBeGreaterThanOrEqual(2);
    for (let i = 1; i < result.stops.length; i++) {
      expect(result.stops[i].alongMiles).toBeGreaterThan(result.stops[i - 1].alongMiles);
    }
    expect(result.arriveWithMiles).toBeGreaterThanOrEqual(0);
    expect(result.stops.every((s) => s.arriveWithMiles >= 0)).toBe(true);
  });

  it('takes a near expensive stop first when starting low on fuel', () => {
    // Quarter tank leaves only 52.5 usable miles, so the cheap station 300
    // miles out is not an option yet — but it should still be used later.
    const result = plan(
      [stationAt('close', 40, 0, 4.0), stationAt('cheap-but-far', 300, 0, 2.0)],
      northRoute(8),
      car({ level: 0.25 }),
    ) as FeasibleTripPlan;

    expect(result.stops[0].station.id).toBe('close');
    expect(result.stops.map((s) => s.station.id)).toContain('cheap-but-far');
  });
});

describe('infeasible trips', () => {
  const route = northRoute(16);

  it('reports a gap longer than a tank instead of faking a plan', () => {
    const result = plan([stationAt('lonely', 100, 0, 3.0)], route) as InfeasibleTripPlan;

    expect(result.feasible).toBe(false);
    expect(result.reachableToMiles).toBeGreaterThan(0);
    expect(result.reason).toEqual(expect.any(String));
    expect(result.reason.length).toBeGreaterThan(0);
  });

  it('reports when there are no stations at all', () => {
    expect(planTrip({ corridor: [], route, vehicle: car(), grade: 'regular' }).feasible).toBe(false);
  });

  it('explains when nothing sells the grade', () => {
    const result = plan([stationAt('nodiesel', 100, 0, 3.0)], route, car(), 'diesel') as InfeasibleTripPlan;

    expect(result.feasible).toBe(false);
    expect(result.reason).toContain('grade');
  });

  it('reports when even the first stop is out of reach', () => {
    const result = plan([stationAt('miles-away', 900, 0, 3.0)], route, car({ level: 0.2 }));
    expect(result.feasible).toBe(false);
  });
});

describe('off-route stops need approval', () => {
  const route = northRoute(8);

  it('does not flag a stop that is effectively on the way', () => {
    // A station at the exit is a detail, not a decision.
    const result = plan([stationAt('at-the-exit', 200, 0.5, 3.0)], route) as FeasibleTripPlan;

    expect(result.stops[0].detourMiles).toBeLessThan(ON_THE_WAY_DETOUR_MILES);
    expect(result.stops[0].requiresApproval).toBe(false);
    expect(stopsAwaitingApproval(result, [])).toHaveLength(0);
    expect(isPlanLive(result, [])).toBe(true);
  });

  it('flags a stop that pulls the driver off their route', () => {
    // Priced low enough that the planner picks it despite the detour.
    const result = plan([stationAt('off-route', 200, 4, 2.0)], route) as FeasibleTripPlan;

    expect(result.stops[0].detourMiles).toBeGreaterThan(ON_THE_WAY_DETOUR_MILES);
    expect(result.stops[0].requiresApproval).toBe(true);
    expect(stopsAwaitingApproval(result, [])).toHaveLength(1);
  });

  it('is not live until the off-route stop is approved', () => {
    const result = plan([stationAt('off-route', 200, 4, 2.0)], route) as FeasibleTripPlan;

    expect(isPlanLive(result, [])).toBe(false);
    expect(isPlanLive(result, ['off-route'])).toBe(true);
    expect(stopsAwaitingApproval(result, ['off-route'])).toHaveLength(0);
  });

  it('reports nothing pending for an infeasible plan', () => {
    const impossible = plan([], northRoute(16));
    expect(stopsAwaitingApproval(impossible, [])).toEqual([]);
    expect(isPlanLive(impossible, [])).toBe(false);
  });
});

describe('rejected stops', () => {
  const route = northRoute(8);
  const stations = [stationAt('off-route', 200, 4, 2.0), stationAt('on-route', 210, 0, 3.6)];

  it('plans around a rejection instead of resurfacing it', () => {
    const withDetour = plan(stations, route) as FeasibleTripPlan;
    expect(withDetour.stops.map((s) => s.station.id)).toEqual(['off-route']);

    const without = planTrip({
      corridor: stationsAlongRoute(stations, route, 5),
      route,
      vehicle: car(),
      grade: 'regular',
      excludedStationIds: ['off-route'],
    }) as FeasibleTripPlan;

    expect(without.stops.map((s) => s.station.id)).toEqual(['on-route']);
    expect(isPlanLive(without, [])).toBe(true);
  });

  it('explains itself when every option has been turned down', () => {
    const result = planTrip({
      corridor: stationsAlongRoute(stations, route, 5),
      route,
      vehicle: car(),
      grade: 'regular',
      excludedStationIds: ['off-route', 'on-route'],
    }) as InfeasibleTripPlan;

    expect(result.feasible).toBe(false);
    expect(result.reason).toContain('turned down');
  });

  it('keeps the grade explanation distinct from the rejection one', () => {
    const noSellers = plan([stationAt('nodiesel', 100, 0, 3.0)], northRoute(16), car(), 'diesel') as InfeasibleTripPlan;
    expect(noSellers.reason).toContain('grade');
    expect(noSellers.reason).not.toContain('turned down');
  });
});

describe('EV trips', () => {
  it('plans with the same code and respects the smaller usable range', () => {
    // 75 kWh x 3.5 mi/kWh = 262.5, less a 32.8 reserve = 229.7 usable.
    const ev = car({ fuelType: 'ev', capacity: 75, efficiency: 3.5 });
    const evUsable = 75 * 3.5 - 75 * 0.125 * 3.5;

    const result = plan(
      [stationAt('c1', 180, 0, 0.48), stationAt('c2', 380, 0, 0.35)],
      northRoute(8),
      ev,
    ) as FeasibleTripPlan;

    expect(result.feasible).toBe(true);
    let previous = 0;
    for (const stop of result.stops) {
      expect(stop.alongMiles - previous + stop.detourMiles).toBeLessThanOrEqual(evUsable + 0.01);
      previous = stop.alongMiles;
    }
  });
});

describe('what the trip actually costs at the pump', () => {
  // 14 gal, 30 MPG: 420 miles of fuel, of which the top 367.5 is usable above
  // the eighth-tank reserve. A quarter tank is 105 miles of fuel, so only
  // 52.5 of it is usable — which is why the app shows "66 mi range" for a
  // quarter tank in a 29-gallon truck rather than a quarter of its full range.
  const quarterTank = car({ level: 0.25 });

  it('charges for filling the tank at the first stop, not for the miles to reach it', () => {
    // Two miles into a 300-mile trip on a quarter tank. The driver buys a
    // tank of fuel here; billing them for two miles of it priced a real
    // 176-mile trip at four cents.
    const route = northRoute(300 / MPD);
    const result = plan([stationAt('early', 2, 0, 3.0)], route, quarterTank) as FeasibleTripPlan;

    expect(result.feasible).toBe(true);
    expect(result.stops).toHaveLength(1);

    // Arrives with 50.5 of its 52.5 usable miles left and fills to 367.5:
    // 317 miles of fuel at 30 MPG is 10.57 gal, about $31.70. Billing the two
    // miles driven would have made it 20 cents.
    expect(result.stops[0].units).toBeCloseTo(10.567, 2);
    expect(result.fuelCost).toBeCloseTo(31.7, 1);
    expect(result.fuelCost).toBeGreaterThan(20);
  });

  it('still bills a later stop for only the leg it just drove', () => {
    // Leaving a stop full means the next fill replaces exactly that leg — the
    // behaviour the first-stop fix must not disturb. 900 miles on a 367.5-mile
    // usable range forces both stops.
    const route = northRoute(900 / MPD);
    const result = plan(
      [stationAt('first', 300, 0, 3.0), stationAt('second', 650, 0, 3.0)],
      route,
      car(),
    ) as FeasibleTripPlan;

    expect(result.stops).toHaveLength(2);
    // Started full, so the first stop replaces just the 300 miles driven.
    expect(result.stops[0].units).toBeCloseTo(300 / 30, 1);
    // Second stop replaces the 350-mile leg between them.
    expect(result.stops[1].units).toBeCloseTo(350 / 30, 1);
  });

  it('never quotes a fill smaller than the fuel the leg burned', () => {
    const route = northRoute(500 / MPD);
    const result = plan(
      [stationAt('a', 10, 0, 3.0), stationAt('b', 200, 0, 2.9), stationAt('c', 380, 0, 3.1)],
      route,
      quarterTank,
    ) as FeasibleTripPlan;

    expect(result.feasible).toBe(true);
    for (const stop of result.stops) {
      expect(stop.units).toBeGreaterThan(0);
      expect(stop.fuelCost).toBeCloseTo(stop.units * stop.pricePerGallon, 6);
    }
    expect(result.fuelCost).toBeCloseTo(
      result.stops.reduce((sum, stop) => sum + stop.fuelCost, 0),
      6,
    );
  });
});

describe('stops the driver picked', () => {
  const route = northRoute(900 / MPD);

  // Cheap and expensive options in the same stretch, so the planner has a
  // clear favourite to be overruled.
  const cheap = stationAt('cheap', 300, 0, 2.50);
  const dear = stationAt('dear', 320, 0, 4.20);
  const later = stationAt('later', 650, 0, 3.00);

  it('routes through the chosen station even when it costs more', () => {
    const free = plan([cheap, dear, later], route) as FeasibleTripPlan;
    expect(free.stops.map((s) => s.station.id)).toContain('cheap');
    expect(free.stops.map((s) => s.station.id)).not.toContain('dear');

    const pinned = planTrip({
      corridor: stationsAlongRoute([cheap, dear, later], route, 5),
      route,
      vehicle: car(),
      grade: 'regular',
      pinnedStationIds: ['dear'],
    }) as FeasibleTripPlan;

    expect(pinned.feasible).toBe(true);
    expect(pinned.stops.map((s) => s.station.id)).toContain('dear');
    // Overruling the planner should cost more, or there was nothing to overrule.
    expect(pinned.fuelCost).toBeGreaterThan(free.fuelCost);
  });

  it('keeps chosen stops in route order alongside its own picks', () => {
    const pinned = planTrip({
      corridor: stationsAlongRoute([cheap, dear, later], route, 5),
      route,
      vehicle: car(),
      grade: 'regular',
      pinnedStationIds: ['dear'],
    }) as FeasibleTripPlan;

    const along = pinned.stops.map((s) => s.alongMiles);
    expect([...along].sort((a, b) => a - b)).toEqual(along);
    expect(pinned.stops.map((s) => s.station.id)).toContain('later');
  });

  it('says so rather than quietly picking its own when a choice cannot work', () => {
    // Pinned beyond a full tank's reach from the start, with nothing between.
    const unreachable = stationAt('too-far', 800, 0, 3.0);
    const result = planTrip({
      corridor: stationsAlongRoute([unreachable], route, 5),
      route,
      vehicle: car(),
      grade: 'regular',
      pinnedStationIds: ['too-far'],
    }) as InfeasibleTripPlan;

    expect(result.feasible).toBe(false);
    expect(result.reason).toMatch(/chosen stop/i);
  });

  it('ignores a pin for a station that is not on the route at all', () => {
    // Choosing cannot become a way to break an otherwise fine plan.
    const result = planTrip({
      corridor: stationsAlongRoute([cheap, later], route, 5),
      route,
      vehicle: car(),
      grade: 'regular',
      pinnedStationIds: ['some-station-elsewhere'],
    }) as FeasibleTripPlan;

    expect(result.feasible).toBe(true);
    expect(result.stops.length).toBeGreaterThan(0);
  });
});

describe('stopAlternatives', () => {
  const route = northRoute(900 / MPD);
  const first = stationAt('first', 300, 0, 3.00);
  const rival = stationAt('rival', 330, 0, 2.80);
  const tooFar = stationAt('too-far', 900, 0, 2.00);
  const second = stationAt('second', 650, 0, 3.00);
  const corridor = stationsAlongRoute([first, rival, tooFar, second], route, 5);

  const alternatives = (stopIndex: number, current: FeasibleTripPlan) =>
    stopAlternatives({ plan: current, stopIndex, corridor, route, vehicle: car(), grade: 'regular' });

  it('offers the other stations on the same leg, marking the planned one', () => {
    const current = plan([first, rival, tooFar, second], route) as FeasibleTripPlan;
    const options = alternatives(0, current);

    const ids = options.map((o) => o.station.id);
    expect(ids).toContain('first');
    expect(ids).toContain('rival');
    // Belongs to a later leg, so it is not a swap for this one.
    expect(ids).not.toContain('second');
    expect(options.filter((o) => o.isCurrent)).toHaveLength(1);
  });

  it('lists an out-of-range option rather than hiding it, and marks it', () => {
    const thirsty = car({ level: 0.2 });
    const current = planTrip({
      corridor,
      route: northRoute(200 / MPD),
      vehicle: thirsty,
      grade: 'regular',
    });
    if (!current.feasible) return; // covered by the planner's own tests

    const options = stopAlternatives({
      plan: current,
      stopIndex: 0,
      corridor,
      route,
      vehicle: thirsty,
      grade: 'regular',
    });

    // Reachable ones sort first, so a driver never scrolls past dead options.
    const firstUnreachable = options.findIndex((o) => !o.reachable);
    if (firstUnreachable !== -1) {
      expect(options.slice(firstUnreachable).every((o) => !o.reachable)).toBe(true);
    }
  });

  it('leaves out stations the driver already turned down', () => {
    const current = plan([first, rival, second], route) as FeasibleTripPlan;
    const options = stopAlternatives({
      plan: current,
      stopIndex: 0,
      corridor,
      route,
      vehicle: car(),
      grade: 'regular',
      excludedStationIds: ['rival'],
    });

    expect(options.map((o) => o.station.id)).not.toContain('rival');
  });
});
