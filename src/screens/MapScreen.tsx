import { useMemo, useState } from 'react';
import { ActivityIndicator, Linking, Platform, StyleSheet, Text, View } from 'react-native';
import MapView, { PROVIDER_GOOGLE } from 'react-native-maps';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { AmenityFilter } from '../components/AmenityFilter';
import { GradeSelector } from '../components/GradeSelector';
import { RankModeToggle } from '../components/RankModeToggle';
import { RateStationModal } from '../components/RateStationModal';
import { ReportPriceModal } from '../components/ReportPriceModal';
import { StationMarker } from '../components/StationMarker';
import { StationSheet } from '../components/StationSheet';
import { activeFeed } from '../data/priceFeed';
import { useStations } from '../hooks/useStations';
import { FALLBACK_LOCATION, useUserLocation } from '../hooks/useUserLocation';
import { formatPrice } from '../lib/pricing';
import { matchesFilters, rankStations, verdictForMode, type RankMode } from '../lib/value';
import { colors, radius, spacing } from '../theme';
import type { Amenity, FuelGrade, Region, Station } from '../types';

/** Roughly a 3-mile window — close enough that short detours make sense. */
const DEFAULT_DELTA = 0.05;

export function MapScreen() {
  const insets = useSafeAreaInsets();
  const { location, status } = useUserLocation();

  const [grade, setGrade] = useState<FuelGrade>('regular');
  const [mode, setMode] = useState<RankMode>('price');
  const [filters, setFilters] = useState<Amenity[]>([]);
  const [region, setRegion] = useState<Region | undefined>();
  const [selectedId, setSelectedId] = useState<string | undefined>();
  const [reporting, setReporting] = useState<Station | undefined>();
  const [rating, setRating] = useState<Station | undefined>();

  const initialRegion: Region = {
    ...(location ?? FALLBACK_LOCATION),
    latitudeDelta: DEFAULT_DELTA,
    longitudeDelta: DEFAULT_DELTA,
  };

  const { stations, loading, error, reportPrice, rateStation } = useStations(
    region ?? initialRegion,
  );

  // Filter before ranking, so "cheapest" means cheapest among stops that
  // actually meet the user's requirements — not cheapest overall with the
  // usable ones hidden behind it.
  const visible = useMemo(
    () => stations.filter((station) => matchesFilters(station, filters)),
    [stations, filters],
  );

  const { ranked, median, best } = useMemo(
    () => rankStations(visible, grade, mode),
    [visible, grade, mode],
  );

  const selected = ranked.find((r) => r.station.id === selectedId);

  const toggleFilter = (amenity: Amenity) => {
    setFilters((current) =>
      current.includes(amenity) ? current.filter((a) => a !== amenity) : [...current, amenity],
    );
  };

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
      Linking.openURL(`https://www.google.com/maps/dir/?api=1&destination=${latitude},${longitude}`);
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
        onPress={() => setSelectedId(undefined)}
      >
        {ranked.map((entry) => (
          <StationMarker
            key={entry.station.id}
            station={entry.station}
            price={entry.price}
            verdict={verdictForMode(entry, mode)}
            isBest={entry.isBest}
            isSponsored={entry.station.sponsored !== undefined}
            onPress={(station) => setSelectedId(station.id)}
          />
        ))}
      </MapView>

      <View style={[styles.topBar, { paddingTop: insets.top }]} pointerEvents="box-none">
        <View style={styles.topCard}>
          <GradeSelector value={grade} onChange={setGrade} />
          <View style={styles.modeRow}>
            <RankModeToggle value={mode} onChange={setMode} />
          </View>
          <View style={styles.summaryRow}>
            <Text style={styles.summary} numberOfLines={1}>
              {median !== undefined
                ? mode === 'value' && best
                  ? `Best value: ${best.station.name} · ${formatPrice(best.price)}`
                  : `Local median ${formatPrice(median)} · ${ranked.length} stations`
                : filters.length > 0
                  ? 'No stops match those filters'
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

        <View style={styles.filterBar}>
          <AmenityFilter selected={filters} onToggle={toggleFilter} />
        </View>
      </View>

      <View style={styles.attribution} pointerEvents="none">
        <Text style={styles.attributionText}>Prices: {activeFeed.name} · Ratings by drivers</Text>
      </View>

      {selected && (
        <View style={styles.sheetWrapper}>
          <StationSheet
            ranked={selected}
            grade={grade}
            median={median}
            mode={mode}
            onClose={() => setSelectedId(undefined)}
            onNavigate={openDirections}
            onReport={reportPrice ? setReporting : undefined}
            onRate={rateStation ? setRating : undefined}
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

      {rateStation && (
        <RateStationModal
          station={rating}
          onSubmit={rateStation}
          onClose={() => setRating(undefined)}
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
    marginHorizontal: spacing.md,
    marginTop: spacing.md,
    padding: spacing.md,
    backgroundColor: colors.background,
    borderRadius: radius.lg,
    shadowColor: '#000',
    shadowOpacity: 0.12,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 2 },
    elevation: 4,
  },
  modeRow: {
    marginTop: spacing.sm,
  },
  summaryRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.sm,
    marginTop: spacing.sm,
  },
  summary: {
    flex: 1,
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
  filterBar: {
    marginTop: spacing.sm,
    paddingHorizontal: spacing.md,
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
