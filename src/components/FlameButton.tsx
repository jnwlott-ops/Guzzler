import { LinearGradient } from 'expo-linear-gradient';
import { Pressable, StyleSheet, Text, View, type StyleProp, type ViewStyle } from 'react-native';

import { brandType, colors, FLAME_GRADIENT, spacing } from '../theme';

interface FlameButtonProps {
  label: string;
  onPress: () => void;
  accessibilityLabel?: string;
  /** Drops the fire for a plain outlined chip — same shape, no shouting. */
  quiet?: boolean;
  style?: StyleProp<ViewStyle>;
}

/**
 * The one control per screen that gets a flame job.
 *
 * The gradient is the brand's whole vocabulary in one element, which is
 * precisely why there is a single component for it rather than a style anyone
 * can reach for: two of these on screen and neither is the primary action any
 * more. `quiet` exists so a companion chip can match the shape without
 * competing — see the vehicle chip next to it on the map.
 *
 * Angled top-left to bottom-right rather than straight down: a flame job on a
 * car reads along the direction of travel, and the diagonal keeps the deep red
 * out of the text's way.
 */
export function FlameButton({
  label,
  onPress,
  accessibilityLabel,
  quiet = false,
  style,
}: FlameButtonProps) {
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel ?? label}
      style={({ pressed }) => [styles.press, pressed && styles.pressed, style]}
    >
      {quiet ? (
        <View style={[styles.chip, styles.quiet]}>
          <Text style={[styles.label, styles.quietLabel]} numberOfLines={1}>
            {label}
          </Text>
        </View>
      ) : (
        <LinearGradient
          colors={[...FLAME_GRADIENT]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={styles.chip}
        >
          <Text style={styles.label} numberOfLines={1}>
            {label}
          </Text>
        </LinearGradient>
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  press: {
    borderRadius: 999,
  },
  pressed: {
    opacity: 0.85,
  },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 999,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm + 1,
  },
  quiet: {
    backgroundColor: colors.background,
    borderWidth: 1,
    borderColor: colors.border,
  },
  label: {
    ...brandType,
    fontSize: 12,
    color: colors.onAccent,
  },
  quietLabel: {
    // Same shape, plain voice. The brand shouts on the fire and nowhere else,
    // which is what makes the fire read as the primary action.
    color: colors.text,
    fontStyle: 'normal',
    fontWeight: '700',
    textTransform: 'none',
    letterSpacing: 0,
    fontSize: 13,
  },
});
