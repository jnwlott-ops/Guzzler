import { estimateCapacity } from '../lib/tankSize';
import type { VehicleFuelType } from '../types';
import type { CatalogOption, CatalogVehicle, VehicleCatalog } from './vehicleCatalog';

const BASE = 'https://www.fueleconomy.gov/ws/rest/vehicle';

/** Oldest model year worth listing. Older cars exist; their EPA data is thin. */
const EARLIEST_YEAR = 1995;

interface MenuItem {
  text?: string;
  value?: string | number;
}

/**
 * The EPA returns a bare object instead of a one-element array when a query
 * matches exactly one item, which is common for models with a single trim.
 * Every response goes through here so callers only ever see a list.
 */
function toArray<T>(value: T | T[] | undefined | null): T[] {
  if (value === undefined || value === null) return [];
  return Array.isArray(value) ? value : [value];
}

function toOptions(payload: { menuItem?: MenuItem | MenuItem[] }): CatalogOption[] {
  return toArray(payload?.menuItem)
    .map((item) => ({
      label: String(item?.text ?? '').trim(),
      value: String(item?.value ?? '').trim(),
    }))
    .filter((option) => option.label !== '' && option.value !== '');
}

/**
 * `fuelType1` is prose: "Regular Gasoline", "Electricity", "Diesel", and for
 * plug-in hybrids "Premium Gas or Electricity".
 *
 * The match has to be exact, not a substring. A PHEV's string *contains*
 * "Electricity" while the record carries no `combE`, so a loose test classes
 * it as electric and then computes efficiency as 100/undefined. Only a vehicle
 * whose sole fuel is electricity is an EV here — which also matches how a PHEV
 * driver actually refuels on a road trip.
 */
function fuelTypeOf(raw: string): VehicleFuelType {
  return /^electricity$/i.test(raw.trim()) ? 'ev' : 'gas';
}

interface EpaRecord {
  make?: string;
  model?: string;
  year?: string | number;
  comb08?: number | string;
  combE?: number | string;
  fuelType1?: string;
  VClass?: string;
  trany?: string;
}

/**
 * Vehicle specs from the EPA's fueleconomy.gov web service.
 *
 * Free, public, no API key, and authoritative for the one number that decides
 * range: it is the source the window sticker quotes. What it does not carry is
 * tank capacity — see src/lib/tankSize.ts for how that gap is filled and why
 * the result has to be shown as a guess.
 */
export class EpaVehicleCatalog implements VehicleCatalog {
  readonly name = 'EPA fueleconomy.gov';
  readonly attribution = 'Fuel economy: US EPA';

  private async get<T>(path: string, signal?: AbortSignal): Promise<T> {
    const response = await fetch(`${BASE}${path}`, {
      headers: { Accept: 'application/json' },
      signal,
    });
    if (!response.ok) {
      throw new Error(`Vehicle lookup failed (${response.status}).`);
    }
    return (await response.json()) as T;
  }

  async years(signal?: AbortSignal): Promise<CatalogOption[]> {
    const payload = await this.get<{ menuItem?: MenuItem | MenuItem[] }>('/menu/year', signal);
    return toOptions(payload)
      .filter((option) => Number(option.value) >= EARLIEST_YEAR)
      // Newest first: far more people are looking up a recent car than a 1997.
      .sort((a, b) => Number(b.value) - Number(a.value));
  }

  async makes(year: string, signal?: AbortSignal): Promise<CatalogOption[]> {
    const payload = await this.get<{ menuItem?: MenuItem | MenuItem[] }>(
      `/menu/make?year=${encodeURIComponent(year)}`,
      signal,
    );
    return toOptions(payload);
  }

  async models(year: string, make: string, signal?: AbortSignal): Promise<CatalogOption[]> {
    const payload = await this.get<{ menuItem?: MenuItem | MenuItem[] }>(
      `/menu/model?year=${encodeURIComponent(year)}&make=${encodeURIComponent(make)}`,
      signal,
    );
    return toOptions(payload);
  }

  async trims(
    year: string,
    make: string,
    model: string,
    signal?: AbortSignal,
  ): Promise<CatalogOption[]> {
    const payload = await this.get<{ menuItem?: MenuItem | MenuItem[] }>(
      `/menu/options?year=${encodeURIComponent(year)}&make=${encodeURIComponent(make)}&model=${encodeURIComponent(model)}`,
      signal,
    );
    return toOptions(payload);
  }

  async details(trimId: string, signal?: AbortSignal): Promise<CatalogVehicle> {
    const record = await this.get<EpaRecord>(`/${encodeURIComponent(trimId)}`, signal);

    const fuelType = fuelTypeOf(String(record.fuelType1 ?? ''));
    const sizeClass = String(record.VClass ?? '').trim();

    // Gas is rated in MPG directly. Electric is rated in kWh per 100 miles,
    // which has to be inverted to the mi/kWh the rest of the app speaks —
    // `comb08` for an EV is MPGe, a gasoline-equivalent figure that would
    // overstate range by roughly 3x if used as mi/kWh.
    const efficiency =
      fuelType === 'ev'
        ? 100 / Number(record.combE)
        : Number(record.comb08);

    if (!Number.isFinite(efficiency) || efficiency <= 0) {
      throw new Error('That trim has no usable efficiency rating. Enter it manually.');
    }

    const label = [record.year, record.make, record.model]
      .map((part) => String(part ?? '').trim())
      .filter(Boolean)
      .join(' ');

    return {
      label,
      fuelType,
      efficiency: Math.round(efficiency * 100) / 100,
      estimatedCapacity: estimateCapacity(sizeClass, fuelType),
      sizeClass,
    };
  }
}
