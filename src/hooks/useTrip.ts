import { useCallback, useEffect, useMemo, useState } from 'react';

import { activeFeed } from '../data/priceFeed';
import { activeRouteProvider } from '../data/routeProvider';
import { stationsAlongRoute } from '../lib/route';
import { fetchStationsAlongRoute } from '../data/routeStations';
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
  /** Station ids the driver picked themselves, which the plan must route through. */
  chosen: string[];
  /** Pick `stationId` for a leg, dropping `replacing` if it was the choice there. */
  choose: (stationId: string, replacing?: string) => void;
  /** Give the leg back to the planner. */
  unchoose: (stationId: string) => void;
  /** Puts every rejected station back in the running. */
  restoreRejected: () => void;
  clear: () => void;
}

export interface UseTripOptions {
  origin: LatLng | undefined;
  vehicle: Vehicle | undefined;
  grade: FuelGrade;
  /** Dollars per rating point, from the driver's price-vs-quality preference. */
  ratingDollars?: number;
}

/**
 * Plans a trip and tracks which of its off-route stops the driver has accepted.
 *
 * Nothing here changes the driver's navigation on its own, and a stop that
 * pulls them off their route is not part of the suggestion until they say so.
 * Rejections are remembered and planned around, so a "no" stays a no instead of
 * resurfacing on the next recalculation.
 */
export function useTrip({
  origin,
  vehicle,
  grade,
  ratingDollars,
}: UseTripOptions): TripState {
  const [route, setRoute] = useState<Route | undefined>();
  const [plan, setPlan] = useState<TripPlan | undefined>();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | undefined>();

  const [approved, setApproved] = useState<string[]>([]);
  const [rejected, setRejected] = useState<Station[]>([]);

  const [chosen, setChosen] = useState<string[]>([]);

  /** Re-runs the planner against the current rejections and choices. */
  /**
   * Stations along the current route, fetched once when the trip is planned.
   *
   * Not the map's stations: those are whatever the visible region loaded, so
   * zooming out far enough to see a long trip left the planner with nothing.
   */
  const [routeStations, setRouteStations] = useState<Station[]>([]);

  const replan = useCallback(
    (
      forRoute: Route,
      rejectedStations: Station[],
      driver: Vehicle,
      chosenIds: string[] = [],
    ) => {
      const corridor = stationsAlongRoute(routeStations, forRoute);
      return planTrip({
        corridor,
        route: forRoute,
        vehicle: driver,
        grade,
        ratingDollars,
        excludedStationIds: rejectedStations.map((s) => s.id),
        pinnedStationIds: chosenIds,
      });
    },
    [routeStations, grade, ratingDollars],
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
        // Ask the feed for stations along the whole route before planning, so
        // the plan does not depend on where the map is pointed.
        const along = await fetchStationsAlongRoute(activeFeed, fetched);

        // A new trip starts with a clean slate: approvals and rejections were
        // about the old route's stops.
        setRoute(fetched);
        setRouteStations(along);
        setApproved([]);
        setRejected([]);
        setChosen([]);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Could not plan that trip.');
        setRoute(undefined);
        setPlan(undefined);
      } finally {
        setLoading(false);
      }
    },
    [origin, vehicle],
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

      // Turning a stop down also drops it as a choice, or the planner would be
      // told to route through a station the driver just rejected.
      const nextChosen = chosen.filter((id) => id !== station.id);

      // Dropping a stop can shuffle the whole chain, so the effect below
      // re-plans from scratch rather than splicing it out — the stops after it
      // may no longer be reachable.
      setRejected(nextRejected);
      setChosen(nextChosen);
    },
    [route, vehicle, rejected, chosen],
  );

  /**
   * Swaps one stop for another the driver picked.
   *
   * `replacing` is dropped from the choices at the same time, so choosing a
   * second station for the same leg replaces the first rather than demanding
   * the plan visit both.
   */
  const choose = useCallback(
    (stationId: string, replacing?: string) => {
      if (!route || !vehicle) return;
      const nextChosen = [
        ...chosen.filter((id) => id !== replacing && id !== stationId),
        stationId,
      ];
      setChosen(nextChosen);
    },
    [route, vehicle, chosen],
  );

  /** Hands the leg back to the planner. */
  const unchoose = useCallback(
    (stationId: string) => {
      if (!route || !vehicle) return;
      setChosen(chosen.filter((id) => id !== stationId));
    },
    [route, vehicle, chosen],
  );

  const restoreRejected = useCallback(() => {
    if (!route || !vehicle) return;
    setRejected([]);
  }, [route, vehicle]);

  /**
   * The plan is derived state, and this is the only place it is computed.
   *
   * It used to be set by hand in five places, which meant every input had to
   * be remembered at each of them — and fuel level was remembered at none. A
   * driver who topped up mid-trip kept a plan built for the tank they no
   * longer had, which is the one number a fuel app must not be stale about.
   * Grade and the price-vs-quality dial were stale for the same reason.
   *
   * Rejections, choices and approvals deliberately survive: they are the
   * driver's decisions about *stations*, not about the tank.
   */
  useEffect(() => {
    if (!route || !vehicle) return;
    setPlan(replan(route, rejected, vehicle, chosen));
  }, [route, vehicle, rejected, chosen, replan]);

  const clear = useCallback(() => {
    setRoute(undefined);
    setPlan(undefined);
    setError(undefined);
    setApproved([]);
    setRejected([]);
    setChosen([]);
    setRouteStations([]);
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
    chosen,
    choose,
    unchoose,
    restoreRejected,
    clear,
  };
}
