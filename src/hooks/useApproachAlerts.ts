import { useEffect, useRef, useState } from 'react';

import { updateApproaches, type ApproachAlert } from '../lib/approach';
import type { Favorite } from './useFavorites';
import type { LatLng } from '../types';

export interface ApproachState {
  alerts: ApproachAlert<Favorite>[];
  /** Silences one favorite for the rest of this approach. */
  dismiss: (placeId: string) => void;
}

/**
 * Watches for favorites coming up ahead.
 *
 * Foreground only: this fires while the app is open and receiving location
 * updates. Real "tell me before I pass it" behavior with the app closed needs
 * background geofencing — see docs/FAVORITES.md for what that costs.
 */
export function useApproachAlerts(
  origin: LatLng | undefined,
  favorites: Favorite[],
): ApproachState {
  const [alerts, setAlerts] = useState<ApproachAlert<Favorite>[]>([]);

  // Which favorites are mid-alert, so the hysteresis in updateApproaches has
  // its previous state. A ref rather than state: it feeds the next computation
  // and shouldn't itself trigger a render.
  const alertingRef = useRef<string[]>([]);

  // Favorites the driver waved off on this pass. Cleared when they leave.
  const dismissedRef = useRef<Set<string>>(new Set());

  useEffect(() => {
    const { alerts: next, alertingIds } = updateApproaches(
      origin,
      favorites,
      alertingRef.current,
    );

    // Anything no longer alerting has been passed — let it alert again next time.
    for (const id of dismissedRef.current) {
      if (!alertingIds.includes(id)) dismissedRef.current.delete(id);
    }

    alertingRef.current = alertingIds;
    setAlerts(next.filter((alert) => !dismissedRef.current.has(alert.place.id)));
  }, [origin?.latitude, origin?.longitude, favorites]);

  return {
    alerts,
    dismiss: (placeId: string) => {
      dismissedRef.current.add(placeId);
      setAlerts((current) => current.filter((alert) => alert.place.id !== placeId));
    },
  };
}
