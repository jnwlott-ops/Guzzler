import type { VehicleFuelType } from '../types';

/**
 * Estimating tank size from EPA size class.
 *
 * This exists because of a gap, not because it is a good idea. The EPA
 * publishes fuel economy for every car sold in the US and does not publish
 * tank capacity for any of them, and neither does any other free source
 * (NHTSA's vPIC has the field but leaves it empty far more often than not).
 * So the lookup can fill in MPG exactly and has to guess at gallons.
 *
 * Range is computed directly off this number, so a wrong guess is a driver
 * running out of fuel further from a station than they expected. The rule
 * everywhere it is used: show it as a guess, cite the class it came from, and
 * leave the field editable. Never let it be silently authoritative.
 *
 * Figures are mid-range for each class from manufacturer specs, rounded to the
 * gallon — precision here would be false.
 */
const GAS_TANK_GALLONS: { match: RegExp; gallons: number }[] = [
  // Ordered most specific first: "Standard Pickup" must beat "Pickup", and
  // "Small Sport Utility" must beat "Sport Utility".
  { match: /standard pickup/i, gallons: 26 },
  { match: /small pickup/i, gallons: 20 },
  { match: /pickup/i, gallons: 24 },
  { match: /standard sport utility/i, gallons: 21 },
  { match: /small sport utility/i, gallons: 16 },
  { match: /sport utility/i, gallons: 19 },
  { match: /minivan/i, gallons: 19 },
  { match: /van/i, gallons: 25 },
  { match: /midsize station wagon/i, gallons: 16 },
  { match: /small station wagon/i, gallons: 14 },
  { match: /station wagon/i, gallons: 15 },
  { match: /large car/i, gallons: 19 },
  { match: /midsize car/i, gallons: 16 },
  { match: /compact car/i, gallons: 14 },
  { match: /subcompact car/i, gallons: 13 },
  { match: /minicompact car/i, gallons: 12 },
  { match: /two seater/i, gallons: 14 },
  { match: /special purpose/i, gallons: 20 },
];

/** Fallback when the class is unrecognized: a mid-size sedan. */
const DEFAULT_GALLONS = 15;

/**
 * Usable battery in kWh by class.
 *
 * Even rougher than the gas table — EV battery sizes vary far more within a
 * class than tanks do, and "usable" is smaller than the headline number by an
 * amount each manufacturer chooses. Treat these as a starting point that the
 * driver is expected to correct.
 */
const EV_BATTERY_KWH: { match: RegExp; kwh: number }[] = [
  { match: /pickup/i, kwh: 130 },
  { match: /standard sport utility/i, kwh: 90 },
  { match: /small sport utility/i, kwh: 70 },
  { match: /sport utility/i, kwh: 80 },
  { match: /van|minivan/i, kwh: 90 },
  { match: /large car/i, kwh: 95 },
  { match: /midsize car/i, kwh: 75 },
  { match: /compact car|subcompact car|minicompact car/i, kwh: 60 },
  { match: /station wagon/i, kwh: 75 },
  { match: /two seater/i, kwh: 70 },
];

const DEFAULT_KWH = 75;

/**
 * Best guess at capacity for a vehicle in `sizeClass`.
 *
 * Always returns a number — a form that refuses to prefill is no better than
 * the manual entry it replaced — but callers must present the result as an
 * estimate. See the note at the top of this file.
 */
export function estimateCapacity(sizeClass: string, fuelType: VehicleFuelType): number {
  if (fuelType === 'ev') {
    return EV_BATTERY_KWH.find((row) => row.match.test(sizeClass))?.kwh ?? DEFAULT_KWH;
  }
  return GAS_TANK_GALLONS.find((row) => row.match.test(sizeClass))?.gallons ?? DEFAULT_GALLONS;
}
