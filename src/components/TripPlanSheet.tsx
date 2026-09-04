import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import { formatPrice } from '../lib/pricing';
import { formatMiles } from '../lib/range';
import type { PlannedStop, TripPlan } from '../lib/tripPlanner';
import { CloseIcon } from './icons';
import { colors, radius, spacing } from '../theme';
import type { Route, Station } from '../types';

interface TripPlanSheetProps {
  route: Route;
  plan: TripPlan;
  /** Opens the list of other stops on this leg. */
  onSwapStop: (stopIndex: number) => void;
  /** Station ids the driver picked, so their legs can say so. */
  chosenStationIds: readonly string[];
  /** Off-route stops still awaiting a yes or no. */
  pending: PlannedStop[];
  /** True once every off-route stop has been accepted. */
  live: boolean;
  rejectedCount: number;
  onClose: () => void;
  onSelectStop: (station: Station) => void;
  onApprove: (stationId: string) => void;
  onReject: (station: Station) => void;
  onRestoreRejected: () => void;
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
  onSwapStop,
  chosenStationIds,
  route,
  plan,
  pending,
  live,
  rejectedCount,
  onClose,
  onSelectStop,
  onApprove,
  onReject,
  onRestoreRejected,
  onAccept,
}: TripPlanSheetProps) {
  const isPending = (stationId: string) => pending.some((s) => s.station.id === stationId);

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
          <CloseIcon size={16} color={colors.textMuted} />
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

          {pending.length > 0 && (
            <Text style={styles.pendingNotice}>
              {pending.length === 1 ? 'One stop takes' : `${pending.length} stops take`} you off
              your route. Approve or skip {pending.length === 1 ? 'it' : 'them'} to continue.
            </Text>
          )}

          <ScrollView style={styles.stops} contentContainerStyle={styles.stopsContent}>
            {plan.stops.map((stop, index) => {
              const awaiting = isPending(stop.station.id);

              return (
                <View
                  key={stop.station.id}
                  style={[styles.stop, awaiting && styles.stopPending]}
                >
                  <Pressable
                    style={styles.stopRow}
                    onPress={() => onSelectStop(stop.station)}
                    accessibilityRole="button"
                  >
                    <View style={[styles.stopIndex, awaiting && styles.stopIndexPending]}>
                      <Text style={styles.stopIndexText}>{awaiting ? '?' : index + 1}</Text>
                    </View>
                    <View style={styles.stopBody}>
                      <Text style={styles.stopName}>
                        {stop.station.name}
                        {chosenStationIds.includes(stop.station.id) && (
                          <Text style={styles.yourPick}>  · your pick</Text>
                        )}
                      </Text>
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

                  {/* The plan is a recommendation, so every stop in it has to
                      be arguable. Without this the sheet just says "go to
                      Chevron" and the driver has no say at all. */}
                  <Pressable
                    style={styles.swap}
                    onPress={() => onSwapStop(index)}
                    accessibilityRole="button"
                    accessibilityLabel={`Choose a different stop instead of ${stop.station.name}`}
                  >
                    <Text style={styles.swapText}>Stop somewhere else</Text>
                  </Pressable>

                  {awaiting && (
                    <View style={styles.approval}>
                      <Text style={styles.approvalPrompt}>
                        {formatMiles(stop.detourMiles)} off your route. Worth it?
                      </Text>
                      <View style={styles.approvalButtons}>
                        <Pressable
                          style={[styles.approvalButton, styles.rejectButton]}
                          onPress={() => onReject(stop.station)}
                          accessibilityRole="button"
                          accessibilityLabel={`Skip ${stop.station.name}`}
                        >
                          <Text style={styles.rejectText}>Skip</Text>
                        </Pressable>
                        <Pressable
                          style={[styles.approvalButton, styles.approveButton]}
                          onPress={() => onApprove(stop.station.id)}
                          accessibilityRole="button"
                          accessibilityLabel={`Approve the detour to ${stop.station.name}`}
                        >
                          <Text style={styles.approveText}>Approve</Text>
                        </Pressable>
                      </View>
                    </View>
                  )}
                </View>
              );
            })}
          </ScrollView>

          {rejectedCount > 0 && (
            <Pressable onPress={onRestoreRejected} style={styles.restore}>
              <Text style={styles.restoreText}>
                {rejectedCount} skipped · tap to reconsider
              </Text>
            </Pressable>
          )}

          <Pressable
            style={[styles.accept, !live && styles.acceptDisabled]}
            onPress={onAccept}
            disabled={!live}
            accessibilityRole="button"
            accessibilityState={{ disabled: !live }}
            accessibilityLabel={
              live
                ? `Start navigation to ${plan.stops[0].station.name}`
                : 'Approve or skip the off-route stops first'
            }
          >
            <Text style={styles.acceptText}>
              {live ? `Start with ${plan.stops[0].station.name}` : 'Decide on the detours first'}
            </Text>
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
  swap: {
    paddingTop: spacing.sm,
    paddingBottom: spacing.xs,
    paddingLeft: spacing.xl + spacing.sm,
  },
  swapText: {
    fontSize: 12,
    fontWeight: '700',
    color: colors.accent,
  },
  yourPick: {
    fontSize: 12,
    fontWeight: '600',
    color: colors.accent,
  },
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
  pendingNotice: {
    fontSize: 12,
    color: colors.typical,
    fontWeight: '700',
    marginTop: spacing.md,
    lineHeight: 17,
  },
  stop: {
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.background,
    overflow: 'hidden',
  },
  stopPending: {
    borderColor: colors.typical,
    borderWidth: 1.5,
  },
  stopRow: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: spacing.md,
  },
  approval: {
    borderTopWidth: 1,
    borderTopColor: colors.border,
    padding: spacing.md,
    backgroundColor: colors.surface,
  },
  approvalPrompt: {
    fontSize: 12,
    fontWeight: '600',
    color: colors.text,
    marginBottom: spacing.sm,
  },
  approvalButtons: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  approvalButton: {
    flex: 1,
    paddingVertical: spacing.sm + 2,
    borderRadius: radius.sm,
    alignItems: 'center',
  },
  rejectButton: {
    backgroundColor: colors.background,
    borderWidth: 1,
    borderColor: colors.border,
  },
  rejectText: {
    fontSize: 13,
    fontWeight: '600',
    color: colors.text,
  },
  approveButton: {
    backgroundColor: colors.deal,
  },
  approveText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  restore: {
    paddingVertical: spacing.sm,
    alignItems: 'center',
  },
  restoreText: {
    fontSize: 12,
    color: colors.accent,
    fontWeight: '600',
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
  stopIndexPending: {
    backgroundColor: colors.typical,
  },
  stopIndexText: {
    color: colors.onAccent,
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
  acceptDisabled: {
    backgroundColor: colors.unknown,
  },
  acceptText: {
    color: colors.onAccent,
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
