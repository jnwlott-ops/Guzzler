import { estimateCapacity } from '../tankSize';

describe('estimateCapacity', () => {
  it('reads the real EPA class strings', () => {
    expect(estimateCapacity('Midsize Cars', 'gas')).toBe(16);
    expect(estimateCapacity('Compact Cars', 'gas')).toBe(14);
    expect(estimateCapacity('Two Seaters', 'gas')).toBe(14);
  });

  it('prefers the more specific class when one name contains another', () => {
    // "Standard Pickup Trucks 2WD" contains "Pickup", and "Small Sport Utility
    // Vehicle 4WD" contains "Sport Utility". Matching the general rule first
    // would hand a full-size truck a mid-size SUV's tank.
    expect(estimateCapacity('Standard Pickup Trucks 2WD', 'gas')).toBe(26);
    expect(estimateCapacity('Small Pickup Trucks 4WD', 'gas')).toBe(20);
    expect(estimateCapacity('Standard Sport Utility Vehicle 4WD', 'gas')).toBe(21);
    expect(estimateCapacity('Small Sport Utility Vehicle 2WD', 'gas')).toBe(16);
  });

  it('separates minivans from cargo vans', () => {
    // Both contain "van"; they are 6 gallons apart.
    expect(estimateCapacity('Minivan - 4WD', 'gas')).toBe(19);
    expect(estimateCapacity('Vans, Cargo Type', 'gas')).toBe(25);
  });

  it('falls back rather than returning nothing for an unknown class', () => {
    expect(estimateCapacity('', 'gas')).toBe(15);
    expect(estimateCapacity('Some New Class The EPA Invented', 'gas')).toBe(15);
  });

  it('switches units for electric vehicles', () => {
    // Same class, different question: gallons vs usable kWh.
    expect(estimateCapacity('Midsize Cars', 'gas')).toBe(16);
    expect(estimateCapacity('Midsize Cars', 'ev')).toBe(75);
    expect(estimateCapacity('Unknown', 'ev')).toBe(75);
  });

  it('always returns a usable positive number', () => {
    const classes = ['Midsize Cars', 'Vans, Passenger Type', 'Special Purpose Vehicle', 'zzz'];
    for (const sizeClass of classes) {
      for (const fuel of ['gas', 'ev'] as const) {
        const value = estimateCapacity(sizeClass, fuel);
        expect(Number.isFinite(value)).toBe(true);
        expect(value).toBeGreaterThan(0);
      }
    }
  });
});
