import { useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Linking,
  Platform,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import MapView, { PROVIDER_GOOGLE } from 'react-native-maps';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { GradeSelector } from '../components/GradeSelector';
import { ReportPriceModal } from '../components/ReportPriceModal';
import { StationMarker } from '../components/StationMarker';
import { StationSheet } from '../components/StationSheet';
import { activeFeed } from '../data/priceFeed';
import { useStations } from '../hooks/useStations';
import { FALLBACK_LOCATION, useUserLocation } from '../hooks/useUserLocation';
import { cheapestStation, formatPrice, medianPrice } from '../lib/pricing';
import { colors, radius, spacing } from '../theme';
import type { FuelGrade, Region, Station } from '../types';

/** Roughly a 3-mile window — close enough that walking/short detours make sense. */
const DEFAULT_DELTA = 0.05;

export function MapScreen() {
  const insets = useSafeAreaInsets();
  const { location, status } = useUserLocation();
  const [grade, setGrade] = useState<FuelGrade>('regular');
  const [region, setRegion] = useState<Region | undefined>();
  const [selected, setSelected] = useState<Station | undefined>();
  const [reporting, setReporting] = useState<Station | undefined>();

  const initialRegion: Region = {
    ...(location ?? FALLBACK_LOCATION),
    latitudeDelta: DEFAULT_DELTA,
    longitudeDelta: DEFAULT_DELTA,
  };

  // Until the map reports its first region, price against where we're starting.
  const { stations, loading, error, reportPrice } = useStations(region ?? initialRegion);

  const median = useMemo(() => medianPrice(stations, grade), [stations, grade]);
  const cheapest = useMemo(() => cheapestStation(stations, grade), [stations, grade]);

  const openDirections = (station: Station) => {
    const { latitude, longitude } = station.coordinate;
    const label = encodeURIComponent(`${station.name}, ${station.address}`);

    // Hand off to the platform's own maps app rather than routing in-app: turn
    // by turn is a solved problem and not where Guzzler adds value.
    const url = Platform.select({
      ios: `maps://app?daddr=${latitude},${longitude}&q=${label}`,
      android: `google.navigation:q=${latitude},${longitude}`,
      default: `https://www.google.com/maps/dir/?api=1&destination=${latitude},${longitude}`,
    });

    Linking.openURL(url).catch(() => {
      Linking.openURL(
        `https://www.google.com/maps/dir/?api=1&destination=${latitude},${longitude}`,
      );
    });
  };

  return (
    <View style={styles.container}>
      <MapView
        style={StyleSheet.absoluteFill}
        // Google Maps on both platforms so the pins and basemap match what
        // travelers already recognize from navigation.
        provider={PROVIDER_GOOGLE}
        initialRegion={initialRegion}
        onRegionChangeComplete={setRegion}
        showsUserLocation={status === 'granted'}
        showsMyLocationButton
        onPress={() => setSelected(undefined)}
      >
        {stations.map((station) => (
          <StationMarker
            key={station.id}
            station={station}
            grade={grade}
            median={median}
            isCheapest={station.id === cheapest?.id}
            onPress={setSelected}
          />
        ))}
      </MapView>

      <View style={[styles.topBar, { paddingTop: insets.top }]} pointerEvents="box-none">
        <View style={styles.topCard}>
          <GradeSelector value={grade} onChange={setGrade} />
          <View style={styles.summaryRow}>
            <Text style={styles.summary}>
              {median !== undefined
                ? `Local median ${formatPrice(median)} · ${stations.length} stations`
                : 'No prices in view'}
            </Text>
            {loading && <ActivityIndicator size="small" color={colors.textMuted} />}
          </View>
          {error && <Text style={styles.error}>{error}</Text>}
          {status === 'denied' && (
            <Text style={styles.notice}>
              Location off — showing a default area. Pan the map to look anywhere.
            </Text>
          )}
        </View>
      </View>

      <View style={styles.attribution} pointerEvents="none">
        <Text style={styles.attributionText}>Prices: {activeFeed.name}</Text>
      </View>

      {selected && (
        <View style={styles.sheetWrapper}>
          <StationSheet
            station={selected}
            grade={grade}
            median={median}
            onClose={() => setSelected(undefined)}
            onNavigate={openDirections}
            onReport={reportPrice ? setReporting : undefined}
          />
        </View>
      )}

      {reportPrice && (
        <ReportPriceModal
          station={reporting}
          grade={grade}
          onSubmit={reportPrice}
          onClose={() => setReporting(undefined)}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.surface,
  },
  topBar: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
  },
  topCard: {
    margin: spacing.md,
    padding: spacing.md,
    backgroundColor: colors.background,
    borderRadius: radius.lg,
    shadowColor: '#000',
    shadowOpacity: 0.12,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 2 },
    elevation: 4,
  },
  summaryRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: spacing.sm,
  },
  summary: {
    fontSize: 13,
    color: colors.textMuted,
    fontWeight: '600',
  },
  error: {
    fontSize: 13,
    color: colors.gouge,
    marginTop: spacing.xs,
  },
  notice: {
    fontSize: 12,
    color: colors.textMuted,
    marginTop: spacing.xs,
  },
  attribution: {
    position: 'absolute',
    bottom: spacing.sm,
    left: spacing.md,
  },
  attributionText: {
    fontSize: 11,
    color: colors.textMuted,
  },
  sheetWrapper: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
  },
});
