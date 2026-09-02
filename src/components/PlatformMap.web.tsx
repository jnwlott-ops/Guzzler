import type { ReactNode } from 'react';
import { StyleSheet, Text, View, type StyleProp, type ViewStyle } from 'react-native';

import { colors, spacing } from '../theme';

/**
 * Web stand-ins for the native map.
 *
 * The web build exists to preview the interface — the panels, sheets, modals
 * and copy — in a browser, from a link. It is not the product: the map itself
 * needs a device, so this renders an honest placeholder rather than a broken
 * or half-faked one.
 *
 * The overlays (`Marker`, `Circle`, `Polyline`) render nothing rather than
 * approximating pin positions. A map preview that puts stations in the wrong
 * place would be worse than one that shows none.
 */

export const PROVIDER_GOOGLE = 'google';

interface MapViewProps {
  children?: ReactNode;
  style?: StyleProp<ViewStyle>;
}

export function MapView({ children, style }: MapViewProps) {
  return (
    <View style={[styles.canvas, style]}>
      <View style={styles.notice}>
        <Text style={styles.title}>Interface preview</Text>
        <Text style={styles.body}>
          The map needs a device. Open this project in Expo Go to see stations, range rings
          and routes on a real map.
        </Text>
      </View>
      {children}
    </View>
  );
}

/** Overlays are native-only; on web they simply don't draw. */
export function Marker(_props: unknown) {
  return null;
}

export function Circle(_props: unknown) {
  return null;
}

export function Polyline(_props: unknown) {
  return null;
}

const styles = StyleSheet.create({
  canvas: {
    backgroundColor: colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
  },
  notice: {
    maxWidth: 320,
    padding: spacing.lg,
    alignItems: 'center',
  },
  title: {
    fontSize: 15,
    fontWeight: '700',
    color: colors.textMuted,
  },
  body: {
    fontSize: 13,
    color: colors.textMuted,
    textAlign: 'center',
    marginTop: spacing.xs,
    lineHeight: 19,
  },
});
