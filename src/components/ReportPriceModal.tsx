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

import { colors, radius, spacing } from '../theme';
import { FUEL_GRADE_LABELS, type FuelGrade, type PriceReport, type Station } from '../types';

interface ReportPriceModalProps {
  station: Station | undefined;
  grade: FuelGrade;
  onSubmit: (report: PriceReport) => Promise<void>;
  onClose: () => void;
}

/** Prices outside this range are almost certainly typos, not real pumps. */
const MIN_PRICE = 0.5;
const MAX_PRICE = 15;

/**
 * Crowdsourced price entry. Kept to a single field on purpose — every extra tap
 * between the pump and a submitted price costs reports, and reports are what
 * make the map worth opening.
 */
export function ReportPriceModal({ station, grade, onSubmit, onClose }: ReportPriceModalProps) {
  const [value, setValue] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | undefined>();

  const close = () => {
    setValue('');
    setError(undefined);
    onClose();
  };

  const submit = async () => {
    const price = Number.parseFloat(value);
    if (!Number.isFinite(price) || price < MIN_PRICE || price > MAX_PRICE) {
      setError(`Enter a price between $${MIN_PRICE.toFixed(2)} and $${MAX_PRICE.toFixed(2)}.`);
      return;
    }
    if (!station) return;

    setSubmitting(true);
    try {
      await onSubmit({
        stationId: station.id,
        grade,
        price: Math.round(price * 100) / 100,
        reportedAt: new Date().toISOString(),
      });
      close();
    } catch {
      setError('Could not submit that price. Try again.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Modal
      visible={station !== undefined}
      transparent
      animationType="fade"
      onRequestClose={close}
    >
      <KeyboardAvoidingView
        style={styles.backdrop}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <View style={styles.card}>
          <Text style={styles.title}>Report {FUEL_GRADE_LABELS[grade]}</Text>
          <Text style={styles.subtitle}>{station?.name} · {station?.address}</Text>

          <View style={styles.inputRow}>
            <Text style={styles.currency}>$</Text>
            <TextInput
              style={styles.input}
              value={value}
              onChangeText={(text) => {
                setValue(text);
                setError(undefined);
              }}
              placeholder="3.29"
              placeholderTextColor={colors.unknown}
              keyboardType="decimal-pad"
              autoFocus
              maxLength={6}
              accessibilityLabel="Price per gallon"
            />
          </View>

          {error && <Text style={styles.error}>{error}</Text>}

          <View style={styles.actions}>
            <Pressable style={[styles.button, styles.cancel]} onPress={close}>
              <Text style={styles.cancelText}>Cancel</Text>
            </Pressable>
            <Pressable
              style={[styles.button, styles.confirm, submitting && styles.disabled]}
              onPress={submit}
              disabled={submitting}
            >
              <Text style={styles.confirmText}>{submitting ? 'Sending…' : 'Submit'}</Text>
            </Pressable>
          </View>
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
  },
  inputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    paddingHorizontal: spacing.md,
    marginTop: spacing.lg,
    backgroundColor: colors.surface,
  },
  currency: {
    fontSize: 28,
    fontWeight: '700',
    color: colors.textMuted,
  },
  input: {
    flex: 1,
    fontSize: 28,
    fontWeight: '700',
    color: colors.text,
    paddingVertical: spacing.md,
    marginLeft: spacing.xs,
    fontVariant: ['tabular-nums'],
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
});
