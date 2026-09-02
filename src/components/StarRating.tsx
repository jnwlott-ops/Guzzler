import { Pressable, StyleSheet, Text, View } from 'react-native';

import { colors, spacing } from '../theme';

interface StarRatingProps {
  value: number | undefined;
  /** Omit to render read-only. */
  onChange?: (rating: number) => void;
  size?: number;
  label?: string;
}

const STARS = [1, 2, 3, 4, 5];

/** Five-star control. Interactive when `onChange` is supplied, static otherwise. */
export function StarRating({ value, onChange, size = 20, label }: StarRatingProps) {
  return (
    <View style={styles.row} accessibilityLabel={label}>
      {STARS.map((star) => {
        const filled = value !== undefined && value >= star - 0.5;
        const star_ = (
          <Text style={[styles.star, { fontSize: size }, filled && styles.starFilled]}>
            {filled ? '★' : '☆'}
          </Text>
        );

        return onChange ? (
          <Pressable
            key={star}
            onPress={() => onChange(star)}
            hitSlop={6}
            accessibilityRole="button"
            accessibilityLabel={`${star} star${star === 1 ? '' : 's'}`}
          >
            {star_}
          </Pressable>
        ) : (
          <View key={star}>{star_}</View>
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
  star: {
    color: colors.unknown,
  },
  starFilled: {
    color: '#E8A317',
  },
});
