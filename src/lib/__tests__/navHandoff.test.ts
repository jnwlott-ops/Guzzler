import {
  buildDirectionsUrl,
  fitsInOneHandoff,
  NAV_APPS,
  type NavApp,
} from '../navHandoff';
import type { LatLng } from '../../types';

const austin: LatLng = { latitude: 30.2672, longitude: -97.7431 };
const waco: LatLng = { latitude: 31.5493, longitude: -97.1467 };
const dallas: LatLng = { latitude: 32.7767, longitude: -96.797 };
const okc: LatLng = { latitude: 35.4676, longitude: -97.5164 };
const wichita: LatLng = { latitude: 37.6872, longitude: -97.3301 };

describe('buildDirectionsUrl', () => {
  it('always includes the destination', () => {
    for (const app of Object.keys(NAV_APPS) as NavApp[]) {
      const { url } = buildDirectionsUrl(app, { destination: dallas });
      expect(url).toContain('32.776700');
      expect(url).toContain('-96.797000');
    }
  });

  it('produces a parseable https URL for every app', () => {
    for (const app of Object.keys(NAV_APPS) as NavApp[]) {
      const { url } = buildDirectionsUrl(app, { destination: dallas });
      expect(() => new URL(url)).not.toThrow();
      expect(url.startsWith('https://')).toBe(true);
    }
  });

  describe('Google Maps', () => {
    it('carries waypoints up to its mobile limit', () => {
      const { url, dropped } = buildDirectionsUrl('google', {
        destination: wichita,
        waypoints: [waco, dallas, okc],
      });

      const params = new URL(url).searchParams;
      expect(params.get('api')).toBe('1');
      expect(params.get('travelmode')).toBe('driving');
      expect(params.get('waypoints')!.split('|')).toHaveLength(3);
      expect(dropped).toEqual([]);
    });

    it('truncates beyond three and reports what was dropped', () => {
      // Google documents up to 9, but only ~3 when the link opens on mobile —
      // and mobile is the entire use case.
      const extra: LatLng = { latitude: 38, longitude: -97 };
      const { url, dropped } = buildDirectionsUrl('google', {
        destination: wichita,
        waypoints: [waco, dallas, okc, extra],
      });

      expect(new URL(url).searchParams.get('waypoints')!.split('|')).toHaveLength(3);
      expect(dropped).toEqual([extra]);
    });

    it('omits the waypoints parameter when there are none', () => {
      const { url } = buildDirectionsUrl('google', { destination: dallas });
      expect(new URL(url).searchParams.has('waypoints')).toBe(false);
    });
  });

  describe('Waze', () => {
    it('navigates to a single destination', () => {
      const params = new URL(buildDirectionsUrl('waze', { destination: dallas }).url).searchParams;
      expect(params.get('navigate')).toBe('yes');
      expect(params.get('ll')).toBe('32.776700,-96.797000');
    });

    it('relays every intermediate stop, since its link takes none', () => {
      const { dropped } = buildDirectionsUrl('waze', {
        destination: wichita,
        waypoints: [waco, dallas],
      });
      expect(dropped).toEqual([waco, dallas]);
    });
  });

  describe('Apple Maps', () => {
    it('sets a driving destination', () => {
      const params = new URL(buildDirectionsUrl('apple', { destination: dallas }).url).searchParams;

      expect(params.get('daddr')).toBe('32.776700,-96.797000');
      expect(params.get('dirflg')).toBe('d');
    });

    it('never sends a label as a search query', () => {
      // Regression, found on a device: Apple Maps treats `q` as a *search*,
      // not a label. Sent alongside daddr it ignored our coordinates entirely
      // and routed to whatever real gas station it found near the user — so
      // every station in the app navigated to the same Chevron.
      const params = new URL(
        buildDirectionsUrl('apple', {
          destination: dallas,
          label: "Buc-ee's, 5475 Market St",
        }).url,
      ).searchParams;

      expect(params.has('q')).toBe(false);
      expect(params.get('daddr')).toBe('32.776700,-96.797000');
    });

    it('routes distinct stations to distinct destinations', () => {
      const urls = [dallas, waco, okc].map(
        (c) => buildDirectionsUrl('apple', { destination: c, label: 'Chevron' }).url,
      );
      expect(new Set(urls).size).toBe(3);
    });

    it('relays every intermediate stop, since it supports no waypoints', () => {
      const { dropped } = buildDirectionsUrl('apple', {
        destination: wichita,
        waypoints: [waco, dallas],
      });
      expect(dropped).toEqual([waco, dallas]);
    });
  });

  it('never silently loses a stop', () => {
    // Anything that doesn't fit has to come back for the relay, or the plan
    // quietly shrinks and the driver misses a fill-up they were counting on.
    const waypoints = [waco, dallas, okc];

    for (const app of Object.keys(NAV_APPS) as NavApp[]) {
      const { url, dropped } = buildDirectionsUrl(app, { destination: wichita, waypoints });
      const carried = new URL(url).searchParams.get('waypoints')?.split('|').length ?? 0;

      expect(carried + dropped.length).toBe(waypoints.length);
    }
  });
});

describe('fitsInOneHandoff', () => {
  it('knows a multi-stop plan does not fit anywhere', () => {
    // The finding that forces the relay design: no nav app takes a real plan.
    expect(fitsInOneHandoff('apple', 2)).toBe(false);
    expect(fitsInOneHandoff('waze', 3)).toBe(false);
    expect(fitsInOneHandoff('google', 5)).toBe(false);
  });

  it('accepts a single destination everywhere', () => {
    for (const app of Object.keys(NAV_APPS) as NavApp[]) {
      expect(fitsInOneHandoff(app, 1)).toBe(true);
    }
  });

  it('reflects each app documented capacity', () => {
    expect(fitsInOneHandoff('google', 4)).toBe(true);
    expect(fitsInOneHandoff('waze', 2)).toBe(true);
    expect(fitsInOneHandoff('apple', 1)).toBe(true);
  });
});
