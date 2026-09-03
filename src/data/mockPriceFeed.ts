import {
  AMENITIES,
  FUEL_GRADES,
  type Amenity,
  type FuelGrade,
  type PriceQuote,
  type PriceReport,
  type RatingSubmission,
  type Region,
  type Station,
  type StationRatings,
} from '../types';
import type { PriceFeed } from './priceFeed';

/**
 * A stand-in feed that invents plausible stations around wherever the map is
 * looking, so the app is demoable before a real provider is wired up.
 *
 * Stations are generated deterministically from a coarse lat/lng grid: the same
 * patch of map always yields the same stations at the same prices, so pins stay
 * put while panning instead of reshuffling on every frame.
 */

/** Degrees per grid cell — roughly a one-mile square at US latitudes. */
const CELL_SIZE = 0.015;

/** Widest region the mock will generate for: 20 cells a side, so 400 at most. */
const MAX_SPAN_DEGREES = CELL_SIZE * 20;

/** Baseline regular-grade price the mock varies around, in USD/gal. */
const BASE_REGULAR_PRICE = 3.29;

/** Typical per-gallon premium each grade carries over regular. */
const GRADE_OFFSETS: Record<FuelGrade, number> = {
  regular: 0,
  midgrade: 0.4,
  premium: 0.75,
  diesel: 0.55,
};

const BRANDS = [
  'Shell',
  'Chevron',
  'Costco',
  'BP',
  'Exxon',
  'Mobil',
  'Circle K',
  '76',
  'Arco',
  'Sunoco',
  'Valero',
  "Buc-ee's",
];

/**
 * Rough per-brand quality multiplier, so generated amenities and ratings track
 * the reputations drivers already have. Keeps the demo data from looking like
 * uniform noise.
 */
const BRAND_QUALITY: Record<string, number> = {
  "Buc-ee's": 1,
  Costco: 0.95,
  Shell: 0.85,
  Chevron: 0.85,
  BP: 0.8,
  Mobil: 0.8,
  Exxon: 0.78,
  '76': 0.72,
  Sunoco: 0.72,
  'Circle K': 0.7,
  Valero: 0.68,
  Arco: 0.6,
};

/** Keeps a generated rating inside the 1-5 scale. */
function clampRating(value: number): number {
  return Math.round(Math.min(5, Math.max(1, value)) * 10) / 10;
}

const STREETS = [
  'Main St',
  'Oak Ave',
  'Sunset Blvd',
  'Market St',
  'Highland Ave',
  'Cedar Rd',
  'Mill Creek Pkwy',
  'Riverside Dr',
];

/**
 * Deterministic hash → [0, 1). Same inputs always give the same value, which is
 * what keeps generated stations stable across re-renders and pans.
 */
function seededRandom(...seeds: number[]): number {
  let h = 2166136261;
  for (const seed of seeds) {
    // Fold the seed into the hash a chunk at a time so nearby seeds diverge.
    let value = Math.floor(seed * 1000) + 0x9e3779b9;
    for (let i = 0; i < 4; i++) {
      h ^= value & 0xff;
      h = Math.imul(h, 16777619);
      value >>>= 8;
    }
  }
  // Final avalanche, then normalize to [0, 1).
  h ^= h >>> 13;
  h = Math.imul(h, 0x5bd1e995);
  h ^= h >>> 15;
  return (h >>> 0) / 4294967296;
}

function pick<T>(items: readonly T[], roll: number): T {
  return items[Math.floor(roll * items.length) % items.length];
}

/** Builds the 0-3 stations that live in one grid cell. */
function stationsInCell(cellX: number, cellY: number): Station[] {
  const density = seededRandom(cellX, cellY, 1);

  // Most cells hold one or two stations; a few hold none, a few hold three.
  const count = density < 0.25 ? 0 : density < 0.65 ? 1 : density < 0.92 ? 2 : 3;

  const stations: Station[] = [];
  for (let i = 0; i < count; i++) {
    const latJitter = seededRandom(cellX, cellY, i, 2);
    const lngJitter = seededRandom(cellX, cellY, i, 3);
    const brandRoll = seededRandom(cellX, cellY, i, 4);
    const streetRoll = seededRandom(cellX, cellY, i, 5);
    const priceRoll = seededRandom(cellX, cellY, i, 6);
    const ageRoll = seededRandom(cellX, cellY, i, 7);

    const brand = pick(BRANDS, brandRoll);

    // Spread regular prices about +/- 45 cents around the baseline, which is
    // roughly the real spread within a metro area.
    const regular = BASE_REGULAR_PRICE + (priceRoll - 0.5) * 0.9;

    const prices: Partial<Record<FuelGrade, PriceQuote>> = {};
    // Seeded by index, not by name: several grade and amenity names share a
    // character count, and seeding on length made those collide into perfectly
    // correlated draws.
    for (const [gradeIndex, grade] of FUEL_GRADES.entries()) {
      // Not every station sells every grade; diesel is the usual omission.
      const carriesGrade = grade === 'regular' || seededRandom(cellX, cellY, i, gradeIndex, 8) > 0.2;
      if (!carriesGrade) continue;

      // Ages range from minutes to ~18 hours old, so the freshness UI has
      // something to distinguish.
      const ageHours = seededRandom(cellX, cellY, i, gradeIndex, 9) * 18;

      prices[grade] = {
        grade,
        price: Math.round((regular + GRADE_OFFSETS[grade]) * 100) / 100,
        reportedAt: new Date(Date.now() - ageHours * 3600 * 1000).toISOString(),
        source: ageRoll > 0.6 ? 'crowdsourced' : 'feed',
      };
    }

    const amenities: Amenity[] = [];
    for (const [amenityIndex, amenity] of AMENITIES.entries()) {
      const roll = seededRandom(cellX, cellY, i, amenityIndex, 10);
      // Restrooms are near-universal; EV charging and truck access are not.
      const likelihood = amenity === 'restroom' ? 0.9 : amenity === 'evCharging' ? 0.25 : 0.55;
      if (roll < likelihood * BRAND_QUALITY[brand]) amenities.push(amenity);
    }

    // Ratings track brand quality loosely, with real spread so the value
    // ranking has something to separate.
    const reviewRoll = seededRandom(cellX, cellY, i, 11);
    const restroomRoll = seededRandom(cellX, cellY, i, 12);
    const overallRoll = seededRandom(cellX, cellY, i, 13);
    const reviewCount = Math.floor(reviewRoll * 120);

    const ratings: StationRatings = { reviewCount };
    if (reviewCount > 0) {
      ratings.restroom = clampRating(1 + restroomRoll * 4 * BRAND_QUALITY[brand] + 0.5);
      ratings.overall = clampRating(1 + overallRoll * 4 * BRAND_QUALITY[brand] + 0.5);

      // Only stops that actually sell food get a food rating — a bare pump
      // island has nothing to judge.
      if (amenities.includes('food')) {
        const foodRoll = seededRandom(cellX, cellY, i, 15);
        ratings.food = clampRating(1 + foodRoll * 4 * BRAND_QUALITY[brand] + 0.5);
      }
    }

    // A small slice of stations have bought a placement. This never touches
    // the value score — it only earns the labeled treatment in the UI.
    const sponsoredRoll = seededRandom(cellX, cellY, i, 14);

    stations.push({
      id: `mock-${cellX}-${cellY}-${i}`,
      name: brand,
      brand,
      address: `${1000 + Math.floor(streetRoll * 8999)} ${pick(STREETS, streetRoll)}`,
      coordinate: {
        latitude: (cellY + latJitter) * CELL_SIZE,
        longitude: (cellX + lngJitter) * CELL_SIZE,
      },
      prices,
      amenities,
      ratings,
      ...(sponsoredRoll > 0.85
        ? { sponsored: { advertiser: brand, offer: '10¢/gal off in the app' } }
        : {}),
    });
  }
  return stations;
}

export class MockPriceFeed implements PriceFeed {
  readonly maxSpanDegrees = MAX_SPAN_DEGREES;
  readonly name = 'Demo data';

  /** Reports submitted this session, applied on top of generated prices. */
  private readonly reports = new Map<string, PriceQuote>();

  /** Ratings submitted this session, folded into generated ratings. */
  private readonly ratings = new Map<string, RatingSubmission>();

  async getStationsInRegion(region: Region): Promise<Station[]> {
    // Simulate the latency a real network feed would have.
    await new Promise((resolve) => setTimeout(resolve, 250));

    const minLat = region.latitude - region.latitudeDelta / 2;
    const maxLat = region.latitude + region.latitudeDelta / 2;
    const minLng = region.longitude - region.longitudeDelta / 2;
    const maxLng = region.longitude + region.longitudeDelta / 2;

    // Guard against someone zooming out to the whole planet and generating
    // hundreds of thousands of stations. Expressed as a span rather than a
    // cell count so the UI can apply the identical test and explain itself.
    if (
      region.latitudeDelta > MAX_SPAN_DEGREES ||
      region.longitudeDelta > MAX_SPAN_DEGREES
    ) {
      return [];
    }

    const minCellY = Math.floor(minLat / CELL_SIZE);
    const maxCellY = Math.floor(maxLat / CELL_SIZE);
    const minCellX = Math.floor(minLng / CELL_SIZE);
    const maxCellX = Math.floor(maxLng / CELL_SIZE);

    const stations: Station[] = [];
    for (let y = minCellY; y <= maxCellY; y++) {
      for (let x = minCellX; x <= maxCellX; x++) {
        for (const station of stationsInCell(x, y)) {
          stations.push(this.applyRatings(this.applyReports(station)));
        }
      }
    }
    return stations;
  }

  async submitReport(report: PriceReport): Promise<void> {
    await new Promise((resolve) => setTimeout(resolve, 150));
    this.reports.set(`${report.stationId}:${report.grade}`, {
      grade: report.grade,
      price: report.price,
      reportedAt: report.reportedAt,
      source: 'crowdsourced',
    });
  }

  async submitRating(rating: RatingSubmission): Promise<void> {
    await new Promise((resolve) => setTimeout(resolve, 150));
    this.ratings.set(rating.stationId, rating);
  }

  /**
   * Folds a session-local rating into a station's generated ratings.
   *
   * Averaged against the existing score weighted by review count, rather than
   * replacing it, so one rating moves a well-reviewed station only slightly —
   * the same behavior a real backend would need.
   */
  private applyRatings(station: Station): Station {
    const submitted = this.ratings.get(station.id);
    if (!submitted) return station;

    const { reviewCount } = station.ratings;
    const blend = (existing: number | undefined, incoming: number | undefined) => {
      if (incoming === undefined) return existing;
      if (existing === undefined || reviewCount === 0) return incoming;
      return Math.round(((existing * reviewCount + incoming) / (reviewCount + 1)) * 10) / 10;
    };

    return {
      ...station,
      ratings: {
        restroom: blend(station.ratings.restroom, submitted.restroom),
        food: blend(station.ratings.food, submitted.food),
        overall: blend(station.ratings.overall, submitted.overall),
        reviewCount: reviewCount + 1,
      },
    };
  }

  /** Overlays any session-local reports onto a generated station. */
  private applyReports(station: Station): Station {
    let prices = station.prices;
    for (const grade of FUEL_GRADES) {
      const reported = this.reports.get(`${station.id}:${grade}`);
      if (!reported) continue;
      if (prices === station.prices) prices = { ...prices };
      prices[grade] = reported;
    }
    return prices === station.prices ? station : { ...station, prices };
  }
}
