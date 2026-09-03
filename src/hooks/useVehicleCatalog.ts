import { useCallback, useEffect, useRef, useState } from 'react';

import {
  activeVehicleCatalog,
  type CatalogOption,
  type CatalogVehicle,
} from '../data/vehicleCatalog';

type Level = 'year' | 'make' | 'model' | 'trim';

/** What a dead connection looks like across web, iOS and Android. */
const OFFLINE = /failed to fetch|network request failed|load failed|networkerror/i;

/**
 * Turns a thrown value into something worth showing a driver.
 *
 * Messages the catalog raises itself are written for this screen and pass
 * through. A network failure arrives as the platform's own wording — "Failed
 * to fetch" on web, "Network request failed" on native — which tells someone
 * parked at a pump nothing about what to do next.
 */
function describe(caught: unknown): string {
  const message = caught instanceof Error ? caught.message : '';
  if (message === '' || OFFLINE.test(message)) {
    return "Couldn't reach the vehicle database — you may be offline.";
  }
  return message;
}

interface Selection {
  year?: CatalogOption;
  make?: CatalogOption;
  model?: CatalogOption;
  trim?: CatalogOption;
}

export interface VehicleCatalogState {
  selection: Selection;
  years: CatalogOption[];
  makes: CatalogOption[];
  models: CatalogOption[];
  trims: CatalogOption[];
  loading: Level | 'details' | undefined;
  error: string | undefined;
  /** Set once a trim resolves. The form reads its numbers from here. */
  resolved: CatalogVehicle | undefined;
  choose: (level: Level, option: CatalogOption) => void;
}

/**
 * Drives the year → make → model → trim cascade.
 *
 * Every level clears the ones below it, because a make that exists in 2019 may
 * not in 2004 and leaving a stale "Camry" under a newly-picked "Ford" would
 * submit a vehicle that never existed.
 *
 * Requests are sequenced with a token rather than cancelled outright: someone
 * tapping through makes quickly fires overlapping fetches, and the only thing
 * that matters is that a slow earlier response cannot overwrite a fast later
 * one. Abort signals handle the wasted bytes; the token handles correctness.
 *
 * Clearing on reopen lives in here rather than in the caller, and that is
 * load-bearing. When the modal did it from its own open effect, the clear ran
 * *after* this hook's mount effect had already started fetching years — it
 * bumped the token, so the response that came back was judged stale and thrown
 * away. Offline, that meant the failure was swallowed too: no list, no
 * spinner, no error, just four dead dropdowns. Effects run in the order hooks
 * are called, so the reset below is declared first and always wins the race.
 */
export function useVehicleCatalog(enabled: boolean): VehicleCatalogState {
  const [selection, setSelection] = useState<Selection>({});
  const [years, setYears] = useState<CatalogOption[]>([]);
  const [makes, setMakes] = useState<CatalogOption[]>([]);
  const [models, setModels] = useState<CatalogOption[]>([]);
  const [trims, setTrims] = useState<CatalogOption[]>([]);
  const [loading, setLoading] = useState<VehicleCatalogState['loading']>(undefined);
  const [error, setError] = useState<string | undefined>();
  const [resolved, setResolved] = useState<CatalogVehicle | undefined>();

  const token = useRef(0);

  const run = useCallback(
    async <T,>(
      stage: VehicleCatalogState['loading'],
      work: (signal: AbortSignal) => Promise<T>,
      apply: (value: T) => void,
    ) => {
      const mine = ++token.current;
      const controller = new AbortController();
      setLoading(stage);
      setError(undefined);
      try {
        const value = await work(controller.signal);
        if (mine !== token.current) return;
        apply(value);
      } catch (caught) {
        if (mine !== token.current) return;
        setError(describe(caught));
      } finally {
        if (mine === token.current) setLoading(undefined);
      }
    },
    [],
  );

  // Reopening the form drops last time's selections. Years are kept: the list
  // of model years does not change while the app is open.
  const wasEnabled = useRef(false);
  useEffect(() => {
    if (enabled && !wasEnabled.current) {
      token.current += 1;
      setSelection({});
      setMakes([]);
      setModels([]);
      setTrims([]);
      setResolved(undefined);
      setError(undefined);
      setLoading(undefined);
    }
    wasEnabled.current = enabled;
  }, [enabled]);

  useEffect(() => {
    if (!enabled || years.length > 0) return;
    void run('year', (signal) => activeVehicleCatalog.years(signal), setYears);
  }, [enabled, years.length, run]);

  const choose = useCallback(
    (level: Level, option: CatalogOption) => {
      if (level === 'year') {
        setSelection({ year: option });
        setMakes([]);
        setModels([]);
        setTrims([]);
        setResolved(undefined);
        void run('make', (signal) => activeVehicleCatalog.makes(option.value, signal), setMakes);
        return;
      }

      if (level === 'make') {
        setSelection((prev) => ({ year: prev.year, make: option }));
        setModels([]);
        setTrims([]);
        setResolved(undefined);
        void run(
          'model',
          (signal) =>
            activeVehicleCatalog.models(selection.year?.value ?? '', option.value, signal),
          setModels,
        );
        return;
      }

      if (level === 'model') {
        setSelection((prev) => ({ year: prev.year, make: prev.make, model: option }));
        setTrims([]);
        setResolved(undefined);
        void run(
          'trim',
          (signal) =>
            activeVehicleCatalog.trims(
              selection.year?.value ?? '',
              selection.make?.value ?? '',
              option.value,
              signal,
            ),
          setTrims,
        );
        return;
      }

      setSelection((prev) => ({ ...prev, trim: option }));
      void run(
        'details',
        (signal) => activeVehicleCatalog.details(option.value, signal),
        setResolved,
      );
    },
    [run, selection.year, selection.make],
  );

  return { selection, years, makes, models, trims, loading, error, resolved, choose };
}
