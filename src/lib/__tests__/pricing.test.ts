import {
  cheapestStation,
  formatAge,
  formatPinPrice,
  formatPrice,
  medianPrice,
  savingsPerTank,
  verdictFor,
} from '../pricing';
import type { Station } from '../../types';

const station = (id: string, price?: number): Station => ({
  id,
  name: id,
  brand: id,
  address: '',
  coordinate: { latitude: 0, longitude: 0 },
  prices:
    price === undefined
      ? {}
      : { regular: { grade: 'regular', price, reportedAt: new Date().toISOString(), source: 'feed' } },
  amenities: [],
  ratings: { reviewCount: 0 },
});

describe('medianPrice', () => {
  it('handles odd and even counts', () => {
    expect(medianPrice([station('a', 3), station('b', 3.5), station('c', 4)], 'regular')).toBe(3.5);
    expect(medianPrice([station('a', 3), station('b', 4)], 'regular')).toBe(3.5);
  });

  it('ignores stations that do not post the grade', () => {
    expect(medianPrice([station('a', 3), station('b'), station('c', 4)], 'regular')).toBe(3.5);
    expect(medianPrice([station('a'), station('b')], 'regular')).toBeUndefined();
    expect(medianPrice([], 'regular')).toBeUndefined();
  });

  it('resists a single outlier', () => {
    // The whole reason for median over mean: one highway-exit gouger must not
    // drag "normal" up and thereby make itself look reasonable.
    const withGouger = [station('a', 3.2), station('b', 3.25), station('c', 3.3), station('d', 6)];
    const median = medianPrice(withGouger, 'regular')!;

    expect(median).toBeGreaterThan(3.2);
    expect(median).toBeLessThan(3.31);
    expect(verdictFor(6, median)).toBe('gouge');
  });
});

describe('verdictFor', () => {
  it('bands prices around the local median', () => {
    expect(verdictFor(3.0, 3.29)).toBe('deal');
    expect(verdictFor(3.6, 3.29)).toBe('gouge');
    expect(verdictFor(3.29, 3.29)).toBe('typical');
    expect(verdictFor(3.29 * 1.02, 3.29)).toBe('typical');
    expect(verdictFor(3.29 * 1.04, 3.29)).toBe('gouge');
  });

  it('reports unknown rather than guessing', () => {
    expect(verdictFor(undefined, 3.29)).toBe('unknown');
    expect(verdictFor(3.29, undefined)).toBe('unknown');
    expect(verdictFor(3.29, 0)).toBe('unknown');
  });
});

describe('cheapestStation', () => {
  it('finds the lowest price for the grade', () => {
    expect(cheapestStation([station('a', 3.5), station('b', 3.1), station('c', 3.9)], 'regular')!.id).toBe('b');
    expect(cheapestStation([station('a')], 'regular')).toBeUndefined();
  });
});

describe('savingsPerTank', () => {
  it('is positive when cheaper than median and negative when dearer', () => {
    expect(savingsPerTank(3.0, 3.29)).toBeCloseTo(4.06, 2);
    expect(savingsPerTank(3.5, 3.29)).toBeCloseTo(-2.94, 2);
    expect(savingsPerTank(3.0, undefined)).toBeUndefined();
  });
});

describe('formatting', () => {
  it('formats prices and pin labels', () => {
    expect(formatPrice(3.5)).toBe('$3.50');
    expect(formatPrice(undefined)).toBe('--');
    expect(formatPinPrice(3.29)).toBe('329');
    expect(formatPinPrice(undefined)).toBe('--');
  });

  it('formats price age as a freshness signal', () => {
    expect(formatAge(new Date().toISOString())).toBe('just now');
    expect(formatAge(new Date(Date.now() - 12 * 60_000).toISOString())).toBe('12m ago');
    expect(formatAge(new Date(Date.now() - 3 * 3_600_000).toISOString())).toBe('3h ago');
    expect(formatAge(new Date(Date.now() - 50 * 3_600_000).toISOString())).toBe('2d ago');
    expect(formatAge(undefined)).toBe('no data');
  });
});
