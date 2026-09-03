import { useState } from 'react';
import {
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';

import { activeRouteProvider } from '../data/routeProvider';
import { colors, radius, spacing } from '../theme';

interface TripModalProps {
  visible: boolean;
  loading: boolean;
  error: string | undefined;
  onPlan: (destination: string) => void;
  onClose: () => void;
}

/** Destination entry. One field — the plan is where the interesting UI lives. */
export function TripModal({ visible, loading, error, onPlan, onClose }: TripModalProps) {
  const [destination, setDestination] = useState('');

  const submit = () => {
    const trimmed = destination.trim();
    if (trimmed.length > 0) onPlan(trimmed);
  };

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <KeyboardAvoidingView
        style={styles.backdrop}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <View style={styles.card}>
          <Text style={styles.title}>Plan a trip</Text>
          <Text style={styles.subtitle}>
            We'll pick the best-value stops along the way and show you the plan before
            anything changes.
          </Text>

          <TextInput
            style={styles.input}
            value={destination}
            onChangeText={setDestination}
            placeholder="Where to?"
            placeholderTextColor={colors.unknown}
            autoFocus
            returnKeyType="go"
            onSubmitEditing={submit}
            maxLength={80}
            accessibilityLabel="Destination"
          />

          {/* When the provider can only resolve a fixed set, offer it rather
              than letting someone type a place it will fail on. A real
              geocoder leaves knownDestinations undefined and this disappears. */}
          {activeRouteProvider.knownDestinations && (
            <View style={styles.suggestions}>
              <Text style={styles.suggestionsLabel}>Demo routing knows</Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                <View style={styles.chips}>
                  {activeRouteProvider.knownDestinations.map((place) => (
                    <Pressable
                      key={place}
                      style={styles.chip}
                      onPress={() => {
                        setDestination(place);
                        onPlan(place);
                      }}
                      accessibilityRole="button"
                      accessibilityLabel={`Plan a trip to ${place}`}
                    >
                      <Text style={styles.chipText}>{place}</Text>
                    </Pressable>
                  ))}
                </View>
              </ScrollView>
            </View>
          )}

          {error && <Text style={styles.error}>{error}</Text>}

          <View style={styles.actions}>
            <Pressable style={[styles.button, styles.cancel]} onPress={onClose}>
              <Text style={styles.cancelText}>Cancel</Text>
            </Pressable>
            <Pressable
              style={[styles.button, styles.confirm, loading && styles.disabled]}
              onPress={submit}
              disabled={loading}
            >
              <Text style={styles.confirmText}>{loading ? 'Planning…' : 'Plan'}</Text>
            </Pressable>
          </View>

          <Text style={styles.attribution}>Routes: {activeRouteProvider.name}</Text>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.45)',
    justifyContent: 'center',
    padding: spacing.xl,
  },
  card: {
    backgroundColor: colors.background,
    borderRadius: radius.lg,
    padding: spacing.lg,
  },
  title: {
    fontSize: 18,
    fontWeight: '700',
    color: colors.text,
  },
  subtitle: {
    fontSize: 13,
    color: colors.textMuted,
    marginTop: 2,
    lineHeight: 18,
  },
  input: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    backgroundColor: colors.surface,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.md,
    fontSize: 16,
    color: colors.text,
    marginTop: spacing.lg,
  },
  suggestions: {
    marginTop: spacing.md,
    gap: spacing.sm,
  },
  suggestionsLabel: {
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 0.4,
    textTransform: 'uppercase',
    color: colors.textMuted,
  },
  chips: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  chip: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm - 1,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
  },
  chipText: {
    fontSize: 12,
    fontWeight: '600',
    color: colors.text,
  },
  error: {
    color: colors.gouge,
    fontSize: 13,
    marginTop: spacing.sm,
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
  cancel: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
  },
  cancelText: {
    color: colors.text,
    fontWeight: '600',
    fontSize: 15,
  },
  confirm: {
    backgroundColor: colors.accent,
  },
  confirmText: {
    color: '#FFFFFF',
    fontWeight: '700',
    fontSize: 15,
  },
  disabled: {
    opacity: 0.6,
  },
  attribution: {
    fontSize: 11,
    color: colors.textMuted,
    textAlign: 'center',
    marginTop: spacing.md,
  },
});
