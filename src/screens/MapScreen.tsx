import { useEffect, useMemo, useRef, useState, type ComponentRef } from 'react';
import {
  ActivityIndicator,
  Linking,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { MapView, Polyline, PROVIDER_GOOGLE } from '../components/PlatformMap';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { AmenityFilter } from '../components/AmenityFilter';
import { FlameButton } from '../components/FlameButton';
import { ApproachBanner } from '../components/ApproachBanner';
import { GradeSelector } from '../components/GradeSelector';
import { PriorityControl } from '../components/PriorityControl';
import { RangeRings } from '../components/RangeRings';
import { RankModeToggle } from '../components/RankModeToggle';
import { RateStationModal } from '../components/RateStationModal';
import { ReportPriceModal } from '../components/ReportPriceModal';
import { StationMarker } from '../components/StationMarker';
import { StationSheet } from '../components/StationSheet';
import { StopSwapSheet } from '../components/StopSwapSheet';
import { LocateIcon } from '../components/icons';
import { TripModal } from '../components/TripModal';
import { TripPlanSheet } from '../components/TripPlanSheet';
import { VehicleModal } from '../components/VehicleModal';
import { activeFeed } from '../data/priceFeed';
import { useApproachAlerts } from '../hooks/useApproachAlerts';
import { useFavorites } from '../hooks/useFavorites';
import { usePreferences } from '../hooks/usePreferences';
import { useStations } from '../hooks/useStations';
import { useTrip } from '../hooks/useTrip';
import { FALLBACK_LOCATION, useUserLocation } from '../hooks/useUserLocation';
import { useVehicle } from '../hooks/useVehicle';
import { formatPrice } from '../lib/pricing';
import { stationsAlongRoute } from '../lib/route';
import { buildDirectionsUrl, type NavApp } from '../lib/navHandoff';
import { ratingDollarsFor, stopAlternatives } from '../lib/tripPlanner';
import { estimateRange, formatLevel, formatMiles } from '../lib/range';
import {
  findRangeDeal,
  matchesFilters,
  rankStations,
  verdictForMode,
  type RankMode,
} from '../lib/value';
import { darkMapStyle } from '../mapStyle';
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

  const { preferences, presetId, setPreset } = usePreferences();
  const { favorites, isFavorite, toggle: toggleFavorite } = useFavorites();

  const {
    vehicle,
    // Until storage answers, `vehicle` is undefined for a reason that has
    // nothing to do with the driver not owning one — see the chip below.
    ready: vehicleReady,
    save: saveVehicle,
    clear: clearVehicle,
  } = useVehicle();
  const range = useMemo(() => estimateRange(vehicle), [vehicle]);

  // Typed off the native map; the web stand-in ignores refs, so every call
  // below is guarded and simply does nothing there.
  const mapRef = useRef<ComponentRef<typeof MapView>>(null);
  /** Set once the map has been pointed at the driver, or they have moved it. */
  const centered = useRef(false);

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
    () =>
      rankStations(visible, grade, mode, { origin: location, range }, preferences.priceWeight),
    [visible, grade, mode, location, range, preferences.priceWeight],
  );

  // Only meaningful once we know both where the driver is and what they drive.
  const deal = useMemo(
    () =>
      vehicle && location
        ? // Savings ride on what will actually go in the tank, not on tank
          // size — a driver at three-quarters full can only buy a quarter tank
          // of the cheaper gas, and quoting them a full tank's saving is a
          // number they will never see at the pump.
          findRangeDeal(ranked, vehicle.capacity * (1 - vehicle.level))
        : undefined,
    [ranked, vehicle, location],
  );

  /**
   * Point the map at the driver once their location arrives.
   *
   * `initialRegion` is read once at mount and ignored forever after, so
   * whichever wins the race decides where the app sits — and a permission
   * prompt means location loses every time on a fresh launch. The result was a
   * driver in Georgia looking at Austin, with no hint that anything was wrong,
   * because the fallback region is a perfectly ordinary-looking map.
   */
  const centerOnUser = (durationMs: number): boolean => {
    // The ref is null until the map mounts, and iOS ignores animateToRegion
    // before the map has laid out — so this reports whether it actually got
    // to say anything, and the caller decides whether to keep trying.
    if (!location || !mapRef.current) return false;
    mapRef.current.animateToRegion(
      { ...location, latitudeDelta: DEFAULT_DELTA, longitudeDelta: DEFAULT_DELTA },
      durationMs,
    );
    return true;
  };

  useEffect(() => {
    if (!location || centered.current) return;
    // Only spend the one-shot if the map was actually there to hear it.
    // Marking it done on a null ref left the driver stranded in the fallback
    // region with no second attempt — which is the bug this whole thing is
    // meant to fix, reintroduced one layer down.
    centered.current = centerOnUser(600);
  }, [location]);

  /**
   * The other half of the race: location can land before the map is ready, in
   * which case the effect above found nothing to talk to.
   */
  const handleMapReady = () => {
    if (centered.current) return;
    centered.current = centerOnUser(0);
  };

  /** Puts the map back on the driver, from wherever they have panned to. */
  const recenter = () => {
    centerOnUser(400);
  };

  const approach = useApproachAlerts(location, favorites);

  // Past the feed's limit there are no stations to have an opinion about, and
  // "no prices in view" would read as a claim about the world rather than
  // about the zoom level.
  const maxSpan = activeFeed.maxSpanDegrees;
  const tooZoomedOut =
    maxSpan !== undefined &&
    region !== undefined &&
    (region.latitudeDelta > maxSpan || region.longitudeDelta > maxSpan);

  /** Index of the planned stop the driver is reconsidering, if any. */
  const [swappingStop, setSwappingStop] = useState<number | undefined>();


  // The same price-vs-quality dial governs the trip planner, so a driver who
  // asks for better stops gets them on the road too, not just on the map.
  const trip = useTrip({
    origin: location,
    vehicle,
    grade,
    ratingDollars: ratingDollarsFor(preferences.priceWeight),
  });

  const swapping = useMemo(() => {
    if (swappingStop === undefined || !trip.route || !trip.plan?.feasible || !vehicle) {
      return undefined;
    }
    const stop = trip.plan.stops[swappingStop];
    if (!stop) return undefined;
    return {
      stop,
      alternatives: stopAlternatives({
        plan: trip.plan,
        stopIndex: swappingStop,
        corridor: stationsAlongRoute(stations, trip.route),
        route: trip.route,
        vehicle,
        grade,
        excludedStationIds: trip.rejected.map((s) => s.id),
      }),
    };
  }, [swappingStop, trip.route, trip.plan, trip.rejected, stations, vehicle, grade]);

  const selected = ranked.find((r) => r.station.id === selectedId);

  const toggleFilter = (amenity: Amenity) => {
    setFilters((current) =>
      current.includes(amenity) ? current.filter((a) => a !== amenity) : [...current, amenity],
    );
  };

  // Takes the minimum a destination needs, so saved favorites — which carry no
  // prices — can be navigated to without being inflated into full stations.
  const openDirections = (place: Pick<Station, 'name' | 'address' | 'coordinate'>) => {
    // Guzzler plans; the driver's own nav executes. Apple Maps is guaranteed
    // present on iOS, Google Maps is the safe default elsewhere — letting the
    // driver pick their nav app is the obvious next step.
    const app: NavApp = Platform.OS === 'ios' ? 'apple' : 'google';

    const { url } = buildDirectionsUrl(app, {
      destination: place.coordinate,
      label: `${place.name}, ${place.address}`,
    });

    Linking.openURL(url).catch(() => {
      // Falls back to the Google web URL, which resolves in any browser.
      const fallback = buildDirectionsUrl('google', { destination: place.coordinate });
      Linking.openURL(fallback.url);
    });
  };

  return (
    <View style={styles.container}>
      <MapView
        style={StyleSheet.absoluteFill}
        // Google on Android, Apple on iOS — not a preference, a constraint.
        // Expo Go's iOS client does not bundle the Google Maps SDK, so asking
        // for PROVIDER_GOOGLE there yields a view that renders nothing at all:
        // no tiles, no pins, just the container's background. A real build
        // would need a Google Maps iOS key on top of that, where Apple Maps
        // needs none and is what iPhone drivers already read.
        provider={Platform.OS === 'android' ? PROVIDER_GOOGLE : undefined}
        // Dark basemap with Google's POIs suppressed, so the only markers on
        // the map are the stations we priced. See src/mapStyle.ts. Apple Maps
        // ignores customMapStyle entirely and takes userInterfaceStyle below.
        customMapStyle={Platform.OS === 'android' ? darkMapStyle : undefined}
        userInterfaceStyle="dark"
        initialRegion={initialRegion}
        onRegionChangeComplete={setRegion}
        showsUserLocation={status === 'granted'}
        showsMyLocationButton
        onPress={() => setSelectedId(undefined)}
        // A drag means the driver has chosen where to look, so the one-time
        // recentre below must not yank the map out from under them.
        onPanDrag={() => {
          centered.current = true;
        }}
        onMapReady={handleMapReady}
        ref={mapRef}
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
          {mode === 'value' && (
            <View style={styles.modeRow}>
              <PriorityControl value={presetId} onChange={setPreset} />
            </View>
          )}
          <View style={styles.summaryRow}>
            <Text style={styles.summary} numberOfLines={1}>
              {median !== undefined
                ? mode === 'value' && best
                  ? `Best value: ${best.station.name} · ${formatPrice(best.price)}`
                  : `Local median ${formatPrice(median)} · ${ranked.length} stations`
                : tooZoomedOut
                  ? 'Zoom in to see prices'
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
          <FlameButton
            quiet
            disabled={!vehicleReady}
            style={styles.rangeChip}
            label={
              // "Add your vehicle" before storage has answered is a claim about
              // the driver, and a false one for anyone who already saved a car.
              // A dash says the only true thing: we don't know yet.
              !vehicleReady
                ? '—'
                : range && vehicle
                  ? `${formatMiles(range.comfortableMiles)} range · ${formatLevel(vehicle.level)}`
                  : 'Add your vehicle'
            }
            accessibilityLabel={
              !vehicleReady
                ? 'Checking your saved vehicle'
                : range
                  ? `${vehicle?.label}, ${formatMiles(range.comfortableMiles)} of range. Edit vehicle.`
                  : 'Add your vehicle to see your range'
            }
            onPress={() => setEditingVehicle(true)}
          />

          <FlameButton
            // Planning without a vehicle fails with "add your vehicle first",
            // which would be wrong for a driver whose car is still loading.
            disabled={!vehicleReady}
            label={trip.route ? 'End trip' : 'Plan trip'}
            accessibilityLabel={trip.route ? 'Clear the planned trip' : 'Plan a trip'}
            onPress={() => (trip.route ? trip.clear() : setPlanningTrip(true))}
          />
        </View>

        {/* Saved places coming up. Nearest first, so the most urgent is on top. */}
        {approach.alerts.map((alert) => (
          <ApproachBanner
            key={alert.place.id}
            alert={alert}
            onNavigate={(favorite) =>
              openDirections({
                name: favorite.name,
                address: favorite.address,
                coordinate: favorite.coordinate,
              })
            }
            onDismiss={approach.dismiss}
          />
        ))}

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

      {/* showsMyLocationButton is a Google Maps prop, so on iOS — where we run
          Apple Maps — there is otherwise no way back to yourself once you pan. */}
      {location && !selected && !trip.route && (
        <Pressable
          style={[styles.recenter, { bottom: insets.bottom + spacing.xl }]}
          onPress={recenter}
          accessibilityRole="button"
          accessibilityLabel="Centre the map on your location"
        >
          <LocateIcon size={20} color={colors.accent} />
        </Pressable>
      )}

      {/* The trip plan takes the sheet slot; a tapped station supersedes it. */}
      {trip.route && trip.plan && !selected && (
        <View style={styles.sheetWrapper}>
          <StopSwapSheet
            alternatives={swapping?.alternatives}
            currentName={swapping?.stop.station.name}
            isChosen={
              swapping !== undefined && trip.chosen.includes(swapping.stop.station.id)
            }
            onChoose={(stationId) => {
              trip.choose(stationId, swapping?.stop.station.id);
              setSwappingStop(undefined);
            }}
            onLetGuzzlerPick={() => {
              if (swapping) trip.unchoose(swapping.stop.station.id);
              setSwappingStop(undefined);
            }}
            onClose={() => setSwappingStop(undefined)}
          />

          <TripPlanSheet
            onSwapStop={setSwappingStop}
            chosenStationIds={trip.chosen}
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
            isFavorite={isFavorite(selected.station.id)}
            onToggleFavorite={toggleFavorite}
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
  recenter: {
    position: 'absolute',
    right: spacing.md,
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.background,
    borderWidth: 1,
    borderColor: colors.border,
    shadowColor: '#000',
    shadowOpacity: 0.35,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 2 },
    elevation: 3,
  },
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
  rangeChip: {
    flex: 1,
  },
  dealBanner: {
    marginTop: spacing.sm,
    marginHorizontal: spacing.md,
    padding: spacing.md,
    borderRadius: radius.md,
    // A card on the panel with a green edge, not a green slab. Filling the
    // whole banner made it the loudest thing on a dark screen — louder than
    // the flame, which is supposed to be the loudest thing — and it read as an
    // alert rather than an offer the driver is free to wave off.
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderLeftWidth: 4,
    borderLeftColor: colors.deal,
    shadowColor: '#000',
    shadowOpacity: 0.35,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 3 },
    elevation: 3,
  },
  dealTitle: {
    // Green carries the meaning here, the same green the cheap pins wear.
    color: colors.deal,
    fontSize: 14,
    fontWeight: '800',
  },
  dealBody: {
    color: colors.textMuted,
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
    backgroundColor: colors.background,
    borderWidth: 1,
    borderColor: colors.border,
  },
  dealDismissText: {
    color: colors.text,
    fontSize: 13,
    fontWeight: '600',
  },
  dealAccept: {
    backgroundColor: colors.deal,
  },
  dealAcceptText: {
    color: colors.onStrong,
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
