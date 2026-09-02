import { estimateRange } from '../range';
import { findRangeDeal, matchesFilters, rankStations, valueScore, verdictForMode } from '../value';
import type { Amenity, Station, Vehicle } from '../../types';

interface StationOpts {
  overall?: number;
  restroom?: number;
  reviewCount?: number;
  sponsored?: boolean;
  amenities?: Amenity[];
  /** Degrees of latitude north of the origin, for distance tests. */
  northDegrees?: number;
}

const station = (id: string, price: number | undefined, opts: StationOpts = {}): Station => ({
  id,
  name: id,
  brand: id,
  address: '',
  coordinate: { latitude: 30 + (opts.northDegrees ?? 0), longitude: -97 },
  prices:
    price === undefined
      ? {}
      : { regular: { grade: 'regular', price, reportedAt: new Date().toISOString(), source: 'feed' } },
  amenities: opts.amenities ?? [],
  ratings: { overall: opts.overall, restroom: opts.restroom, reviewCount: opts.reviewCount ?? 0 },
  ...(opts.sponsored ? { sponsored: { advertiser: id, offer: '10c off' } } : {}),
});

describe('sponsorship cannot influence ranking', () => {
  // This is the property the business model rests on. If it ever fails, the
  // ranking is for sale and the product is worthless.
  it('scores an identical station the same with and without sponsorship', () => {
    const plain = station('a', 3.3, { overall: 4, restroom: 4, reviewCount: 50 });
    const paid = station('a', 3.3, { overall: 4, restroom: 4, reviewCount: 50, sponsored: true });

    expect(valueScore(paid, 'regular', 3.0, 3.6)).toBe(valueScore(plain, 'regular', 3.0, 3.6));
  });

  it('does not let a sponsored station win a ranking it would otherwise lose', () => {
    const pricey = station('pricey', 4.0, { overall: 5, restroom: 5, reviewCount: 200, sponsored: true });
    const cheap = station('cheap', 3.0, { overall: 5, restroom: 5, reviewCount: 200 });

    expect(rankStations([pricey, cheap], 'regular', 'value').best!.station.id).toBe('cheap');
    expect(rankStations([pricey, cheap], 'regular', 'price').best!.station.id).toBe('cheap');
  });
});

describe('valueScore', () => {
  it('prefers the cheaper station when neither is rated', () => {
    const cheap = station('c', 3.0);
    const dear = station('p', 4.0);
    expect(valueScore(cheap, 'regular', 3, 4)!).toBeGreaterThan(valueScore(dear, 'regular', 3, 4)!);
  });

  it('lets ratings break a price tie', () => {
    const good = station('g', 3.5, { overall: 5, restroom: 5, reviewCount: 100 });
    const bad = station('b', 3.5, { overall: 1, restroom: 1, reviewCount: 100 });
    expect(valueScore(good, 'regular', 3, 4)!).toBeGreaterThan(valueScore(bad, 'regular', 3, 4)!);
  });

  it('keeps price dominant over amenities across a wide gap', () => {
    // A spotless stop 80c over should not outrank a decent cheap one, or
    // "best value" stops meaning value.
    const spotlessExpensive = station('se', 4.0, { overall: 5, restroom: 5, reviewCount: 100 });
    const grimyCheap = station('gc', 3.2, { overall: 3, restroom: 3, reviewCount: 100 });
    expect(valueScore(grimyCheap, 'regular', 3.2, 4.0)!).toBeGreaterThan(
      valueScore(spotlessExpensive, 'regular', 3.2, 4.0)!,
    );
  });

  it('damps ratings with few reviews', () => {
    const many = station('l', 3.5, { overall: 5, restroom: 5, reviewCount: 100 });
    const few = station('f', 3.5, { overall: 5, restroom: 5, reviewCount: 1 });
    const none = station('n', 3.5, { reviewCount: 0 });

    expect(valueScore(few, 'regular', 3, 4)!).toBeLessThan(valueScore(many, 'regular', 3, 4)!);
    expect(valueScore(none, 'regular', 3, 4)!).toBeLessThan(valueScore(few, 'regular', 3, 4)!);
  });

  it('stays within 0-100 and survives a flat price range', () => {
    const best = valueScore(station('x', 3.0, { overall: 5, restroom: 5, reviewCount: 999 }), 'regular', 3, 4)!;
    const worst = valueScore(station('y', 4.0, { overall: 1, restroom: 1, reviewCount: 999 }), 'regular', 3, 4)!;

    expect(best).toBeLessThanOrEqual(100);
    expect(worst).toBeGreaterThanOrEqual(0);
    expect(Number.isFinite(valueScore(station('f', 3.3), 'regular', 3.3, 3.3)!)).toBe(true);
  });

  it('has no score without a price', () => {
    expect(valueScore(station('n', undefined), 'regular', 3, 4)).toBeUndefined();
  });
});

describe('rankStations', () => {
  const set = [
    station('a', 3.0, { overall: 4, restroom: 4, reviewCount: 20 }),
    station('b', 3.3, { overall: 3, restroom: 3, reviewCount: 20 }),
    station('c', 3.6, { overall: 2, restroom: 2, reviewCount: 20 }),
    station('d', 3.9, { overall: 1, restroom: 1, reviewCount: 20 }),
  ];

  it('ranks every station and picks exactly one winner', () => {
    const result = rankStations(set, 'regular', 'value');
    expect(result.ranked).toHaveLength(4);
    expect(result.median).toBe(3.45);
    expect(result.ranked.filter((r) => r.isBest)).toHaveLength(1);
    expect(result.best!.station.id).toBe('a');
  });

  it('ignores ratings entirely in price mode', () => {
    const pair = [
      station('cheap-grim', 3.0, { overall: 1, restroom: 1, reviewCount: 50 }),
      station('dear-lovely', 3.9, { overall: 5, restroom: 5, reviewCount: 50 }),
    ];
    expect(rankStations(pair, 'regular', 'price').best!.station.id).toBe('cheap-grim');
  });

  it('has no winner when nothing is priced', () => {
    expect(rankStations([], 'regular', 'value').best).toBeUndefined();
    expect(rankStations([station('x', undefined)], 'regular', 'value').best).toBeUndefined();
  });

  it('switches the pin verdict with the mode', () => {
    const [first] = rankStations(set, 'regular', 'value').ranked;
    expect(verdictForMode(first, 'price')).toBe(first.priceVerdict);
    expect(verdictForMode(first, 'value')).toBe(first.valueVerdict);
  });
});

describe('reachability in ranking', () => {
  const origin = { latitude: 30, longitude: -97 };
  const car = (overrides: Partial<Vehicle> = {}): Vehicle => ({
    label: 'v',
    fuelType: 'gas',
    capacity: 14,
    efficiency: 30,
    level: 1,
    ...overrides,
  });

  // ~0.145 deg north is about 10 straight-line miles; 2.9 deg is about 200.
  const near = station('near', 3.8, { northDegrees: 0.145 });
  const farCheap = station('far-cheap', 2.9, { northDegrees: 2.9 });

  it('never names an unreachable station the best', () => {
    // The cheapest gas in the state is not a recommendation if the driver runs
    // dry forty miles short of it.
    const tiny = estimateRange(car({ capacity: 5, efficiency: 20, level: 0.5 })); // 37.5 comfortable
    const result = rankStations([near, farCheap], 'regular', 'price', { origin, range: tiny });

    expect(result.best!.station.id).toBe('near');
    expect(result.ranked.find((r) => r.station.id === 'far-cheap')!.reachability).toBe('unreachable');
    expect(result.ranked.find((r) => r.station.id === 'near')!.reachability).toBe('comfortable');
  });

  it('picks the cheap far station when there is range to spare', () => {
    const big = estimateRange(car({ capacity: 25, efficiency: 35 }));
    expect(rankStations([near, farCheap], 'regular', 'price', { origin, range: big }).best!.station.id).toBe(
      'far-cheap',
    );
  });

  it('does not filter at all without a vehicle', () => {
    expect(
      rankStations([near, farCheap], 'regular', 'price', { origin, range: undefined }).best!.station.id,
    ).toBe('far-cheap');
  });

  it('has no distances without a location', () => {
    expect(rankStations([near, farCheap], 'regular', 'price').ranked.every((r) => r.distance === undefined)).toBe(
      true,
    );
  });
});

describe('findRangeDeal', () => {
  const origin = { latitude: 30, longitude: -97 };
  const car: Vehicle = { label: 'v', fuelType: 'gas', capacity: 14, efficiency: 30, level: 1 };
  const big = estimateRange({ ...car, capacity: 25, efficiency: 35 });

  const near = station('near', 3.8, { northDegrees: 0.145 });
  const farCheap = station('far-cheap', 2.9, { northDegrees: 2.9 });

  it('reports the savings from driving on', () => {
    const ranked = rankStations([near, farCheap], 'regular', 'price', { origin, range: big }).ranked;
    const deal = findRangeDeal(ranked, 14)!;

    expect(deal.target.station.id).toBe('far-cheap');
    expect(deal.nearest.station.id).toBe('near');
    expect(deal.savings).toBeCloseTo((3.8 - 2.9) * 14, 2);
    expect(deal.extraMiles).toBeGreaterThan(0);
  });

  it('never proposes a deal that spends the reserve', () => {
    // Advice that eats someone's safety margin to save a few dollars is bad
    // advice however good the arithmetic looks.
    const justShort = estimateRange({ ...car, capacity: 10, efficiency: 26 });
    const ranked = rankStations([near, farCheap], 'regular', 'price', { origin, range: justShort }).ranked;

    expect(ranked.find((r) => r.station.id === 'far-cheap')!.reachability).toBe('reserve');
    expect(findRangeDeal(ranked, 14)).toBeUndefined();
  });

  it('stays quiet when there is nothing worth saying', () => {
    const cheapNear = station('cheap-near', 2.5, { northDegrees: 0.145 });
    const dearFar = station('dear-far', 4.0, { northDegrees: 1.0 });
    const alreadyBest = rankStations([cheapNear, dearFar], 'regular', 'price', { origin, range: big }).ranked;
    expect(findRangeDeal(alreadyBest, 14)).toBeUndefined();

    // A banner for pocket change trains people to ignore banners.
    const pennies = rankStations(
      [station('a', 3.0, { northDegrees: 0.145 }), station('b', 2.99, { northDegrees: 0.3 })],
      'regular',
      'price',
      { origin, range: big },
    ).ranked;
    expect(findRangeDeal(pennies, 14)).toBeUndefined();

    expect(findRangeDeal([], 14)).toBeUndefined();
  });
});

describe('matchesFilters', () => {
  const s = station('a', 3.0, { amenities: ['restroom', 'food'] });

  it('requires every selected amenity, not any', () => {
    expect(matchesFilters(s, [])).toBe(true);
    expect(matchesFilters(s, ['restroom'])).toBe(true);
    expect(matchesFilters(s, ['restroom', 'food'])).toBe(true);
    expect(matchesFilters(s, ['evCharging'])).toBe(false);
    expect(matchesFilters(s, ['restroom', 'evCharging'])).toBe(false);
  });
});
