import { Pressable, StyleSheet, Text, View } from 'react-native';

import { colors, radius, spacing } from '../theme';
import { PRIORITY_PRESETS, type PriorityPresetId } from '../types';

interface PriorityControlProps {
  value: PriorityPresetId;
  onChange: (id: PriorityPresetId) => void;
}

/**
 * How hard to trade money against what the stop is actually like.
 *
 * Three named presets rather than a raw slider: "0.65" means nothing to a
 * driver, and a continuous control invites fiddling with a number whose effect
 * they can't predict. The underlying weight is continuous, so this can become a
 * slider later if the presets prove too coarse.
 */
export function PriorityControl({ value, onChange }: PriorityControlProps) {
  return (
    <View style={styles.container}>
      <Text style={styles.caption}>Priority</Text>
      <View style={styles.segments}>
        {PRIORITY_PRESETS.map((preset) => {
          const selected = preset.id === value;
          return (
            <Pressable
              key={preset.id}
              onPress={() => onChange(preset.id)}
              style={[styles.segment, selected && styles.segmentSelected]}
              accessibilityRole="button"
              accessibilityState={{ selected }}
              accessibilityLabel={`Prioritize ${preset.label}`}
            >
              <Text style={[styles.label, selected && styles.labelSelected]}>
                {preset.label}
              </Text>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  caption: {
    fontSize: 11,
    fontWeight: '700',
    color: colors.textMuted,
    letterSpacing: 0.3,
  },
  segments: {
    flex: 1,
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
    fontSize: 11,
    fontWeight: '700',
    color: colors.textMuted,
  },
  labelSelected: {
    color: colors.text,
  },
});
