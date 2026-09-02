import AsyncStorage from '@react-native-async-storage/async-storage';
import { useCallback, useEffect, useState } from 'react';

import { DEFAULT_PRICE_WEIGHT } from '../lib/value';
import { PRIORITY_PRESETS, type Preferences, type PriorityPresetId } from '../types';

const STORAGE_KEY = 'guzzler.preferences.v1';

const DEFAULTS: Preferences = { priceWeight: DEFAULT_PRICE_WEIGHT };

export interface PreferencesState {
  preferences: Preferences;
  /** Which named preset the current weight corresponds to. */
  presetId: PriorityPresetId;
  setPreset: (id: PriorityPresetId) => Promise<void>;
}

/** Nearest named preset to a stored weight, so the UI always has a selection. */
function presetForWeight(priceWeight: number): PriorityPresetId {
  // Widened from the tuple's literal type so the loop can reassign across presets.
  let closest: (typeof PRIORITY_PRESETS)[number] = PRIORITY_PRESETS[0];
  for (const preset of PRIORITY_PRESETS) {
    if (Math.abs(preset.priceWeight - priceWeight) < Math.abs(closest.priceWeight - priceWeight)) {
      closest = preset;
    }
  }
  return closest.id;
}

/**
 * The driver's price-vs-stop-quality preference, persisted locally.
 *
 * Defaults rather than blocking: the map renders on the default weighting while
 * the stored value loads, so there's no empty first frame.
 */
export function usePreferences(): PreferencesState {
  const [preferences, setPreferences] = useState<Preferences>(DEFAULTS);

  useEffect(() => {
    let cancelled = false;

    (async () => {
      try {
        const raw = await AsyncStorage.getItem(STORAGE_KEY);
        if (cancelled || !raw) return;

        const parsed = JSON.parse(raw) as Partial<Preferences>;
        if (typeof parsed.priceWeight === 'number' && Number.isFinite(parsed.priceWeight)) {
          setPreferences({ priceWeight: Math.min(1, Math.max(0, parsed.priceWeight)) });
        }
      } catch {
        // A corrupt or unreadable preference just means we keep the default.
      }
    })();

    return () => {
      cancelled = true;
    };
  }, []);

  const setPreset = useCallback(async (id: PriorityPresetId) => {
    const preset = PRIORITY_PRESETS.find((p) => p.id === id);
    if (!preset) return;

    const next: Preferences = { priceWeight: preset.priceWeight };
    setPreferences(next);
    try {
      await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(next));
    } catch {
      // Non-fatal: the choice just won't survive a restart.
    }
  }, []);

  return {
    preferences,
    presetId: presetForWeight(preferences.priceWeight),
    setPreset,
  };
}
