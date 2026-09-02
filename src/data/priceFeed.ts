import type { PriceReport, Region, Station } from '../types';

/**
 * The single seam between Guzzler and whoever supplies its prices.
 *
 * Everything above this interface (screens, hooks, pricing math) is written
 * against it, so swapping the mock for a real provider — an aggregator API, an
 * OPIS contract, or our own crowdsourced backend — is a one-line change in
 * `activeFeed` below plus one new file implementing this interface.
 */
export interface PriceFeed {
  /** Human-readable name, shown in the UI so users know where prices came from. */
  readonly name: string;

  /**
   * Fetch stations whose coordinates fall inside `region`.
   *
   * Implementations should treat this as cheap and idempotent — it is called
   * on every settled map pan, so real providers will want request coalescing
   * and a short-lived cache behind this method.
   */
  getStationsInRegion(region: Region, signal?: AbortSignal): Promise<Station[]>;

  /**
   * Submit a user-observed price. Optional: read-only providers omit it, and
   * the UI hides the report affordance when it is absent.
   */
  submitReport?(report: PriceReport): Promise<void>;
}

import { MockPriceFeed } from './mockPriceFeed';

/**
 * The feed the app currently runs on.
 *
 * Swap this for a real implementation when a data source is chosen. See
 * `docs/DATA_SOURCES.md` for the tradeoffs between the candidate providers.
 */
export const activeFeed: PriceFeed = new MockPriceFeed();
