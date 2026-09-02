import { MockPriceFeed } from '../mockPriceFeed';
import { rankStations } from '../../lib/value';
import type { Region, Station } from '../../types';

const austin: Region = {
  latitude: 30.2672,
  longitude: -97.7431,
  latitudeDelta: 0.05,
  longitudeDelta: 0.05,
};

/** A wide sample, so rates aren't judged off one unlucky region. */
async function sampleWidely(feed: MockPriceFeed): Promise<Station[]> {
  const centers: [number, number][] = [
    [30.27, -97.74],
    [32.78, -96.8],
    [29.76, -95.37],
    [35.47, -97.52],
    [39.74, -104.99],
  ];

  const all: Station[] = [];
  for (const [latitude, longitude] of centers) {
    all.push(
      ...(await feed.getStationsInRegion({
        latitude,
        longitude,
        latitudeDelta: 0.06,
        longitudeDelta: 0.06,
      })),
    );
  }
  return all;
}

describe('generated stations', () => {
  it('returns stable results for the same region', () => {
    // Pins must not reshuffle while the user pans.
    const feed = new MockPriceFeed();
    return Promise.all([feed.getStationsInRegion(austin), feed.getStationsInRegion(austin)]).then(
      ([first, second]) => {
        expect(first.length).toBeGreaterThan(0);
        expect(second.map((s) => [s.id, s.prices.regular?.price])).toEqual(
          first.map((s) => [s.id, s.prices.regular?.price]),
        );
      },
    );
  });

  it('places stations near the requested region', async () => {
    const stations = await new MockPriceFeed().getStationsInRegion(austin);

    for (const station of stations) {
      expect(Math.abs(station.coordinate.latitude - austin.latitude)).toBeLessThan(0.06);
      expect(Math.abs(station.coordinate.longitude - austin.longitude)).toBeLessThan(0.06);
    }
  });

  it('always posts regular, at plausible prices, with variation', async () => {
    const stations = await new MockPriceFeed().getStationsInRegion(austin);

    expect(stations.every((s) => s.prices.regular !== undefined)).toBe(true);
    expect(stations.every((s) => s.prices.regular!.price > 2.5 && s.prices.regular!.price < 4.5)).toBe(true);
    // A flat sea of identical prices would make the whole verdict UI pointless.
    expect(new Set(stations.map((s) => s.prices.regular!.price)).size).toBeGreaterThan(1);
  });

  it('guards against generating stations for the whole planet', async () => {
    const world: Region = { latitude: 0, longitude: 0, latitudeDelta: 180, longitudeDelta: 360 };
    expect(await new MockPriceFeed().getStationsInRegion(world)).toEqual([]);
  });

  it('produces more than one verdict class', async () => {
    const stations = await new MockPriceFeed().getStationsInRegion(austin);
    const { ranked } = rankStations(stations, 'regular', 'value');

    expect(new Set(ranked.map((r) => r.value)).size).toBeGreaterThan(1);
    expect(new Set(ranked.map((r) => r.valueVerdict)).size).toBeGreaterThan(1);
  });
});

describe('amenities and ratings', () => {
  it('generates ratings only where there are reviews', async () => {
    const stations = await new MockPriceFeed().getStationsInRegion(austin);

    for (const { ratings } of stations) {
      if (ratings.reviewCount === 0) {
        expect(ratings.restroom).toBeUndefined();
        expect(ratings.overall).toBeUndefined();
      } else {
        for (const score of [ratings.restroom, ratings.overall]) {
          if (score !== undefined) {
            expect(score).toBeGreaterThanOrEqual(1);
            expect(score).toBeLessThanOrEqual(5);
          }
        }
      }
    }
  });

  it('does not correlate amenities that share a name length', async () => {
    // Regression: amenity draws were seeded on name length, so airPump,
    // carWash and open24h (all 7 characters) resolved identically — every
    // station had all three or none.
    const stations = await sampleWidely(new MockPriceFeed());
    const agreement = (a: 'airPump' | 'carWash' | 'open24h', b: 'airPump' | 'carWash' | 'open24h') =>
      stations.filter((s) => s.amenities.includes(a) === s.amenities.includes(b)).length / stations.length;

    expect(agreement('airPump', 'carWash')).toBeLessThan(0.95);
    expect(agreement('carWash', 'open24h')).toBeLessThan(0.95);
  });

  it('does not correlate fuel grades that share a name length', async () => {
    const stations = await sampleWidely(new MockPriceFeed());
    const agreement =
      stations.filter((s) => (s.prices.premium !== undefined) === (s.prices.midgrade !== undefined)).length /
      stations.length;

    expect(agreement).toBeLessThan(0.95);
  });

  it('sponsors a visible minority of stations', async () => {
    const stations = await sampleWidely(new MockPriceFeed());
    const rate = stations.filter((s) => s.sponsored).length / stations.length;

    expect(rate).toBeGreaterThan(0.03);
    expect(rate).toBeLessThan(0.35);
    expect(stations.filter((s) => s.sponsored).every((s) => typeof s.sponsored!.offer === 'string')).toBe(true);
  });
});

describe('driver submissions', () => {
  it('overlays a reported price without touching other stations', async () => {
    const feed = new MockPriceFeed();
    const [target] = await feed.getStationsInRegion(austin);

    await feed.submitReport({
      stationId: target.id,
      grade: 'regular',
      price: 1.11,
      reportedAt: new Date().toISOString(),
    });

    const after = await feed.getStationsInRegion(austin);
    const updated = after.find((s) => s.id === target.id)!;

    expect(updated.prices.regular!.price).toBe(1.11);
    expect(updated.prices.regular!.source).toBe('crowdsourced');
    expect(after.filter((s) => s.prices.regular!.price === 1.11)).toHaveLength(1);
  });

  it('blends a rating rather than replacing it', async () => {
    const feed = new MockPriceFeed();
    const stations = await feed.getStationsInRegion(austin);
    const target = stations.find((s) => s.ratings.reviewCount > 20)!;
    const before = target.ratings.restroom!;

    await feed.submitRating({
      stationId: target.id,
      restroom: 1,
      overall: 1,
      submittedAt: new Date().toISOString(),
    });

    const updated = (await feed.getStationsInRegion(austin)).find((s) => s.id === target.id)!;

    expect(updated.ratings.reviewCount).toBe(target.ratings.reviewCount + 1);
    expect(updated.ratings.restroom).toBeLessThanOrEqual(before);
    // One rating should barely move a well-reviewed station.
    expect(Math.abs(updated.ratings.restroom! - before)).toBeLessThan(0.5);
  });

  it('applies a first rating in full', async () => {
    const feed = new MockPriceFeed();
    const stations = await feed.getStationsInRegion(austin);
    const unrated = stations.find((s) => s.ratings.reviewCount === 0);

    if (!unrated) return;

    await feed.submitRating({
      stationId: unrated.id,
      restroom: 5,
      overall: 5,
      submittedAt: new Date().toISOString(),
    });

    const updated = (await feed.getStationsInRegion(austin)).find((s) => s.id === unrated.id)!;
    expect(updated.ratings.restroom).toBe(5);
    expect(updated.ratings.reviewCount).toBe(1);
  });
});
