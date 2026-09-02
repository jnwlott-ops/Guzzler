import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import { formatPrice } from '../lib/pricing';
import { formatMiles } from '../lib/range';
import type { TripPlan } from '../lib/tripPlanner';
import { colors, radius, spacing } from '../theme';
import type { Route, Station } from '../types';

interface TripPlanSheetProps {
  route: Route;
  plan: TripPlan;
  onClose: () => void;
  onSelectStop: (station: Station) => void;
  onAccept: () => void;
}

/**
 * The proposed plan, presented for the driver to accept.
 *
 * Deliberately shows its work — every stop with its price, what it costs, and
 * how much range is left on arrival. An automated planner that just says "trust
 * me" earns exactly one wrong recommendation before nobody uses it again.
 */
export function TripPlanSheet({
  route,
  plan,
  onClose,
  onSelectStop,
  onAccept,
}: TripPlanSheetProps) {
  return (
    <View style={styles.sheet}>
      <View style={styles.header}>
        <View style={styles.headerText}>
          <Text style={styles.title}>To {route.destinationName}</Text>
          <Text style={styles.subtitle}>
            {formatMiles(route.distanceMiles)} · {Math.round(route.durationMinutes / 60)}h{' '}
            {Math.round(route.durationMinutes % 60)}m driving
          </Text>
        </View>
        <Pressable
          onPress={onClose}
          hitSlop={12}
          accessibilityRole="button"
          accessibilityLabel="Close trip plan"
        >
          <Text style={styles.close}>✕</Text>
        </Pressable>
      </View>

      {!plan.feasible ? (
        <View style={styles.problem}>
          <Text style={styles.problemTitle}>Can't plan this trip</Text>
          <Text style={styles.problemBody}>
            {plan.reason} You can get about {formatMiles(plan.reachableToMiles)} along this
            route before running out of options.
          </Text>
        </View>
      ) : plan.stops.length === 0 ? (
        <View style={styles.noStops}>
          <Text style={styles.noStopsTitle}>No stops needed</Text>
          <Text style={styles.noStopsBody}>
            You can make it on what's in the tank, arriving with about{' '}
            {formatMiles(plan.arriveWithMiles)} to spare.
          </Text>
        </View>
      ) : (
        <>
          <View style={styles.summary}>
            <View style={styles.summaryItem}>
              <Text style={styles.summaryValue}>{plan.stops.length}</Text>
              <Text style={styles.summaryLabel}>
                {plan.stops.length === 1 ? 'stop' : 'stops'}
              </Text>
            </View>
            <View style={styles.summaryItem}>
              <Text style={styles.summaryValue}>${plan.fuelCost.toFixed(2)}</Text>
              <Text style={styles.summaryLabel}>fuel</Text>
            </View>
            <View style={styles.summaryItem}>
              <Text style={styles.summaryValue}>{formatMiles(plan.totalDetourMiles)}</Text>
              <Text style={styles.summaryLabel}>detour</Text>
            </View>
          </View>

          <ScrollView style={styles.stops} contentContainerStyle={styles.stopsContent}>
            {plan.stops.map((stop, index) => (
              <Pressable
                key={stop.station.id}
                style={styles.stop}
                onPress={() => onSelectStop(stop.station)}
                accessibilityRole="button"
              >
                <View style={styles.stopIndex}>
                  <Text style={styles.stopIndexText}>{index + 1}</Text>
                </View>
                <View style={styles.stopBody}>
                  <Text style={styles.stopName}>{stop.station.name}</Text>
                  <Text style={styles.stopMeta}>
                    {formatMiles(stop.alongMiles)} in ·{' '}
                    {formatPrice(stop.pricePerGallon)}/gal · {stop.units.toFixed(1)} gal
                  </Text>
                  <Text style={styles.stopArrival}>
                    Arrive with ~{formatMiles(stop.arriveWithMiles)} of range
                    {stop.detourMiles > 0.2 && ` · ${formatMiles(stop.detourMiles)} detour`}
                  </Text>
                </View>
                <Text style={styles.stopCost}>${stop.fuelCost.toFixed(2)}</Text>
              </Pressable>
            ))}
          </ScrollView>

          <Pressable
            style={styles.accept}
            onPress={onAccept}
            accessibilityRole="button"
            accessibilityLabel="Start navigation to the first stop"
          >
            <Text style={styles.acceptText}>Start with {plan.stops[0].station.name}</Text>
          </Pressable>
          <Text style={styles.disclaimer}>
            Estimates. Check your gauge — range varies with speed, load and weather.
          </Text>
        </>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  sheet: {
    backgroundColor: colors.background,
    borderTopLeftRadius: radius.lg,
    borderTopRightRadius: radius.lg,
    padding: spacing.lg,
    paddingBottom: spacing.xl,
    borderTopWidth: 1,
    borderColor: colors.border,
    maxHeight: '70%',
    shadowColor: '#000',
    shadowOpacity: 0.12,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: -2 },
    elevation: 8,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'flex-start',
  },
  headerText: {
    flex: 1,
  },
  title: {
    fontSize: 18,
    fontWeight: '700',
    color: colors.text,
  },
  subtitle: {
    fontSize: 13,
    color: colors.textMuted,
    marginTop: 2,
  },
  close: {
    fontSize: 16,
    color: colors.textMuted,
    paddingLeft: spacing.sm,
  },
  problem: {
    marginTop: spacing.lg,
    padding: spacing.md,
    borderRadius: radius.md,
    backgroundColor: 'rgba(196, 58, 49, 0.08)',
    borderWidth: 1,
    borderColor: colors.gouge,
  },
  problemTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: colors.gouge,
  },
  problemBody: {
    fontSize: 13,
    color: colors.text,
    marginTop: spacing.xs,
    lineHeight: 19,
  },
  noStops: {
    marginTop: spacing.lg,
    padding: spacing.md,
    borderRadius: radius.md,
    backgroundColor: 'rgba(27, 138, 75, 0.08)',
    borderWidth: 1,
    borderColor: colors.deal,
  },
  noStopsTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: colors.deal,
  },
  noStopsBody: {
    fontSize: 13,
    color: colors.text,
    marginTop: spacing.xs,
    lineHeight: 19,
  },
  summary: {
    flexDirection: 'row',
    marginTop: spacing.lg,
    borderRadius: radius.md,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    paddingVertical: spacing.md,
  },
  summaryItem: {
    flex: 1,
    alignItems: 'center',
  },
  summaryValue: {
    fontSize: 18,
    fontWeight: '800',
    color: colors.text,
    fontVariant: ['tabular-nums'],
  },
  summaryLabel: {
    fontSize: 11,
    color: colors.textMuted,
    fontWeight: '600',
    marginTop: 1,
  },
  stops: {
    marginTop: spacing.md,
  },
  stopsContent: {
    gap: spacing.sm,
  },
  stop: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: spacing.md,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.background,
  },
  stopIndex: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: colors.accent,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: spacing.md,
  },
  stopIndexText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '800',
  },
  stopBody: {
    flex: 1,
  },
  stopName: {
    fontSize: 15,
    fontWeight: '700',
    color: colors.text,
  },
  stopMeta: {
    fontSize: 12,
    color: colors.textMuted,
    marginTop: 1,
  },
  stopArrival: {
    fontSize: 11,
    color: colors.textMuted,
    marginTop: 2,
  },
  stopCost: {
    fontSize: 15,
    fontWeight: '700',
    color: colors.text,
    fontVariant: ['tabular-nums'],
    marginLeft: spacing.sm,
  },
  accept: {
    marginTop: spacing.lg,
    paddingVertical: spacing.md,
    borderRadius: radius.md,
    backgroundColor: colors.accent,
    alignItems: 'center',
  },
  acceptText: {
    color: '#FFFFFF',
    fontWeight: '700',
    fontSize: 15,
  },
  disclaimer: {
    fontSize: 11,
    color: colors.textMuted,
    textAlign: 'center',
    marginTop: spacing.sm,
  },
});
