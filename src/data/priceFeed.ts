import type { PriceReport, RatingSubmission, Region, Route, Station } from '../types';

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
   * Widest region this feed will answer for, in degrees.
   *
   * Zoomed out past this it returns nothing, and the UI needs to know that so
   * it can say "zoom in" rather than "no prices here" — which reads as "there
   * is no fuel in Georgia" and is a very different claim.
   */
  readonly maxSpanDegrees?: number;

  /**
   * Fetch stations whose coordinates fall inside `region`.
   *
   * Implementations should treat this as cheap and idempotent — it is called
   * on every settled map pan, so real providers will want request coalescing
   * and a short-lived cache behind this method.
   */
  getStationsInRegion(region: Region, signal?: AbortSignal): Promise<Station[]>;

  /**
   * Stations along a whole route, when the provider can answer that directly.
   *
   * Optional. Without it, `fetchStationsAlongRoute` walks the polyline in
   * overlapping windows, which any region feed can serve. Worth implementing:
   * NREL's alternative-fuel API has a stations-along-a-route endpoint that
   * does this server-side in one request.
   */
  getStationsAlongRoute?(
    route: Route,
    corridorMiles: number,
    signal?: AbortSignal,
  ): Promise<Station[]>;

  /**
   * Submit a user-observed price. Optional: read-only providers omit it, and
   * the UI hides the report affordance when it is absent.
   */
  submitReport?(report: PriceReport): Promise<void>;

  /**
   * Submit a driver's rating of a stop. Optional for the same reason.
   *
   * Ratings are ours regardless of who supplies prices — a licensed price feed
   * has no opinion on whether the restroom is clean — so in production this
   * will likely hit our own backend even when prices come from a third party.
   */
  submitRating?(rating: RatingSubmission): Promise<void>;
}

import { MockPriceFeed } from './mockPriceFeed';

/**
 * The feed the app currently runs on.
 *
 * Swap this for a real implementation when a data source is chosen. See
 * `docs/DATA_SOURCES.md` for the tradeoffs between the candidate providers.
 */
export const activeFeed: PriceFeed = new MockPriceFeed();
