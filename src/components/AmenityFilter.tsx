import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import { colors, radius, spacing } from '../theme';
import { AMENITY_ICONS } from './icons/amenityIcons';
import { AMENITIES, AMENITY_LABELS, type Amenity } from '../types';

interface AmenityFilterProps {
  selected: Amenity[];
  onToggle: (amenity: Amenity) => void;
}

/**
 * Horizontal chip row for narrowing the map to stops that have what you need.
 *
 * Filtering rather than re-ranking on purpose: "I need a truck-accessible stop"
 * is a hard requirement, not a preference to be weighed against price.
 */
export function AmenityFilter({ selected, onToggle }: AmenityFilterProps) {
  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      contentContainerStyle={styles.row}
      keyboardShouldPersistTaps="handled"
    >
      {AMENITIES.map((amenity) => {
        const active = selected.includes(amenity);
        const Icon = AMENITY_ICONS[amenity];
        return (
          <Pressable
            key={amenity}
            onPress={() => onToggle(amenity)}
            style={[styles.chip, active && styles.chipActive]}
            accessibilityRole="button"
            accessibilityState={{ selected: active }}
            accessibilityLabel={`Filter by ${AMENITY_LABELS[amenity]}`}
          >
            <View style={styles.icon}>
              <Icon size={14} color={active ? colors.onAccent : colors.textMuted} />
            </View>
            <Text style={[styles.label, active && styles.labelActive]}>
              {AMENITY_LABELS[amenity]}
            </Text>
          </Pressable>
        );
      })}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  row: {
    gap: spacing.sm,
    paddingVertical: 2,
  },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm - 1,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
  },
  chipActive: {
    backgroundColor: colors.accent,
    borderColor: colors.accent,
  },
  icon: {
    marginRight: spacing.xs + 1,
  },
  label: {
    fontSize: 12,
    fontWeight: '600',
    color: colors.textMuted,
  },
  labelActive: {
    color: colors.onAccent,
  },
});
