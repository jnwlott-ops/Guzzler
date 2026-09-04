import type { ComponentType } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { PumpIcon, type IconProps } from './icons';
import { colors, spacing } from '../theme';

interface RatingScaleProps {
  value: number | undefined;
  /** Omit to render read-only. */
  onChange?: (rating: number) => void;
  size?: number;
  label?: string;
  /**
   * The mark the scale is measured in. Gas stops are rated in pumps; charging
   * stops are rated in bolts, since "four out of five pumps" is nonsense at a
   * charger.
   */
  icon?: ComponentType<IconProps>;
}

const POINTS = [1, 2, 3, 4, 5];

/**
 * Guzzler's 1-5 rating control, in pumps rather than stars.
 *
 * Unfilled points are the same mark in the muted colour rather than a hollow
 * outline: these run at 14px inside the station sheet, where an outline pump
 * turns to mush. Colour survives that size; line weight does not. The
 * accessibility label carries the real value either way.
 */
export function RatingScale({
  value,
  onChange,
  size = 20,
  label,
  icon: Icon = PumpIcon,
}: RatingScaleProps) {
  return (
    <View
      style={styles.row}
      accessibilityLabel={
        label ?? (value === undefined ? 'Not yet rated' : `${value} out of 5`)
      }
    >
      {POINTS.map((point) => {
        // Round-half-up so a 4.5 average shows five marks rather than four.
        const filled = value !== undefined && value >= point - 0.5;
        const glyph = (
          <View style={styles.icon}>
            <Icon size={size} color={filled ? colors.accent : colors.unknown} />
          </View>
        );

        return onChange ? (
          <Pressable
            key={point}
            onPress={() => onChange(point)}
            hitSlop={6}
            accessibilityRole="button"
            accessibilityLabel={`Rate ${point} of 5`}
          >
            {glyph}
          </Pressable>
        ) : (
          <View key={point}>{glyph}</View>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    gap: spacing.xs / 2,
  },
  icon: {
    paddingHorizontal: 1,
  },
});
