import { cumulativeDistances, positionOnRoute, stationsAlongRoute } from '../route';
import type { LatLng, Route, Station } from '../../types';

/** Miles per degree of latitude, matching lib/route.ts. */
const MPD = 69.047;

/** A due-north route from (30, -97) spanning `degrees` of latitude. */
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

/** Places a station `milesNorth` up the route and `milesEast` off it. */
function stationAt(id: string, milesNorth: number, milesEast: number): Station {
  const milesPerDegLng = MPD * Math.cos((30 * Math.PI) / 180);
  return {
    id,
    name: id,
    brand: id,
    address: '',
    coordinate: { latitude: 30 + milesNorth / MPD, longitude: -97 + milesEast / milesPerDegLng },
    prices: { regular: { grade: 'regular', price: 3, reportedAt: new Date().toISOString(), source: 'feed' } },
    amenities: [],
    ratings: { reviewCount: 0 },
  };
}

describe('cumulativeDistances', () => {
  it('starts at zero and totals the route length', () => {
    const cumulative = cumulativeDistances(northRoute(4));
    expect(cumulative[0]).toBe(0);
    expect(cumulative[cumulative.length - 1]).toBeCloseTo(4 * MPD, 0);
  });
});

describe('positionOnRoute', () => {
  const route = northRoute(4);

  it('places an on-route point with no offset', () => {
    const position = positionOnRoute({ latitude: 30 + 100 / MPD, longitude: -97 }, route)!;
    expect(position.offsetMiles).toBeCloseTo(0, 0);
    expect(position.alongMiles).toBeCloseTo(100, 0);
  });

  it('measures perpendicular offset for an off-route point', () => {
    const milesPerDegLng = MPD * Math.cos((30 * Math.PI) / 180);
    const position = positionOnRoute(
      { latitude: 30 + 100 / MPD, longitude: -97 + 10 / milesPerDegLng },
      route,
    )!;
    expect(position.offsetMiles).toBeCloseTo(10, 0);
    expect(position.alongMiles).toBeCloseTo(100, 0);
  });

  it('clamps points before the start and past the end', () => {
    expect(positionOnRoute({ latitude: 30 - 50 / MPD, longitude: -97 }, route)!.alongMiles).toBeCloseTo(0, 0);
    expect(positionOnRoute({ latitude: 30 + 500 / MPD, longitude: -97 }, route)!.alongMiles).toBeCloseTo(
      4 * MPD,
      0,
    );
  });

  it('picks the nearest lobe on a route that doubles back', () => {
    // A naive scan that stops at the first close segment puts a station a
    // hundred miles from where it belongs on a switchback.
    const hairpin: Route = {
      points: [
        { latitude: 30, longitude: -97 },
        { latitude: 31, longitude: -97 },
        { latitude: 31, longitude: -96 },
        { latitude: 30, longitude: -96 },
      ],
      distanceMiles: 200,
      durationMinutes: 0,
      destinationName: 'Hairpin',
      destination: { latitude: 30, longitude: -96 },
    };

    expect(positionOnRoute({ latitude: 30.05, longitude: -96.02 }, hairpin)!.alongMiles).toBeGreaterThan(150);
  });

  it('handles degenerate routes', () => {
    const empty: Route = {
      points: [],
      distanceMiles: 0,
      durationMinutes: 0,
      destinationName: '',
      destination: { latitude: 0, longitude: 0 },
    };
    expect(positionOnRoute({ latitude: 30, longitude: -97 }, empty)).toBeUndefined();

    const single: Route = { ...empty, points: [{ latitude: 30, longitude: -97 }] };
    expect(positionOnRoute({ latitude: 30, longitude: -97 }, single)!.alongMiles).toBe(0);
  });
});

describe('stationsAlongRoute', () => {
  const route = northRoute(4);
  const stations = [stationAt('on', 100, 0), stationAt('near', 150, 3), stationAt('far', 150, 25)];

  it('keeps only stations inside the corridor, in route order', () => {
    const corridor = stationsAlongRoute(stations, route, 5);
    expect(corridor.map((c) => c.station.id)).toEqual(['on', 'near']);
    expect(corridor[0].alongMiles).toBeLessThan(corridor[1].alongMiles);
  });

  it('widens with the corridor', () => {
    expect(stationsAlongRoute(stations, route, 30)).toHaveLength(3);
    expect(stationsAlongRoute([], route, 5)).toEqual([]);
  });

  it('charges a detour for leaving the route and rejoining it', () => {
    const [, near] = stationsAlongRoute(stations, route, 5);
    expect(near.detourMiles).toBeCloseTo(near.offsetMiles * 2, 5);
  });
});
