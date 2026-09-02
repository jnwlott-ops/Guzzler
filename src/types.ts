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

/**
 * Amenities a station may offer.
 *
 * These are facts, not opinions — a station either has a car wash or it
 * doesn't. Quality judgements live in `StationRatings` instead, because "has a
 * restroom" and "has a restroom worth stopping for" are very different claims.
 */
export const AMENITIES = [
  'restroom',
  'food',
  'coffee',
  'airPump',
  'evCharging',
  'carWash',
  'truckAccessible',
  'open24h',
] as const;

export type Amenity = (typeof AMENITIES)[number];

export const AMENITY_LABELS: Record<Amenity, string> = {
  restroom: 'Restroom',
  food: 'Food',
  coffee: 'Coffee',
  airPump: 'Air pump',
  evCharging: 'EV charging',
  carWash: 'Car wash',
  truckAccessible: 'Truck access',
  open24h: 'Open 24h',
};

/** Emoji stand-ins so the scaffold reads without an icon-font dependency. */
export const AMENITY_ICONS: Record<Amenity, string> = {
  restroom: '🚻',
  food: '🍔',
  coffee: '☕',
  airPump: '💨',
  evCharging: '🔌',
  carWash: '🚿',
  truckAccessible: '🚚',
  open24h: '🕐',
};

/**
 * Community ratings, on a 1-5 scale.
 *
 * These come from drivers and only from drivers. Nothing here is purchasable —
 * that is the whole reason the ranking is worth anything, and it is why
 * `SponsoredPlacement` is kept structurally separate from this type.
 */
export interface StationRatings {
  /** Restroom quality — the amenity travelers actually choose stops on. */
  restroom?: number;
  /** Overall stop quality. */
  overall?: number;
  /** How many drivers have weighed in. Low counts get hedged in the UI. */
  reviewCount: number;
}

/** A rating a user submits for a station. */
export interface RatingSubmission {
  stationId: string;
  restroom?: number;
  overall?: number;
  submittedAt: string;
}

/**
 * A paid placement.
 *
 * Deliberately a separate field rather than a score modifier: advertisers buy
 * visibility, never position. `src/lib/value.ts` never reads this, and the UI
 * must always render the "Sponsored" label wherever it renders the offer.
 */
export interface SponsoredPlacement {
  advertiser: string;
  /** Short offer text, e.g. "10¢/gal off in the app". */
  offer?: string;
}

/** A gas station plus whatever prices, amenities and ratings we know for it. */
export interface Station {
  id: string;
  name: string;
  /** Brand used for logo lookup and grouping, e.g. "Shell", "Costco". */
  brand: string;
  address: string;
  coordinate: LatLng;
  /** Known prices, keyed by grade. A station may not report every grade. */
  prices: Partial<Record<FuelGrade, PriceQuote>>;
  amenities: Amenity[];
  ratings: StationRatings;
  /** Present only when the station has bought a placement. Always disclosed. */
  sponsored?: SponsoredPlacement;
}

/**
 * What a vehicle burns. Kept as a discriminator rather than two separate
 * vehicle types, because the range math is identical once you agree on units:
 * capacity x efficiency x how full you are.
 */
export type VehicleFuelType = 'gas' | 'ev';

/**
 * The driver's vehicle, used to work out how far they can actually get.
 *
 * Units switch on `fuelType` — gallons and MPG for gas, kWh and mi/kWh for
 * electric — so one set of range functions serves both.
 */
export interface Vehicle {
  /** Free-text label, e.g. "2019 Camry". Display only. */
  label: string;
  fuelType: VehicleFuelType;
  /** Tank size in gallons (gas) or usable battery in kWh (EV). */
  capacity: number;
  /** Miles per gallon (gas) or miles per kWh (EV). */
  efficiency: number;
  /** How full the tank/battery is right now, 0-1. */
  level: number;
}

/** Units for a vehicle's capacity and efficiency, for display. */
export const VEHICLE_UNITS: Record<VehicleFuelType, { capacity: string; efficiency: string }> = {
  gas: { capacity: 'gal', efficiency: 'MPG' },
  ev: { capacity: 'kWh', efficiency: 'mi/kWh' },
};

/** A driving route, as a polyline plus the totals a planner needs. */
export interface Route {
  /** Ordered points along the route. */
  points: LatLng[];
  /** Total driving distance in miles. */
  distanceMiles: number;
  /** Estimated driving time in minutes, excluding stops. */
  durationMinutes: number;
  /** Resolved destination, for display. */
  destinationName: string;
  destination: LatLng;
}

/** A price a user submits from the pump. */
export interface PriceReport {
  stationId: string;
  grade: FuelGrade;
  price: number;
  reportedAt: string;
}
