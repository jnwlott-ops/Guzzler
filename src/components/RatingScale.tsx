import { Pressable, StyleSheet, Text, View } from 'react-native';

import { colors, spacing } from '../theme';

interface RatingScaleProps {
  value: number | undefined;
  /** Omit to render read-only. */
  onChange?: (rating: number) => void;
  size?: number;
  label?: string;
  /**
   * The glyph the scale is measured in. Gas stops are rated in pumps; charging
   * stops are rated in bolts, since "four out of five pumps" is nonsense at a
   * charger.
   */
  icon?: string;
}

const POINTS = [1, 2, 3, 4, 5];

/**
 * Guzzler's 1-5 rating control, in pumps rather than stars.
 *
 * Emoji have no hollow variant the way ★/☆ do, so unfilled points are the same
 * glyph dimmed. That keeps the scale readable without shipping an icon font,
 * and the accessibility label carries the real value either way.
 */
export function RatingScale({
  value,
  onChange,
  size = 20,
  label,
  icon = '⛽',
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
          <Text style={[styles.icon, { fontSize: size }, !filled && styles.iconEmpty]}>
            {icon}
          </Text>
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
    color: colors.text,
  },
  iconEmpty: {
    // Dimmed rather than hollow — emoji have no outline variant.
    opacity: 0.22,
  },
});
