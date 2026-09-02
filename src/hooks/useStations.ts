import { useEffect, useRef, useState } from 'react';

import { activeFeed } from '../data/priceFeed';
import type { PriceReport, Region, Station } from '../types';

export interface StationsState {
  stations: Station[];
  loading: boolean;
  error: string | undefined;
  /** Submits a price and refreshes the current region. No-op on read-only feeds. */
  reportPrice: ((report: PriceReport) => Promise<void>) | undefined;
}

/** Wait this long after the map stops moving before fetching, to avoid a
 *  request per frame while the user is still panning. */
const SETTLE_MS = 400;

/**
 * Keeps the station list in sync with the visible map region.
 *
 * Debounces on region changes and aborts in-flight requests when the region
 * moves again, so a fast pan across a city costs one request rather than fifty.
 */
export function useStations(region: Region | undefined): StationsState {
  const [stations, setStations] = useState<Station[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | undefined>();

  // Bumped to force a refetch of the current region after a price report.
  const [refreshToken, setRefreshToken] = useState(0);

  // Held in a ref so reportPrice can refetch without being re-created on
  // every region change.
  const regionRef = useRef(region);
  regionRef.current = region;

  useEffect(() => {
    if (!region) return;

    const controller = new AbortController();
    let cancelled = false;

    const timer = setTimeout(async () => {
      setLoading(true);
      try {
        const result = await activeFeed.getStationsInRegion(region, controller.signal);
        if (cancelled) return;
        setStations(result);
        setError(undefined);
      } catch (err) {
        if (cancelled || controller.signal.aborted) return;
        setError(err instanceof Error ? err.message : 'Could not load prices');
      } finally {
        if (!cancelled) setLoading(false);
      }
    }, SETTLE_MS);

    return () => {
      cancelled = true;
      controller.abort();
      clearTimeout(timer);
    };
    // Depending on the region's fields rather than the object keeps this from
    // refiring on every onRegionChange that reports an identical window.
  }, [
    region?.latitude,
    region?.longitude,
    region?.latitudeDelta,
    region?.longitudeDelta,
    refreshToken,
  ]);

  // Read-only feeds omit submitReport; the UI hides the report button when
  // reportPrice comes back undefined.
  const canReport = typeof activeFeed.submitReport === 'function';

  return {
    stations,
    loading,
    error,
    reportPrice: canReport
      ? async (report: PriceReport) => {
          await activeFeed.submitReport!(report);
          setRefreshToken((token) => token + 1);
        }
      : undefined,
  };
}
