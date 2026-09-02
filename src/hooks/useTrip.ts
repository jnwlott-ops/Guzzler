import { useCallback, useMemo, useState } from 'react';

import { activeRouteProvider } from '../data/routeProvider';
import { stationsAlongRoute } from '../lib/route';
import {
  isPlanLive,
  planTrip,
  stopsAwaitingApproval,
  type PlannedStop,
  type TripPlan,
} from '../lib/tripPlanner';
import type { FuelGrade, LatLng, Route, Station, Vehicle } from '../types';

export interface TripState {
  route: Route | undefined;
  plan: TripPlan | undefined;
  loading: boolean;
  error: string | undefined;
  /** Off-route stops still waiting on a yes or no. */
  pending: PlannedStop[];
  /** True once every off-route stop has been accepted. */
  live: boolean;
  /** Stations the driver turned down, in case they want them back. */
  rejected: Station[];
  start: (destination: string) => Promise<void>;
  approve: (stationId: string) => void;
  reject: (station: Station) => void;
  /** Puts every rejected station back in the running. */
  restoreRejected: () => void;
  clear: () => void;
}

export interface UseTripOptions {
  origin: LatLng | undefined;
  vehicle: Vehicle | undefined;
  grade: FuelGrade;
  stations: Station[];
}

/**
 * Plans a trip and tracks which of its off-route stops the driver has accepted.
 *
 * Nothing here changes the driver's navigation on its own, and a stop that
 * pulls them off their route is not part of the suggestion until they say so.
 * Rejections are remembered and planned around, so a "no" stays a no instead of
 * resurfacing on the next recalculation.
 */
export function useTrip({ origin, vehicle, grade, stations }: UseTripOptions): TripState {
  const [route, setRoute] = useState<Route | undefined>();
  const [plan, setPlan] = useState<TripPlan | undefined>();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | undefined>();

  const [approved, setApproved] = useState<string[]>([]);
  const [rejected, setRejected] = useState<Station[]>([]);

  /** Re-runs the planner for a route against the current rejection list. */
  const replan = useCallback(
    (forRoute: Route, rejectedStations: Station[], driver: Vehicle) => {
      const corridor = stationsAlongRoute(stations, forRoute);
      return planTrip({
        corridor,
        route: forRoute,
        vehicle: driver,
        grade,
        excludedStationIds: rejectedStations.map((s) => s.id),
      });
    },
    [stations, grade],
  );

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

        // A new trip starts with a clean slate: approvals and rejections were
        // about the old route's stops.
        setRoute(fetched);
        setApproved([]);
        setRejected([]);
        setPlan(replan(fetched, [], vehicle));
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Could not plan that trip.');
        setRoute(undefined);
        setPlan(undefined);
      } finally {
        setLoading(false);
      }
    },
    [origin, vehicle, grade, replan],
  );

  const approve = useCallback((stationId: string) => {
    setApproved((current) => (current.includes(stationId) ? current : [...current, stationId]));
  }, []);

  const reject = useCallback(
    (station: Station) => {
      if (!route || !vehicle) return;

      const nextRejected = rejected.some((s) => s.id === station.id)
        ? rejected
        : [...rejected, station];

      setRejected(nextRejected);
      // Dropping a stop can shuffle the whole chain, so re-plan rather than
      // splicing it out — the stops after it may no longer be reachable.
      setPlan(replan(route, nextRejected, vehicle));
    },
    [route, vehicle, rejected, replan],
  );

  const restoreRejected = useCallback(() => {
    if (!route || !vehicle) return;
    setRejected([]);
    setPlan(replan(route, [], vehicle));
  }, [route, vehicle, replan]);

  const clear = useCallback(() => {
    setRoute(undefined);
    setPlan(undefined);
    setError(undefined);
    setApproved([]);
    setRejected([]);
  }, []);

  const pending = useMemo(
    () => (plan ? stopsAwaitingApproval(plan, approved) : []),
    [plan, approved],
  );

  return {
    route,
    plan,
    loading,
    error,
    pending,
    live: plan !== undefined && isPlanLive(plan, approved),
    rejected,
    start,
    approve,
    reject,
    restoreRejected,
    clear,
  };
}
