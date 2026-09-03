import type { VehicleFuelType } from '../types';

/**
 * A single choice in one of the cascading dropdowns.
 *
 * `label` is what the driver reads; `value` is what the next request needs.
 * They differ for trims, where the label is "Auto (S6), 4 cyl, 2.5 L" and the
 * value is an opaque record id.
 */
export interface CatalogOption {
  label: string;
  value: string;
}

/** What a catalog knows about one specific vehicle, once fully identified. */
export interface CatalogVehicle {
  /** Assembled display name, e.g. "2019 Toyota Camry". */
  label: string;
  fuelType: VehicleFuelType;
  /** MPG for gas, mi/kWh for electric. Measured, not estimated. */
  efficiency: number;
  /**
   * Tank in gallons or usable battery in kWh — **estimated**, never measured.
   *
   * No free vehicle database publishes tank capacity, so this is inferred from
   * the EPA size class. The UI has to say so and leave the field editable;
   * range is computed straight off this number and being quietly wrong about
   * it is worse than asking.
   */
  estimatedCapacity: number;
  /** The EPA size class the capacity was guessed from, for the UI to cite. */
  sizeClass: string;
}

/**
 * The seam between Guzzler and whoever knows what cars exist.
 *
 * Same shape as PriceFeed and RouteProvider: the modal is written against this
 * interface, so swapping the EPA for a paid catalog with real tank sizes is one
 * new file and one line in `activeVehicleCatalog`.
 */
export interface VehicleCatalog {
  readonly name: string;
  /** Where the numbers came from, shown in the UI. Drivers should know. */
  readonly attribution: string;

  years(signal?: AbortSignal): Promise<CatalogOption[]>;
  makes(year: string, signal?: AbortSignal): Promise<CatalogOption[]>;
  models(year: string, make: string, signal?: AbortSignal): Promise<CatalogOption[]>;
  /** Trims/engines, which is where fuel economy actually varies. */
  trims(year: string, make: string, model: string, signal?: AbortSignal): Promise<CatalogOption[]>;
  /** Full record for one trim, by the `value` from `trims`. */
  details(trimId: string, signal?: AbortSignal): Promise<CatalogVehicle>;
}

import { EpaVehicleCatalog } from './epaVehicleCatalog';

/**
 * The catalog the app runs on.
 *
 * The EPA's fueleconomy.gov is the authoritative US source for the number that
 * matters here — its ratings are what the window sticker, Consumer Reports and
 * every buyer's guide all quote — and it is free, keyless and public. See
 * docs/RANGE.md for why the paid catalogs were not worth it for v1.
 */
export const activeVehicleCatalog: VehicleCatalog = new EpaVehicleCatalog();
