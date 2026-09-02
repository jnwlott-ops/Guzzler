import { FUEL_GRADES, type FuelGrade, type PriceQuote, type PriceReport, type Region, type Station } from '../types';
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
    for (const grade of FUEL_GRADES) {
      // Not every station sells every grade; diesel is the usual omission.
      const carriesGrade = grade === 'regular' || seededRandom(cellX, cellY, i, grade.length, 8) > 0.2;
      if (!carriesGrade) continue;

      // Ages range from minutes to ~18 hours old, so the freshness UI has
      // something to distinguish.
      const ageHours = seededRandom(cellX, cellY, i, grade.length, 9) * 18;

      prices[grade] = {
        grade,
        price: Math.round((regular + GRADE_OFFSETS[grade]) * 100) / 100,
        reportedAt: new Date(Date.now() - ageHours * 3600 * 1000).toISOString(),
        source: ageRoll > 0.6 ? 'crowdsourced' : 'feed',
      };
    }

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
    });
  }
  return stations;
}

export class MockPriceFeed implements PriceFeed {
  readonly name = 'Demo data';

  /** Reports submitted this session, applied on top of generated prices. */
  private readonly reports = new Map<string, PriceQuote>();

  async getStationsInRegion(region: Region): Promise<Station[]> {
    // Simulate the latency a real network feed would have.
    await new Promise((resolve) => setTimeout(resolve, 250));

    const minLat = region.latitude - region.latitudeDelta / 2;
    const maxLat = region.latitude + region.latitudeDelta / 2;
    const minLng = region.longitude - region.longitudeDelta / 2;
    const maxLng = region.longitude + region.longitudeDelta / 2;

    const minCellY = Math.floor(minLat / CELL_SIZE);
    const maxCellY = Math.floor(maxLat / CELL_SIZE);
    const minCellX = Math.floor(minLng / CELL_SIZE);
    const maxCellX = Math.floor(maxLng / CELL_SIZE);

    // Guard against someone zooming out to the whole planet and generating
    // hundreds of thousands of stations.
    const cellCount = (maxCellY - minCellY + 1) * (maxCellX - minCellX + 1);
    if (cellCount > 400) return [];

    const stations: Station[] = [];
    for (let y = minCellY; y <= maxCellY; y++) {
      for (let x = minCellX; x <= maxCellX; x++) {
        for (const station of stationsInCell(x, y)) {
          stations.push(this.applyReports(station));
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
