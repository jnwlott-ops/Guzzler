import { EpaVehicleCatalog } from '../epaVehicleCatalog';

function mockJson(payload: unknown, ok = true, status = 200) {
  return jest.fn().mockResolvedValue({
    ok,
    status,
    json: async () => payload,
  });
}

describe('EpaVehicleCatalog', () => {
  const original = globalThis.fetch;
  afterEach(() => {
    globalThis.fetch = original;
  });

  it('normalizes the bare object the API returns for a single match', async () => {
    // The EPA returns `menuItem: {...}` rather than a one-element array when
    // exactly one thing matches — common for models with a single engine.
    // Treating that as an array yields an empty dropdown.
    globalThis.fetch = mockJson({ menuItem: { text: 'Camry', value: 'Camry' } }) as never;
    const options = await new EpaVehicleCatalog().models('2019', 'Toyota');
    expect(options).toEqual([{ label: 'Camry', value: 'Camry' }]);
  });

  it('returns an empty list rather than throwing when nothing matches', async () => {
    globalThis.fetch = mockJson({}) as never;
    await expect(new EpaVehicleCatalog().makes('1802')).resolves.toEqual([]);
  });

  it('lists years newest first and drops the ones with thin data', async () => {
    globalThis.fetch = mockJson({
      menuItem: [
        { text: '1990', value: '1990' },
        { text: '2019', value: '2019' },
        { text: '2004', value: '2004' },
      ],
    }) as never;
    const years = await new EpaVehicleCatalog().years();
    expect(years.map((option) => option.value)).toEqual(['2019', '2004']);
  });

  it('reads combined MPG for a gas vehicle', async () => {
    globalThis.fetch = mockJson({
      year: '2019',
      make: 'Toyota',
      model: 'Camry',
      comb08: 32,
      fuelType1: 'Regular Gasoline',
      VClass: 'Midsize Cars',
    }) as never;

    const found = await new EpaVehicleCatalog().details('12345');
    expect(found).toMatchObject({
      label: '2019 Toyota Camry',
      fuelType: 'gas',
      efficiency: 32,
      estimatedCapacity: 16,
      sizeClass: 'Midsize Cars',
    });
  });

  it('inverts kWh/100mi for an EV instead of using MPGe', async () => {
    // comb08 here is 132 MPGe. Using it as mi/kWh would claim 132 miles per
    // kWh and overstate range by more than 40x; the real figure is 100/combE.
    globalThis.fetch = mockJson({
      year: '2022',
      make: 'Nissan',
      model: 'Leaf',
      comb08: 132,
      combE: 25.6,
      fuelType1: 'Electricity',
      VClass: 'Midsize Cars',
    }) as never;

    const found = await new EpaVehicleCatalog().details('54321');
    expect(found.fuelType).toBe('ev');
    expect(found.efficiency).toBeCloseTo(3.91, 2);
    expect(found.estimatedCapacity).toBe(75);
  });

  it('treats a plug-in hybrid as gas, since that is how it gets refuelled', async () => {
    globalThis.fetch = mockJson({
      year: '2021',
      make: 'Toyota',
      model: 'Prius Prime',
      comb08: 54,
      fuelType1: 'Premium Gas or Electricity',
      VClass: 'Midsize Cars',
    }) as never;
    await expect(new EpaVehicleCatalog().details('999')).resolves.toMatchObject({
      fuelType: 'gas',
      efficiency: 54,
    });
  });

  it('refuses a trim with no usable rating rather than saving a broken range', async () => {
    globalThis.fetch = mockJson({
      year: '2019',
      make: 'Toyota',
      model: 'Camry',
      fuelType1: 'Regular Gasoline',
      VClass: 'Midsize Cars',
    }) as never;
    await expect(new EpaVehicleCatalog().details('7')).rejects.toThrow(/manually/i);
  });

  it('surfaces an HTTP failure as an error', async () => {
    globalThis.fetch = mockJson({}, false, 503) as never;
    await expect(new EpaVehicleCatalog().years()).rejects.toThrow(/503/);
  });

  it('escapes makes containing characters that would break the query', async () => {
    const fetchMock = mockJson({ menuItem: [] });
    globalThis.fetch = fetchMock as never;
    await new EpaVehicleCatalog().models('2019', 'Rolls-Royce & Co');
    expect(fetchMock.mock.calls[0][0]).toContain('make=Rolls-Royce%20%26%20Co');
  });
});
