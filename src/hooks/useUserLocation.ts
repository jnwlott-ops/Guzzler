import * as Location from 'expo-location';
import { useEffect, useState } from 'react';

import type { LatLng } from '../types';

/** Downtown Austin — where the map starts before we know where the user is. */
export const FALLBACK_LOCATION: LatLng = {
  latitude: 30.2672,
  longitude: -97.7431,
};

export type LocationStatus = 'pending' | 'granted' | 'denied' | 'error';

export interface UserLocationState {
  location: LatLng | undefined;
  status: LocationStatus;
}

/**
 * Asks for foreground location once and reports the user's position.
 *
 * Denial is a normal path, not an error: the map falls back to a default region
 * and stays fully usable, since a traveler comparing prices along a route cares
 * more about the map than about their own dot.
 */
export function useUserLocation(): UserLocationState {
  const [location, setLocation] = useState<LatLng | undefined>();
  const [status, setStatus] = useState<LocationStatus>('pending');

  useEffect(() => {
    let cancelled = false;

    (async () => {
      try {
        const { status: permission } = await Location.requestForegroundPermissionsAsync();
        if (cancelled) return;

        if (permission !== Location.PermissionStatus.GRANTED) {
          setStatus('denied');
          return;
        }

        const position = await Location.getCurrentPositionAsync({
          accuracy: Location.Accuracy.Balanced,
        });
        if (cancelled) return;

        setLocation({
          latitude: position.coords.latitude,
          longitude: position.coords.longitude,
        });
        setStatus('granted');
      } catch {
        if (!cancelled) setStatus('error');
      }
    })();

    return () => {
      cancelled = true;
    };
  }, []);

  return { location, status };
}
