import { Pressable, StyleSheet, Text, View } from 'react-native';

import type { ApproachAlert } from '../lib/approach';
import { formatMiles } from '../lib/range';
import type { Favorite } from '../hooks/useFavorites';
import { colors, radius, spacing } from '../theme';

interface ApproachBannerProps {
  alert: ApproachAlert<Favorite>;
  onNavigate: (favorite: Favorite) => void;
  onDismiss: (placeId: string) => void;
}

/**
 * "You're coming up on a place you saved."
 *
 * Leads with the distance because that's the decision: at two miles you can
 * still take the exit, at half a mile you probably can't. Carries a dismiss for
 * the same reason every other suggestion in this app does — a driver who has
 * already decided shouldn't have to keep seeing it.
 */
export function ApproachBanner({ alert, onNavigate, onDismiss }: ApproachBannerProps) {
  return (
    <View style={styles.banner}>
      <View style={styles.body}>
        <Text style={styles.title} numberOfLines={1}>
          {alert.place.name} in {formatMiles(alert.distance)}
        </Text>
        <Text style={styles.subtitle} numberOfLines={1}>
          {alert.place.address || 'Saved place'}
        </Text>
      </View>
      <View style={styles.actions}>
        <Pressable
          style={[styles.button, styles.dismiss]}
          onPress={() => onDismiss(alert.place.id)}
          accessibilityRole="button"
          accessibilityLabel={`Dismiss the alert for ${alert.place.name}`}
        >
          <Text style={styles.dismissText}>Skip</Text>
        </Pressable>
        <Pressable
          style={[styles.button, styles.go]}
          onPress={() => onNavigate(alert.place)}
          accessibilityRole="button"
          accessibilityLabel={`Get directions to ${alert.place.name}`}
        >
          <Text style={styles.goText}>Go</Text>
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  banner: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: spacing.sm,
    marginHorizontal: spacing.md,
    padding: spacing.md,
    borderRadius: radius.md,
    backgroundColor: colors.strong,
    shadowColor: '#000',
    shadowOpacity: 0.18,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 2 },
    elevation: 4,
  },
  body: {
    flex: 1,
    marginRight: spacing.sm,
  },
  title: {
    color: colors.onStrong,
    fontSize: 14,
    fontWeight: '800',
  },
  subtitle: {
    color: 'rgba(20,24,30,0.62)',
    fontSize: 12,
    marginTop: 1,
  },
  actions: {
    flexDirection: 'row',
    gap: spacing.xs + 2,
  },
  button: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm - 1,
    borderRadius: radius.sm,
  },
  dismiss: {
    backgroundColor: 'rgba(20,24,30,0.10)',
  },
  dismissText: {
    color: colors.onStrong,
    fontSize: 13,
    fontWeight: '600',
  },
  go: {
    backgroundColor: colors.accent,
  },
  goText: {
    color: colors.onAccent,
    fontSize: 13,
    fontWeight: '800',
  },
});
