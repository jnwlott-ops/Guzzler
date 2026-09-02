/**
 * Core domain types for Guzzler.
 *
 * These are deliberately feed-agnostic: whether prices come from a licensed
 * feed (OPIS), a marketplace aggregator, or our own crowdsourced reports, they
 * get normalized into these shapes before reaching the UI.
 */

/** Fuel grades we surface in the UI, in the order they appear at the pump. */
export const FUEL_GRADES = ['regular', 'midgrade', 'premium', 'diesel'] as const;

export type FuelGrade = (typeof FUEL_GRADES)[number];

export const FUEL_GRADE_LABELS: Record<FuelGrade, string> = {
  regular: 'Regular',
  midgrade: 'Mid',
  premium: 'Premium',
  diesel: 'Diesel',
};

/** A geographic point. Matches react-native-maps' LatLng shape. */
export interface LatLng {
  latitude: number;
  longitude: number;
}

/** The visible map window, as reported by react-native-maps' onRegionChange. */
export interface Region extends LatLng {
  latitudeDelta: number;
  longitudeDelta: number;
}

/**
 * Where a given price came from. This drives how much we trust it in the UI —
 * a price a driver reported four days ago deserves a different treatment than
 * one pulled from a paid feed twenty minutes ago.
 */
export type PriceSource = 'feed' | 'crowdsourced' | 'station-reported';

/** A single grade's price at a single station. */
export interface PriceQuote {
  grade: FuelGrade;
  /** Price per gallon in USD. */
  price: number;
  /** When this price was observed, as an ISO 8601 timestamp. */
  reportedAt: string;
  source: PriceSource;
}

/** A gas station plus whatever prices we currently know for it. */
export interface Station {
  id: string;
  name: string;
  /** Brand used for logo lookup and grouping, e.g. "Shell", "Costco". */
  brand: string;
  address: string;
  coordinate: LatLng;
  /** Known prices, keyed by grade. A station may not report every grade. */
  prices: Partial<Record<FuelGrade, PriceQuote>>;
}

/** A price a user submits from the pump. */
export interface PriceReport {
  stationId: string;
  grade: FuelGrade;
  price: number;
  reportedAt: string;
}
