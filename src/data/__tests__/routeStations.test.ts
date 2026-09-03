import { fetchStationsAlongRoute } from '../routeStations';
import { MockPriceFeed } from '../mockPriceFeed';
import type { PriceFeed } from '../priceFeed';
import type { LatLng, Region, Route, Station } from '../../types';

const MPD = 69.047;

/** A due-north route of `miles` from Atlanta. */
function route(miles: number, steps = 40): Route {
  const points: LatLng[] = [];
  for (let i = 0; i <= steps; i++) {
    points.push({ latitude: 33.749 + (miles * i) / steps / MPD, longitude: -84.388 });
  }
  return {
    points,
    distanceMiles: miles,
    durationMinutes: miles,
    destinationName: 'North',
    destination: points[points.length - 1],
  };
}

describe('fetchStationsAlongRoute', () => {
  it('finds stations for a long route regardless of the map region', async () => {
    // The bug this exists for: planning ran on the map's loaded stations, and
    // a map zoomed out far enough to show a 176-mile trip is past the feed's
    // span limit, so it had nothing at all to plan with.
    const feed = new MockPriceFeed();
    const whole = { latitude: 34.5, longitude: -84.388, latitudeDelta: 4, longitudeDelta: 4 };

    expect(await feed.getStationsInRegion(whole)).toHaveLength(0);

    const found = await fetchStationsAlongRoute(feed, route(176));
    expect(found.length).toBeGreaterThan(20);
  }, 20_000);

  it('covers the far end of the route, not just the start', async () => {
    const feed = new MockPriceFeed();
    const trip = route(176);
    const found = await fetchStationsAlongRoute(feed, trip);

    const startLat = trip.points[0].latitude;
    const endLat = trip.destination.latitude;
    const nearEnd = found.filter(
      (s) => s.coordinate.latitude > startLat + (endLat - startLat) * 0.8,
    );

    expect(nearEnd.length).toBeGreaterThan(0);
  }, 20_000);

  it('returns each station once even though windows overlap', async () => {
    const feed = new MockPriceFeed();
    const found = await fetchStationsAlongRoute(feed, route(60));
    expect(new Set(found.map((s) => s.id)).size).toBe(found.length);
  }, 20_000);

  it('uses a feed that can answer for a whole route in one call', async () => {
    const native = jest.fn().mockResolvedValue([]);
    const feed = {
      name: 'native',
      getStationsInRegion: jest.fn().mockResolvedValue([]),
      getStationsAlongRoute: native,
    } as unknown as PriceFeed;

    await fetchStationsAlongRoute(feed, route(500));

    expect(native).toHaveBeenCalledTimes(1);
    expect(feed.getStationsInRegion).not.toHaveBeenCalled();
  });

  it('keeps the rest of the route when one window fails', async () => {
    let call = 0;
    const station = (id: string): Station => ({
      id,
      name: id,
      brand: id,
      address: '',
      coordinate: { latitude: 33.8, longitude: -84.388 },
      prices: {},
      amenities: [],
      ratings: { reviewCount: 0 },
    });

    const flaky: PriceFeed = {
      name: 'flaky',
      async getStationsInRegion(_region: Region) {
        call += 1;
        if (call % 2 === 0) throw new Error('network');
        return [station(`s${call}`)];
      },
    };

    const found = await fetchStationsAlongRoute(flaky, route(120));
    expect(found.length).toBeGreaterThan(0);
  });

  it('caps how many windows a cross-country route fans out into', async () => {
    const feed: PriceFeed = {
      name: 'counting',
      getStationsInRegion: jest.fn().mockResolvedValue([]),
    };

    await fetchStationsAlongRoute(feed, route(3000, 400));

    expect((feed.getStationsInRegion as jest.Mock).mock.calls.length).toBeLessThanOrEqual(121);
  });
});
