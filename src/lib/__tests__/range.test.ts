import {
  distanceMiles,
  drivingDistanceMiles,
  estimateRange,
  formatLevel,
  formatMiles,
  milesToMeters,
  reachabilityOf,
} from '../range';
import type { Vehicle } from '../../types';

const car = (overrides: Partial<Vehicle> = {}): Vehicle => ({
  label: 'test',
  fuelType: 'gas',
  capacity: 14,
  efficiency: 30,
  level: 1,
  ...overrides,
});

describe('estimateRange', () => {
  it('computes range from tank, efficiency and level', () => {
    // 14 gal x 30 MPG = 420 miles on a full tank.
    expect(estimateRange(car())!.totalMiles).toBe(420);
    expect(estimateRange(car({ level: 0.5 }))!.totalMiles).toBe(210);
    expect(estimateRange(car({ level: 0 }))!.totalMiles).toBe(0);
  });

  it('measures reserve against the full tank, not the current level', () => {
    // An eighth of 14 gal is 1.75 gal = 52.5 miles, whatever the level. If this
    // were computed off the current level, the reserve would shrink exactly
    // when the driver most needs it.
    expect(estimateRange(car())!.comfortableMiles).toBe(367.5);
    expect(estimateRange(car({ level: 0.5 }))!.comfortableMiles).toBe(157.5);
  });

  it('never reports negative comfortable range below reserve', () => {
    expect(estimateRange(car({ level: 0.05 }))!.comfortableMiles).toBe(0);
    expect(estimateRange(car({ level: 0.05 }))!.totalMiles).toBeGreaterThan(0);
  });

  it('shrinks the drawn radius to account for road circuity', () => {
    const range = estimateRange(car())!;
    expect(range.maxRadiusMiles).toBeLessThan(range.totalMiles);
    expect(range.maxRadiusMiles).toBeCloseTo(420 / 1.25, 5);
  });

  it('uses the same math for EVs in different units', () => {
    // 75 kWh x 3.5 mi/kWh = 262.5 miles.
    expect(estimateRange(car({ fuelType: 'ev', capacity: 75, efficiency: 3.5 }))!.totalMiles).toBe(262.5);
  });

  it('rejects unusable profiles rather than returning zero', () => {
    // undefined and 0 must stay distinguishable: "no vehicle set up" is not
    // the same as "genuinely empty".
    expect(estimateRange(undefined)).toBeUndefined();
    expect(estimateRange(car({ capacity: 0 }))).toBeUndefined();
    expect(estimateRange(car({ efficiency: 0 }))).toBeUndefined();
    expect(estimateRange(car({ capacity: -5 }))).toBeUndefined();
    expect(estimateRange(car({ efficiency: Number.NaN }))).toBeUndefined();
  });

  it('clamps out-of-range fuel levels', () => {
    expect(estimateRange(car({ level: 5 }))!.totalMiles).toBe(420);
    expect(estimateRange(car({ level: -3 }))!.totalMiles).toBe(0);
  });
});

describe('distanceMiles', () => {
  const austin = { latitude: 30.2672, longitude: -97.7431 };
  const dallas = { latitude: 32.7767, longitude: -96.797 };

  it('measures a known distance', () => {
    expect(distanceMiles(austin, dallas)).toBeCloseTo(182, -1);
  });

  it('is zero to itself and symmetric', () => {
    expect(distanceMiles(austin, austin)).toBe(0);
    expect(distanceMiles(austin, dallas)).toBeCloseTo(distanceMiles(dallas, austin), 6);
  });

  it('puts a degree of latitude at about 69 miles', () => {
    expect(distanceMiles({ latitude: 0, longitude: 0 }, { latitude: 1, longitude: 0 })).toBeCloseTo(69, 0);
  });

  it('shrinks longitude degrees toward the poles', () => {
    // The check that catches swapped lat/lng: longitude spacing is
    // latitude-dependent, latitude spacing is not.
    const atEquator = distanceMiles({ latitude: 0, longitude: 0 }, { latitude: 0, longitude: 1 });
    const at60 = distanceMiles({ latitude: 60, longitude: 0 }, { latitude: 60, longitude: 1 });
    expect(at60).toBeCloseTo(atEquator * 0.5, 0);
  });

  it('handles antipodal points without blowing up', () => {
    expect(distanceMiles({ latitude: 0, longitude: 0 }, { latitude: 0, longitude: 180 })).toBeCloseTo(12437, -2);
  });

  it('estimates driving distance above straight-line distance', () => {
    expect(drivingDistanceMiles(austin, dallas)).toBeGreaterThan(distanceMiles(austin, dallas));
  });
});

describe('reachabilityOf', () => {
  const range = estimateRange(car())!; // 367.5 comfortable / 420 total

  it('classifies against comfortable and total range', () => {
    expect(reachabilityOf(100, range)).toBe('comfortable');
    expect(reachabilityOf(367.5, range)).toBe('comfortable');
    expect(reachabilityOf(368, range)).toBe('reserve');
    expect(reachabilityOf(420, range)).toBe('reserve');
    expect(reachabilityOf(421, range)).toBe('unreachable');
  });

  it('treats everything as reachable when no vehicle is set up', () => {
    // The map should never grey out stations the driver never asked us to filter.
    expect(reachabilityOf(99999, undefined)).toBe('comfortable');
  });
});

describe('formatting', () => {
  it('formats miles at sensible precision', () => {
    expect(formatMiles(367.5)).toBe('368 mi');
    expect(formatMiles(42.4)).toBe('42 mi');
    expect(formatMiles(3.25)).toBe('3.3 mi');
  });

  it('formats fuel level as fractions of a tank', () => {
    expect(formatLevel(1)).toBe('Full');
    expect(formatLevel(0)).toBe('Empty');
    expect(formatLevel(0.5)).toBe('1/2 tank');
    expect(formatLevel(0.25)).toBe('1/4 tank');
    expect(formatLevel(0.75)).toBe('3/4 tank');
  });

  it('converts miles to metres for map circles', () => {
    expect(milesToMeters(1)).toBeCloseTo(1609.344, 3);
  });
});
