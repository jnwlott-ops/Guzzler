import AsyncStorage from '@react-native-async-storage/async-storage';
import { useCallback, useEffect, useState } from 'react';

import type { Station } from '../types';

const STORAGE_KEY = 'guzzler.favorites.v1';

/**
 * A saved place, stored in full rather than by id.
 *
 * By id would be smaller, but favorites have to work when the driver is 200
 * miles away and the feed hasn't loaded that region — an approach alert can't
 * wait for a station to come back into view before it knows where it is.
 */
export interface Favorite {
  id: string;
  name: string;
  address: string;
  coordinate: Station['coordinate'];
  savedAt: string;
}

export interface FavoritesState {
  favorites: Favorite[];
  isFavorite: (stationId: string) => boolean;
  toggle: (station: Station) => Promise<void>;
  ready: boolean;
}

function parseFavorites(raw: string): Favorite[] {
  try {
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) return [];

    return parsed.filter((entry): entry is Favorite => {
      if (typeof entry !== 'object' || entry === null) return false;
      const f = entry as Partial<Favorite>;
      return (
        typeof f.id === 'string' &&
        typeof f.name === 'string' &&
        typeof f.coordinate?.latitude === 'number' &&
        typeof f.coordinate?.longitude === 'number'
      );
    });
  } catch {
    return [];
  }
}

/** The driver's saved stations and restaurants, persisted locally. */
export function useFavorites(): FavoritesState {
  const [favorites, setFavorites] = useState<Favorite[]>([]);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    let cancelled = false;

    (async () => {
      try {
        const raw = await AsyncStorage.getItem(STORAGE_KEY);
        if (!cancelled && raw) setFavorites(parseFavorites(raw));
      } catch {
        // Unreadable storage just means an empty list.
      } finally {
        if (!cancelled) setReady(true);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, []);

  const persist = useCallback(async (next: Favorite[]) => {
    // State first so the star flips instantly, even if the write is slow.
    setFavorites(next);
    try {
      await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(next));
    } catch {
      // Non-fatal: the change just won't survive a restart.
    }
  }, []);

  const toggle = useCallback(
    async (station: Station) => {
      const existing = favorites.some((f) => f.id === station.id);

      await persist(
        existing
          ? favorites.filter((f) => f.id !== station.id)
          : [
              ...favorites,
              {
                id: station.id,
                name: station.name,
                address: station.address,
                coordinate: station.coordinate,
                savedAt: new Date().toISOString(),
              },
            ],
      );
    },
    [favorites, persist],
  );

  return {
    favorites,
    isFavorite: useCallback(
      (stationId: string) => favorites.some((f) => f.id === stationId),
      [favorites],
    ),
    toggle,
    ready,
  };
}
