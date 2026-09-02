import { ScrollView, Pressable, StyleSheet, Text, View } from 'react-native';

import { formatAge, formatPrice, priceFor, savingsPerTank, verdictFor } from '../lib/pricing';
import { formatMiles } from '../lib/range';
import { formatRating, type RankedStation, type RankMode } from '../lib/value';
import { colors, radius, spacing, verdictColor, verdictLabel } from '../theme';
import {
  AMENITY_ICONS,
  AMENITY_LABELS,
  FUEL_GRADE_LABELS,
  type FuelGrade,
  type Station,
} from '../types';
import { RatingScale } from './RatingScale';

interface StationSheetProps {
  ranked: RankedStation;
  grade: FuelGrade;
  median: number | undefined;
  mode: RankMode;
  onClose: () => void;
  onNavigate: (station: Station) => void;
  /** Omitted for read-only feeds, which hide the report affordance. */
  onReport?: (station: Station) => void;
  onRate?: (station: Station) => void;
}

/**
 * Detail card for the tapped station. Leads with the comparison rather than the
 * raw price, since "22 cents under the local median" is the thing that actually
 * tells a traveler whether to pull in here or keep driving.
 */
export function StationSheet({
  ranked,
  grade,
  median,
  mode,
  onClose,
  onNavigate,
  onReport,
  onRate,
}: StationSheetProps) {
  const { station } = ranked;
  const quote = station.prices[grade];
  const price = priceFor(station, grade);
  const verdict = verdictFor(price, median);
  const savings = savingsPerTank(price, median);
  const { restroom, overall, reviewCount } = station.ratings;

  return (
    <View style={styles.sheet}>
      <View style={styles.header}>
        <View style={styles.headerText}>
          <Text style={styles.brand}>{station.name}</Text>
          <Text style={styles.address}>
            {ranked.distance !== undefined && `${formatMiles(ranked.distance)} · `}
            {station.address}
          </Text>
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
        {mode === 'value' && ranked.value !== undefined && (
          <View style={styles.valueBadge}>
            <Text style={styles.valueScore}>{ranked.value}</Text>
            <Text style={styles.valueCaption}>value</Text>
          </View>
        )}
      </View>

      <View style={styles.pills}>
        <View style={[styles.verdictPill, { backgroundColor: verdictColor[verdict] }]}>
          <Text style={styles.verdictText}>{verdictLabel[verdict]}</Text>
        </View>
        {/* Only worth saying when it's a warning; "you can reach this" is noise. */}
        {ranked.reachability !== 'comfortable' && (
          <View
            style={[
              styles.verdictPill,
              {
                backgroundColor:
                  ranked.reachability === 'unreachable' ? colors.gouge : colors.typical,
              },
            ]}
          >
            <Text style={styles.verdictText}>
              {ranked.reachability === 'unreachable' ? 'Out of range' : 'Into your reserve'}
            </Text>
          </View>
        )}
      </View>

      {savings !== undefined && Math.abs(savings) >= 0.5 && (
        <Text style={styles.savings}>
          {savings > 0
            ? `Save about $${savings.toFixed(2)} on a 14-gallon fill-up here.`
            : `Costs about $${Math.abs(savings).toFixed(2)} more than a typical nearby stop.`}
        </Text>
      )}

      {/* Driver ratings. Separate from anything an advertiser can buy. */}
      <View style={styles.ratings}>
        <View style={styles.ratingRow}>
          <Text style={styles.ratingLabel}>🚻 Restroom</Text>
          <View style={styles.ratingValue}>
            <RatingScale value={restroom} size={14} />
            <Text style={styles.ratingNumber}>{formatRating(restroom)}</Text>
          </View>
        </View>
        <View style={styles.ratingRow}>
          <Text style={styles.ratingLabel}>Overall stop</Text>
          <View style={styles.ratingValue}>
            <RatingScale value={overall} size={14} />
            <Text style={styles.ratingNumber}>{formatRating(overall)}</Text>
          </View>
        </View>
        <Text style={styles.reviewCount}>
          {reviewCount === 0
            ? 'No driver ratings yet — be the first.'
            : `${reviewCount} driver rating${reviewCount === 1 ? '' : 's'}`}
        </Text>
      </View>

      {station.amenities.length > 0 && (
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.amenities}
        >
          {station.amenities.map((amenity) => (
            <View key={amenity} style={styles.amenityChip}>
              <Text style={styles.amenityIcon}>{AMENITY_ICONS[amenity]}</Text>
              <Text style={styles.amenityLabel}>{AMENITY_LABELS[amenity]}</Text>
            </View>
          ))}
        </ScrollView>
      )}

      {/*
        Paid placement. The label is not optional: an offer rendered without it
        is an undisclosed ad, and the ranking above it stays untouched either way.
      */}
      {station.sponsored?.offer && (
        <View style={styles.sponsored}>
          <Text style={styles.sponsoredTag}>SPONSORED</Text>
          <Text style={styles.sponsoredOffer}>{station.sponsored.offer}</Text>
        </View>
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
        {onRate && (
          <Pressable
            style={[styles.button, styles.buttonSecondary]}
            onPress={() => onRate(station)}
            accessibilityRole="button"
          >
            <Text style={styles.buttonSecondaryText}>Rate stop</Text>
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
    flex: 1,
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
  valueBadge: {
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
    borderWidth: 1,
    borderColor: colors.border,
  },
  valueScore: {
    fontSize: 20,
    fontWeight: '800',
    color: colors.text,
    fontVariant: ['tabular-nums'],
  },
  valueCaption: {
    fontSize: 10,
    fontWeight: '700',
    color: colors.textMuted,
    letterSpacing: 0.5,
  },
  pills: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
    marginTop: spacing.md,
  },
  verdictPill: {
    alignSelf: 'flex-start',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs + 2,
    borderRadius: radius.sm,
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
  ratings: {
    marginTop: spacing.lg,
    paddingTop: spacing.md,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  ratingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: spacing.xs,
  },
  ratingLabel: {
    fontSize: 14,
    color: colors.text,
    fontWeight: '600',
  },
  ratingValue: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  ratingNumber: {
    fontSize: 13,
    fontWeight: '700',
    color: colors.textMuted,
    fontVariant: ['tabular-nums'],
    minWidth: 24,
    textAlign: 'right',
  },
  reviewCount: {
    fontSize: 12,
    color: colors.textMuted,
    marginTop: spacing.xs,
  },
  amenities: {
    gap: spacing.sm,
    marginTop: spacing.md,
  },
  amenityChip: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderRadius: 999,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs + 1,
    borderWidth: 1,
    borderColor: colors.border,
  },
  amenityIcon: {
    fontSize: 12,
    marginRight: spacing.xs,
  },
  amenityLabel: {
    fontSize: 12,
    color: colors.text,
    fontWeight: '600',
  },
  sponsored: {
    marginTop: spacing.md,
    padding: spacing.md,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
  },
  sponsoredTag: {
    fontSize: 10,
    fontWeight: '800',
    color: colors.textMuted,
    letterSpacing: 0.8,
  },
  sponsoredOffer: {
    fontSize: 14,
    color: colors.text,
    fontWeight: '600',
    marginTop: 2,
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
    fontSize: 14,
  },
});
