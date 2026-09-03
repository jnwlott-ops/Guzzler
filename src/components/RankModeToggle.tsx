import { Pressable, StyleSheet, Text, View } from 'react-native';

import type { RankMode } from '../lib/value';
import { colors, radius, spacing } from '../theme';

interface RankModeToggleProps {
  value: RankMode;
  onChange: (mode: RankMode) => void;
}

const MODES: { mode: RankMode; label: string }[] = [
  { mode: 'price', label: 'Cheapest' },
  { mode: 'value', label: 'Best value' },
];

/**
 * Switches what the map is ranking on. "Best value" folds driver ratings into
 * the score, which is the ranking stations actually want to win — and the one
 * they can't buy.
 */
export function RankModeToggle({ value, onChange }: RankModeToggleProps) {
  return (
    <View style={styles.container}>
      {MODES.map(({ mode, label }) => {
        const selected = mode === value;
        return (
          <Pressable
            key={mode}
            onPress={() => onChange(mode)}
            style={[styles.segment, selected && styles.segmentSelected]}
            accessibilityRole="button"
            accessibilityState={{ selected }}
          >
            <Text style={[styles.label, selected && styles.labelSelected]}>{label}</Text>
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    padding: 3,
    borderWidth: 1,
    borderColor: colors.border,
  },
  segment: {
    flex: 1,
    paddingVertical: spacing.sm - 2,
    alignItems: 'center',
    borderRadius: radius.sm,
  },
  segmentSelected: {
    backgroundColor: colors.raised,
  },
  label: {
    fontSize: 12,
    fontWeight: '700',
    color: colors.textMuted,
  },
  labelSelected: {
    color: colors.text,
  },
});
