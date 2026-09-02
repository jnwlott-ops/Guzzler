import { memo } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { Marker } from 'react-native-maps';

import { formatPinPrice, priceFor, verdictFor, type PriceVerdict } from '../lib/pricing';
import { colors, radius, verdictColor } from '../theme';
import type { FuelGrade, Station } from '../types';

interface StationMarkerProps {
  station: Station;
  grade: FuelGrade;
  /** Local median for the visible region, used to classify this station. */
  median: number | undefined;
  /** Cheapest station in view gets a crown and a heavier outline. */
  isCheapest: boolean;
  onPress: (station: Station) => void;
}

/**
 * A price-first map pin: the number is the point, so it goes in the pin itself
 * rather than hiding behind a tap. Color carries the verdict, and the cheapest
 * pin gets a star so the best option is findable without reading every pin.
 */
function StationMarkerComponent({ station, grade, median, isCheapest, onPress }: StationMarkerProps) {
  const price = priceFor(station, grade);
  const verdict: PriceVerdict = verdictFor(price, median);

  return (
    <Marker
      coordinate={station.coordinate}
      onPress={() => onPress(station)}
      tracksViewChanges={false}
      anchor={{ x: 0.5, y: 1 }}
    >
      <View style={styles.container}>
        <View
          style={[
            styles.bubble,
            { backgroundColor: verdictColor[verdict] },
            isCheapest && styles.bubbleCheapest,
          ]}
        >
          {isCheapest && <Text style={styles.star}>★</Text>}
          <Text style={styles.price}>{formatPinPrice(price)}</Text>
        </View>
        <View style={[styles.tail, { borderTopColor: verdictColor[verdict] }]} />
      </View>
    </Marker>
  );
}

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
  },
  bubble: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 7,
    paddingVertical: 3,
    borderRadius: radius.sm,
    borderWidth: 1.5,
    borderColor: 'rgba(255,255,255,0.9)',
  },
  bubbleCheapest: {
    borderColor: '#FFFFFF',
    borderWidth: 2.5,
  },
  star: {
    color: '#FFFFFF',
    fontSize: 10,
    marginRight: 3,
  },
  price: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '700',
    // Tabular figures keep pins the same width as prices tick up and down.
    fontVariant: ['tabular-nums'],
  },
  tail: {
    width: 0,
    height: 0,
    borderLeftWidth: 4,
    borderRightWidth: 4,
    borderTopWidth: 5,
    borderLeftColor: 'transparent',
    borderRightColor: 'transparent',
    marginTop: -1,
  },
});

export const StationMarker = memo(StationMarkerComponent);
