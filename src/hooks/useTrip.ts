import { useCallback, useState } from 'react';

import { activeRouteProvider } from '../data/routeProvider';
import { stationsAlongRoute } from '../lib/route';
import { planTrip, type TripPlan } from '../lib/tripPlanner';
import type { FuelGrade, LatLng, Route, Station, Vehicle } from '../types';

export interface TripState {
  route: Route | undefined;
  plan: TripPlan | undefined;
  loading: boolean;
  error: string | undefined;
  /** Fetches a route and plans stops along it. */
  start: (destination: string) => Promise<void>;
  clear: () => void;
}

export interface UseTripOptions {
  origin: LatLng | undefined;
  vehicle: Vehicle | undefined;
  grade: FuelGrade;
  /** Stations to plan around — whatever the feed has loaded. */
  stations: Station[];
}

/**
 * Plans a trip and its fuel stops.
 *
 * The plan is computed and handed back for the driver to accept; nothing here
 * changes their navigation on its own. Automating the *suggestion* is useful;
 * automating the *decision* would mean a wrong call strands someone, and the
 * driver always knows things we don't.
 */
export function useTrip({ origin, vehicle, grade, stations }: UseTripOptions): TripState {
  const [route, setRoute] = useState<Route | undefined>();
  const [plan, setPlan] = useState<TripPlan | undefined>();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | undefined>();

  const start = useCallback(
    async (destination: string) => {
      if (!origin) {
        setError('Waiting for your location.');
        return;
      }
      if (!vehicle) {
        setError('Add your vehicle first so we know your range.');
        return;
      }

      setLoading(true);
      setError(undefined);
      try {
        const fetched = await activeRouteProvider.getRoute(origin, destination);
        setRoute(fetched);

        // The corridor is drawn from stations already loaded for the visible
        // region, so a long trip will only see stops near where the driver is
        // looking. A real provider should fetch along the whole polyline —
        // noted in docs/ROUTING.md.
        const corridor = stationsAlongRoute(stations, fetched);
        setPlan(planTrip({ corridor, route: fetched, vehicle, grade }));
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Could not plan that trip.');
        setRoute(undefined);
        setPlan(undefined);
      } finally {
        setLoading(false);
      }
    },
    [origin, vehicle, grade, stations],
  );

  const clear = useCallback(() => {
    setRoute(undefined);
    setPlan(undefined);
    setError(undefined);
  }, []);

  return { route, plan, loading, error, start, clear };
}
