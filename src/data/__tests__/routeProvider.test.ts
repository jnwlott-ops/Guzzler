import { MockRouteProvider } from '../routeProvider';
import type { LatLng } from '../../types';

const hampton: LatLng = { latitude: 33.3868, longitude: -84.2833 };

describe('MockRouteProvider', () => {
  const provider = new MockRouteProvider();

  it('publishes the destinations it can actually resolve', () => {
    // A real geocoder leaves this undefined; a fixed list must advertise itself
    // so the UI can offer it instead of letting someone type into a void.
    expect(provider.knownDestinations).toBeDefined();
    expect(provider.knownDestinations!.length).toBeGreaterThan(5);
    expect(provider.knownDestinations).toContain('Atlanta');
  });

  it('resolves a known destination case-insensitively', async () => {
    const route = await provider.getRoute(hampton, 'atlanta');

    expect(route.destinationName).toBe('Atlanta');
    expect(route.points.length).toBeGreaterThan(10);
    expect(route.distanceMiles).toBeGreaterThan(0);
    expect(route.durationMinutes).toBeGreaterThan(0);
  });

  it('rejects a destination it cannot resolve instead of inventing one', async () => {
    // Regression: it used to fabricate a point 1.8 degrees northeast, so a real
    // local destination silently produced a route into an empty field —
    // indistinguishable from the feature being broken.
    await expect(provider.getRoute(hampton, 'Griffin GA')).rejects.toThrow(/doesn't know/i);
  });

  it('names the unresolvable destination in the error', async () => {
    await expect(provider.getRoute(hampton, 'Nowheresville')).rejects.toThrow(/Nowheresville/);
  });

  it(
    'every advertised destination actually resolves',
    async () => {
      // The list the UI shows must not contain anything getRoute will reject.
      // Generous timeout: the mock simulates 350ms of network latency per call
      // on purpose, and this walks the whole list.
      const routes = await Promise.all(
        provider.knownDestinations!.map((place) => provider.getRoute(hampton, place)),
      );

      expect(routes.map((r) => r.destinationName)).toEqual([...provider.knownDestinations!]);
    },
    15_000,
  );
});
