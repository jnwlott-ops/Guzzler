import { useState } from 'react';
import {
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
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
