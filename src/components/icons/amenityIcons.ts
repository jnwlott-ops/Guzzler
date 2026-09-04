import type { ComponentType } from 'react';

import type { Amenity } from '../../types';
import {
  AirPumpIcon,
  BoltIcon,
  PumpIcon,
  CarWashIcon,
  ClockIcon,
  CoffeeIcon,
  EvChargingIcon,
  FoodIcon,
  RestroomIcon,
  TruckIcon,
  type IconProps,
} from './index';

/**
 * The drawn icon for each amenity.
 *
 * Lives here rather than in `types.ts` because it maps domain values to React
 * components, and the domain has no business importing the view layer. The
 * emoji table it replaced sat in types.ts precisely because a string could —
 * which was the tell that they were placeholders.
 */
export const AMENITY_ICONS: Record<Amenity, ComponentType<IconProps>> = {
  restroom: RestroomIcon,
  food: FoodIcon,
  coffee: CoffeeIcon,
  airPump: AirPumpIcon,
  evCharging: EvChargingIcon,
  carWash: CarWashIcon,
  truckAccessible: TruckIcon,
  open24h: ClockIcon,
};

/** The mark a fuel type is rated and labelled in. */
export const FUEL_TYPE_ICONS = {
  gas: PumpIcon,
  ev: BoltIcon,
} as const;
