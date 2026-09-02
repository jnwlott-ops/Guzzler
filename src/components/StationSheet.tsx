import { Pressable, StyleSheet, Text, View } from 'react-native';

import {
  formatAge,
  formatPrice,
  priceFor,
  savingsPerTank,
  verdictFor,
} from '../lib/pricing';
import { colors, radius, spacing, verdictColor, verdictLabel } from '../theme';
import { FUEL_GRADE_LABELS, type FuelGrade, type Station } from '../types';

interface StationSheetProps {
  station: Station;
  grade: FuelGrade;
  median: number | undefined;
  onClose: () => void;
  onNavigate: (station: Station) => void;
  /** Omitted for read-only feeds, which hide the report affordance. */
  onReport?: (station: Station) => void;
}

/**
 * Detail card for the tapped station. Leads with the comparison rather than the
 * raw price, since "22 cents under the local median" is the thing that actually
 * tells a traveler whether to pull in here or keep driving.
 */
export function StationSheet({
  station,
  grade,
  median,
  onClose,
  onNavigate,
  onReport,
}: StationSheetProps) {
  const quote = station.prices[grade];
  const price = priceFor(station, grade);
  const verdict = verdictFor(price, median);
  const savings = savingsPerTank(price, median);

  return (
    <View style={styles.sheet}>
      <View style={styles.header}>
        <View style={styles.headerText}>
          <Text style={styles.brand}>{station.name}</Text>
          <Text style={styles.address}>{station.address}</Text>
        </View>
        <Pressable
          onPress={onClose}
          hitSlop={12}
          accessibilityRole="button"
          accessibilityLabel="Close station details"
        >
          <Text style={styles.close}>✕</Text>
        </Pressable>
      </View>

      <View style={styles.priceRow}>
        <Text style={styles.price}>{formatPrice(price)}</Text>
        <View style={styles.priceMeta}>
          <Text style={styles.gradeLabel}>{FUEL_GRADE_LABELS[grade]}/gal</Text>
          <Text style={styles.age}>
            {formatAge(quote?.reportedAt)}
            {quote?.source === 'crowdsourced' ? ' · driver report' : ''}
          </Text>
        </View>
      </View>

      <View style={[styles.verdictPill, { backgroundColor: verdictColor[verdict] }]}>
        <Text style={styles.verdictText}>{verdictLabel[verdict]}</Text>
      </View>

      {savings !== undefined && Math.abs(savings) >= 0.5 && (
        <Text style={styles.savings}>
          {savings > 0
            ? `Save about $${savings.toFixed(2)} on a 14-gallon fill-up here.`
            : `Costs about $${Math.abs(savings).toFixed(2)} more than a typical nearby stop.`}
        </Text>
      )}

      <View style={styles.actions}>
        <Pressable
          style={[styles.button, styles.buttonPrimary]}
          onPress={() => onNavigate(station)}
          accessibilityRole="button"
        >
          <Text style={styles.buttonPrimaryText}>Directions</Text>
        </Pressable>
        {onReport && (
          <Pressable
            style={[styles.button, styles.buttonSecondary]}
            onPress={() => onReport(station)}
            accessibilityRole="button"
          >
            <Text style={styles.buttonSecondaryText}>Report price</Text>
          </Pressable>
        )}
      </View>
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
  brand: {
    fontSize: 18,
    fontWeight: '700',
    color: colors.text,
  },
  address: {
    fontSize: 13,
    color: colors.textMuted,
    marginTop: 2,
  },
  close: {
    fontSize: 16,
    color: colors.textMuted,
    paddingLeft: spacing.sm,
  },
  priceRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    marginTop: spacing.lg,
  },
  price: {
    fontSize: 40,
    fontWeight: '800',
    color: colors.text,
    fontVariant: ['tabular-nums'],
  },
  priceMeta: {
    marginLeft: spacing.md,
  },
  gradeLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.text,
  },
  age: {
    fontSize: 12,
    color: colors.textMuted,
    marginTop: 1,
  },
  verdictPill: {
    alignSelf: 'flex-start',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs + 2,
    borderRadius: radius.sm,
    marginTop: spacing.md,
  },
  verdictText: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '700',
  },
  savings: {
    fontSize: 14,
    color: colors.text,
    marginTop: spacing.md,
    lineHeight: 20,
  },
  actions: {
    flexDirection: 'row',
    gap: spacing.sm,
    marginTop: spacing.lg,
  },
  button: {
    flex: 1,
    paddingVertical: spacing.md,
    borderRadius: radius.md,
    alignItems: 'center',
  },
  buttonPrimary: {
    backgroundColor: colors.accent,
  },
  buttonPrimaryText: {
    color: '#FFFFFF',
    fontWeight: '700',
    fontSize: 15,
  },
  buttonSecondary: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
  },
  buttonSecondaryText: {
    color: colors.text,
    fontWeight: '600',
    fontSize: 15,
  },
});
