import AsyncStorage from '@react-native-async-storage/async-storage';
import { useCallback, useEffect, useState } from 'react';

import type { Vehicle } from '../types';

const STORAGE_KEY = 'guzzler.vehicle.v1';

/** Sensible starting point: a mid-size sedan, so the form is never empty. */
export const DEFAULT_VEHICLE: Vehicle = {
  label: 'My car',
  fuelType: 'gas',
  capacity: 14,
  efficiency: 30,
  level: 0.5,
};

export interface VehicleState {
  vehicle: Vehicle | undefined;
  /** False until the stored profile has been read, so the UI can avoid a flash. */
  ready: boolean;
  save: (vehicle: Vehicle) => Promise<void>;
  clear: () => Promise<void>;
}

/** Narrows unknown parsed JSON to a Vehicle, rejecting anything malformed. */
function parseVehicle(raw: string): Vehicle | undefined {
  try {
    const parsed = JSON.parse(raw) as Partial<Vehicle>;
    if (
      typeof parsed.capacity !== 'number' ||
      typeof parsed.efficiency !== 'number' ||
      typeof parsed.level !== 'number' ||
      (parsed.fuelType !== 'gas' && parsed.fuelType !== 'ev')
    ) {
      return undefined;
    }
    return {
      label: typeof parsed.label === 'string' ? parsed.label : DEFAULT_VEHICLE.label,
      fuelType: parsed.fuelType,
      capacity: parsed.capacity,
      efficiency: parsed.efficiency,
      level: parsed.level,
    };
  } catch {
    // A corrupt profile shouldn't wedge the app — fall back to no vehicle.
    return undefined;
  }
}

/**
 * The driver's saved vehicle profile.
 *
 * Persisted locally rather than to an account: it's small, it's needed before
 * any sign-in exists, and a tank size is not worth a round trip.
 */
export function useVehicle(): VehicleState {
  const [vehicle, setVehicle] = useState<Vehicle | undefined>();
  const [ready, setReady] = useState(false);

  useEffect(() => {
    let cancelled = false;

    (async () => {
      try {
        const raw = await AsyncStorage.getItem(STORAGE_KEY);
        if (cancelled) return;
        if (raw) setVehicle(parseVehicle(raw));
      } catch {
        // Storage unavailable is survivable; the driver just re-enters it.
      } finally {
        if (!cancelled) setReady(true);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, []);

  const save = useCallback(async (next: Vehicle) => {
    // Update state first so the map responds immediately even if the write is
    // slow or fails outright.
    setVehicle(next);
    try {
      await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(next));
    } catch {
      // Non-fatal: the profile just won't survive a restart.
    }
  }, []);

  const clear = useCallback(async () => {
    setVehicle(undefined);
    try {
      await AsyncStorage.removeItem(STORAGE_KEY);
    } catch {
      // Same: losing the delete only means it reappears next launch.
    }
  }, []);

  return { vehicle, ready, save, clear };
}
