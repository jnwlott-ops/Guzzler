import { memo } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { Marker } from './PlatformMap';

import { formatPinPrice, type PriceVerdict } from '../lib/pricing';
import { flame, radius, verdictColor } from '../theme';
import type { Station } from '../types';

interface StationMarkerProps {
  station: Station;
  price: number | undefined;
  /** Precomputed by the active rank mode, so the pin stays presentational. */
  verdict: PriceVerdict;
  /** Best station in view under the active mode. */
  isBest: boolean;
  /** Shows the sponsored dot. Never affects color, size, or ranking. */
  isSponsored: boolean;
  onPress: (station: Station) => void;
}

/**
 * A price-first map pin: the number is the point, so it goes in the pin itself
 * rather than hiding behind a tap. Color carries the verdict, and the best pin
 * gets a star so the top option is findable without reading every pin.
 */
function StationMarkerComponent({
  station,
  price,
  verdict,
  isBest,
  isSponsored,
  onPress,
}: StationMarkerProps) {
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
            isBest && styles.bubbleBest,
          ]}
        >
          {isBest && <Text style={styles.star}>★</Text>}
          <Text style={styles.price}>{formatPinPrice(price)}</Text>
          {/* A quiet marker that an offer is attached — deliberately not a
              visual promotion, since position and prominence aren't for sale. */}
          {isSponsored && <View style={styles.sponsoredDot} />}
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
  bubbleBest: {
    // The best pin in view is the one place brand touches the map, and it is
    // a ring rather than a fill — the bubble still has to carry its verdict
    // color, which is the thing being read.
    borderColor: flame.gold,
    borderWidth: 2.5,
  },
  star: {
    color: flame.gold,
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
  sponsoredDot: {
    width: 4,
    height: 4,
    borderRadius: 2,
    backgroundColor: 'rgba(255,255,255,0.85)',
    marginLeft: 4,
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
