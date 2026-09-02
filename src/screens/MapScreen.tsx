import { useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Linking,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import MapView, { Polyline, PROVIDER_GOOGLE } from 'react-native-maps';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { AmenityFilter } from '../components/AmenityFilter';
import { GradeSelector } from '../components/GradeSelector';
import { RangeRings } from '../components/RangeRings';
import { RankModeToggle } from '../components/RankModeToggle';
import { RateStationModal } from '../components/RateStationModal';
import { ReportPriceModal } from '../components/ReportPriceModal';
import { StationMarker } from '../components/StationMarker';
import { StationSheet } from '../components/StationSheet';
import { TripModal } from '../components/TripModal';
import { TripPlanSheet } from '../components/TripPlanSheet';
import { VehicleModal } from '../components/VehicleModal';
import { activeFeed } from '../data/priceFeed';
import { useStations } from '../hooks/useStations';
import { useTrip } from '../hooks/useTrip';
import { FALLBACK_LOCATION, useUserLocation } from '../hooks/useUserLocation';
import { useVehicle } from '../hooks/useVehicle';
import { formatPrice } from '../lib/pricing';
import { estimateRange, formatLevel, formatMiles } from '../lib/range';
import {
  findRangeDeal,
  matchesFilters,
  rankStations,
  verdictForMode,
  type RankMode,
} from '../lib/value';
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
  const [editingVehicle, setEditingVehicle] = useState(false);

  const [planningTrip, setPlanningTrip] = useState(false);
  /** Deals the driver has waved off — they don't come back this session. */
  const [dismissedDeals, setDismissedDeals] = useState<string[]>([]);

  const { vehicle, save: saveVehicle, clear: clearVehicle } = useVehicle();
  const range = useMemo(() => estimateRange(vehicle), [vehicle]);

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
    () => rankStations(visible, grade, mode, { origin: location, range }),
    [visible, grade, mode, location, range],
  );

  // Only meaningful once we know both where the driver is and what they drive.
  const deal = useMemo(
    () => (vehicle && location ? findRangeDeal(ranked, vehicle.capacity) : undefined),
    [ranked, vehicle, location],
  );

  const trip = useTrip({ origin: location, vehicle, grade, stations });

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
        {location && range && <RangeRings center={location} range={range} />}
        {trip.route && (
          <Polyline
            coordinates={trip.route.points}
            strokeColor={colors.accent}
            strokeWidth={4}
          />
        )}
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

        {/* Range summary doubles as the entry point to vehicle setup. */}
        <View style={styles.rangeBar}>
          <Pressable
            style={styles.rangeChip}
            onPress={() => setEditingVehicle(true)}
            accessibilityRole="button"
            accessibilityLabel={
              range
                ? `${vehicle?.label}, ${formatMiles(range.comfortableMiles)} of range. Edit vehicle.`
                : 'Add your vehicle to see your range'
            }
          >
            <Text style={styles.rangeIcon}>{vehicle?.fuelType === 'ev' ? '⚡' : '⛽'}</Text>
            <Text style={styles.rangeText} numberOfLines={1}>
              {range && vehicle
                ? `${formatMiles(range.comfortableMiles)} range · ${formatLevel(vehicle.level)}`
                : 'Add your vehicle'}
            </Text>
          </Pressable>

          <Pressable
            style={styles.tripChip}
            onPress={() => (trip.route ? trip.clear() : setPlanningTrip(true))}
            accessibilityRole="button"
            accessibilityLabel={trip.route ? 'Clear the planned trip' : 'Plan a trip'}
          >
            <Text style={styles.tripText}>{trip.route ? '✕ Trip' : '🧭 Plan trip'}</Text>
          </Pressable>
        </View>

        {deal && !dismissedDeals.includes(deal.target.station.id) && (
          <View style={styles.dealBanner}>
            <Text style={styles.dealTitle}>
              Don't fill up yet — save ${deal.savings.toFixed(2)}
            </Text>
            <Text style={styles.dealBody}>
              {deal.target.station.name} at {formatPrice(deal.target.price)} is{' '}
              {formatMiles(Math.max(0, deal.extraMiles))} further than the nearest stop, and well
              inside your range.
            </Text>
            {/* A suggestion the driver can't refuse is a nudge, not a suggestion. */}
            <View style={styles.dealActions}>
              <Pressable
                style={[styles.dealButton, styles.dealDismiss]}
                onPress={() =>
                  setDismissedDeals((current) => [...current, deal.target.station.id])
                }
                accessibilityRole="button"
                accessibilityLabel="Dismiss this suggestion"
              >
                <Text style={styles.dealDismissText}>No thanks</Text>
              </Pressable>
              <Pressable
                style={[styles.dealButton, styles.dealAccept]}
                onPress={() => setSelectedId(deal.target.station.id)}
                accessibilityRole="button"
                accessibilityLabel={`Show ${deal.target.station.name}`}
              >
                <Text style={styles.dealAcceptText}>Show me</Text>
              </Pressable>
            </View>
          </View>
        )}
      </View>

      <View style={styles.attribution} pointerEvents="none">
        <Text style={styles.attributionText}>Prices: {activeFeed.name} · Ratings by drivers</Text>
      </View>

      {/* The trip plan takes the sheet slot; a tapped station supersedes it. */}
      {trip.route && trip.plan && !selected && (
        <View style={styles.sheetWrapper}>
          <TripPlanSheet
            route={trip.route}
            plan={trip.plan}
            pending={trip.pending}
            live={trip.live}
            rejectedCount={trip.rejected.length}
            onClose={trip.clear}
            onSelectStop={(station) => setSelectedId(station.id)}
            onApprove={trip.approve}
            onReject={trip.reject}
            onRestoreRejected={trip.restoreRejected}
            onAccept={() => {
              if (trip.live && trip.plan?.feasible && trip.plan.stops.length > 0) {
                openDirections(trip.plan.stops[0].station);
              }
            }}
          />
        </View>
      )}

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

      <TripModal
        visible={planningTrip}
        loading={trip.loading}
        error={trip.error}
        onPlan={async (destination) => {
          await trip.start(destination);
          setPlanningTrip(false);
        }}
        onClose={() => setPlanningTrip(false)}
      />

      <VehicleModal
        visible={editingVehicle}
        vehicle={vehicle}
        onSave={saveVehicle}
        onClear={clearVehicle}
        onClose={() => setEditingVehicle(false)}
      />
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
  rangeBar: {
    flexDirection: 'row',
    gap: spacing.sm,
    marginTop: spacing.sm,
    paddingHorizontal: spacing.md,
  },
  tripChip: {
    justifyContent: 'center',
    backgroundColor: colors.text,
    borderRadius: 999,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    shadowColor: '#000',
    shadowOpacity: 0.1,
    shadowRadius: 4,
    shadowOffset: { width: 0, height: 1 },
    elevation: 2,
  },
  tripText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  rangeChip: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.background,
    borderRadius: 999,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderWidth: 1,
    borderColor: colors.border,
    shadowColor: '#000',
    shadowOpacity: 0.1,
    shadowRadius: 4,
    shadowOffset: { width: 0, height: 1 },
    elevation: 2,
  },
  rangeIcon: {
    fontSize: 13,
    marginRight: spacing.xs + 1,
  },
  rangeText: {
    fontSize: 12,
    fontWeight: '700',
    color: colors.text,
  },
  dealBanner: {
    marginTop: spacing.sm,
    marginHorizontal: spacing.md,
    padding: spacing.md,
    borderRadius: radius.md,
    backgroundColor: colors.deal,
    shadowColor: '#000',
    shadowOpacity: 0.15,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 2 },
    elevation: 3,
  },
  dealTitle: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '800',
  },
  dealBody: {
    color: 'rgba(255,255,255,0.92)',
    fontSize: 12,
    marginTop: 2,
    lineHeight: 17,
  },
  dealActions: {
    flexDirection: 'row',
    gap: spacing.sm,
    marginTop: spacing.md,
  },
  dealButton: {
    flex: 1,
    paddingVertical: spacing.sm,
    borderRadius: radius.sm,
    alignItems: 'center',
  },
  dealDismiss: {
    backgroundColor: 'rgba(255,255,255,0.18)',
  },
  dealDismissText: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '600',
  },
  dealAccept: {
    backgroundColor: '#FFFFFF',
  },
  dealAcceptText: {
    color: colors.deal,
    fontSize: 13,
    fontWeight: '700',
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
