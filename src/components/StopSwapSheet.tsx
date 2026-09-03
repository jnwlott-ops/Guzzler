import { Modal, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import { formatMiles } from '../lib/range';
import { formatPrice } from '../lib/pricing';
import type { StopAlternative } from '../lib/tripPlanner';
import { formatRating } from '../lib/value';
import { colors, radius, spacing } from '../theme';

interface StopSwapSheetProps {
  /** Undefined when closed. */
  alternatives: StopAlternative[] | undefined;
  /** The stop being reconsidered, for the header. */
  currentName: string | undefined;
  /** True when this leg is already the driver's pick rather than Guzzler's. */
  isChosen: boolean;
  onChoose: (stationId: string) => void;
  onLetGuzzlerPick: () => void;
  onClose: () => void;
}

/**
 * The list of other places you could stop on this leg.
 *
 * Exists because a plan the driver cannot argue with is a plan they have to
 * take on faith. Guzzler's pick stays first-class — it is marked, and there is
 * a one-tap way back to it — but it is a recommendation, not a verdict.
 *
 * Unreachable options are listed and disabled rather than hidden. "That one is
 * too far on this tank" is the single most useful thing this screen can say
 * about a station the driver was already eyeing.
 */
export function StopSwapSheet({
  alternatives,
  currentName,
  isChosen,
  onChoose,
  onLetGuzzlerPick,
  onClose,
}: StopSwapSheetProps) {
  const open = alternatives !== undefined;

  return (
    <Modal visible={open} transparent animationType="slide" onRequestClose={onClose}>
      <Pressable style={styles.backdrop} onPress={onClose}>
        <Pressable style={styles.sheet} onPress={() => {}}>
          <View style={styles.header}>
            <View style={styles.headerText}>
              <Text style={styles.title}>Stop somewhere else?</Text>
              <Text style={styles.subtitle}>
                Instead of {currentName ?? 'this stop'} — same stretch of road.
              </Text>
            </View>
            <Pressable onPress={onClose} accessibilityRole="button" accessibilityLabel="Close">
              <Text style={styles.close}>✕</Text>
            </Pressable>
          </View>

          {isChosen && (
            <Pressable
              style={styles.revert}
              onPress={onLetGuzzlerPick}
              accessibilityRole="button"
            >
              <Text style={styles.revertText}>↩ Let Guzzler pick this one</Text>
            </Pressable>
          )}

          <ScrollView contentContainerStyle={styles.list}>
            {(alternatives ?? []).length === 0 && (
              <Text style={styles.empty}>
                Nothing else sells your grade on this stretch. Try a different fuel grade, or
                skip this stop to re-plan around it.
              </Text>
            )}

            {(alternatives ?? []).map((option) => (
              <Pressable
                key={option.station.id}
                style={[
                  styles.option,
                  option.isCurrent && styles.optionCurrent,
                  !option.reachable && styles.optionUnreachable,
                ]}
                disabled={!option.reachable || option.isCurrent}
                onPress={() => onChoose(option.station.id)}
                accessibilityRole="button"
                accessibilityState={{ selected: option.isCurrent, disabled: !option.reachable }}
                accessibilityLabel={
                  option.reachable
                    ? `Stop at ${option.station.name} instead`
                    : `${option.station.name}, out of range on this tank`
                }
              >
                <View style={styles.optionBody}>
                  <Text style={styles.optionName} numberOfLines={1}>
                    {option.station.name}
                    {option.isCurrent && <Text style={styles.tag}>  · planned</Text>}
                  </Text>
                  <Text style={styles.optionMeta}>
                    {formatMiles(option.alongMiles)} in
                    {option.detourMiles > 0.2 && ` · ${formatMiles(option.detourMiles)} off route`}
                    {option.station.ratings.reviewCount > 0 &&
                      ` · ${formatRating(option.station.ratings.overall)}/5`}
                  </Text>
                  {!option.reachable && (
                    <Text style={styles.unreachable}>Out of range on this tank</Text>
                  )}
                </View>
                <Text style={styles.optionPrice}>{formatPrice(option.pricePerGallon)}</Text>
              </Pressable>
            ))}
          </ScrollView>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.55)',
    justifyContent: 'flex-end',
  },
  sheet: {
    backgroundColor: colors.background,
    borderTopLeftRadius: radius.lg,
    borderTopRightRadius: radius.lg,
    padding: spacing.lg,
    maxHeight: '80%',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
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
    fontSize: 18,
    color: colors.textMuted,
    paddingHorizontal: spacing.sm,
  },
  revert: {
    marginTop: spacing.md,
    paddingVertical: spacing.sm,
  },
  revertText: {
    fontSize: 13,
    fontWeight: '700',
    color: colors.accent,
  },
  list: {
    paddingTop: spacing.md,
    gap: spacing.sm,
  },
  empty: {
    fontSize: 14,
    color: colors.textMuted,
    lineHeight: 20,
    paddingVertical: spacing.lg,
  },
  option: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    padding: spacing.md,
  },
  optionCurrent: {
    borderColor: colors.accent,
  },
  optionUnreachable: {
    opacity: 0.45,
  },
  optionBody: {
    flex: 1,
  },
  optionName: {
    fontSize: 15,
    fontWeight: '700',
    color: colors.text,
  },
  tag: {
    fontSize: 12,
    fontWeight: '600',
    color: colors.accent,
  },
  optionMeta: {
    fontSize: 12,
    color: colors.textMuted,
    marginTop: 2,
  },
  unreachable: {
    fontSize: 12,
    color: colors.gouge,
    marginTop: 2,
  },
  optionPrice: {
    fontSize: 15,
    fontWeight: '700',
    color: colors.text,
    marginLeft: spacing.md,
    fontVariant: ['tabular-nums'],
  },
});
