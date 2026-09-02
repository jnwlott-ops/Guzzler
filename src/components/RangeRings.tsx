import { Circle } from './PlatformMap';

import { milesToMeters, type RangeEstimate } from '../lib/range';
import { colors } from '../theme';
import type { LatLng } from '../types';

interface RangeRingsProps {
  center: LatLng;
  range: RangeEstimate;
}

/**
 * Two rings: how far the driver can get before dipping into reserve, and the
 * absolute limit on what's in the tank.
 *
 * Two rather than one because the gap between them is the interesting part —
 * it's the band where you *can* reach a cheaper station but shouldn't count on
 * it. Both are drawn unfilled beyond a faint wash so they never obscure pins.
 */
export function RangeRings({ center, range }: RangeRingsProps) {
  return (
    <>
      <Circle
        center={center}
        radius={milesToMeters(range.maxRadiusMiles)}
        strokeColor={colors.gouge}
        fillColor="rgba(196, 58, 49, 0.04)"
        strokeWidth={1}
        // Dashed to read as an estimate rather than a hard boundary.
        lineDashPattern={[6, 6]}
        zIndex={1}
      />
      <Circle
        center={center}
        radius={milesToMeters(range.comfortableRadiusMiles)}
        strokeColor={colors.deal}
        fillColor="rgba(27, 138, 75, 0.06)"
        strokeWidth={2}
        zIndex={2}
      />
    </>
  );
}
