import { useState } from 'react';
import { Modal, Pressable, StyleSheet, Text, View } from 'react-native';

import { colors, radius, spacing } from '../theme';
import type { RatingSubmission, Station } from '../types';
import { RatingScale } from './RatingScale';

interface RateStationModalProps {
  station: Station | undefined;
  onSubmit: (rating: RatingSubmission) => Promise<void>;
  onClose: () => void;
}

/**
 * Driver rating entry — the input side of the ranking users own.
 *
 * Restroom gets its own axis rather than being folded into a single overall
 * score, because it is the thing travelers actually decide stops on and the
 * detail no price feed can sell us.
 */
export function RateStationModal({ station, onSubmit, onClose }: RateStationModalProps) {
  const [restroom, setRestroom] = useState<number | undefined>();
  const [food, setFood] = useState<number | undefined>();
  const [overall, setOverall] = useState<number | undefined>();
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | undefined>();

  const close = () => {
    setRestroom(undefined);
    setFood(undefined);
    setOverall(undefined);
    setError(undefined);
    onClose();
  };

  const submit = async () => {
    if (restroom === undefined && food === undefined && overall === undefined) {
      setError('Rate at least one thing.');
      return;
    }
    if (!station) return;

    setSubmitting(true);
    try {
      await onSubmit({
        stationId: station.id,
        restroom,
        food,
        overall,
        submittedAt: new Date().toISOString(),
      });
      close();
    } catch {
      setError('Could not save that rating. Try again.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Modal visible={station !== undefined} transparent animationType="fade" onRequestClose={close}>
      <View style={styles.backdrop}>
        <View style={styles.card}>
          <Text style={styles.title}>Rate this stop</Text>
          <Text style={styles.subtitle}>{station?.name} · {station?.address}</Text>
          <Text style={styles.scaleHint}>1–5 pumps</Text>

          <View style={styles.field}>
            <Text style={styles.fieldLabel}>Restroom</Text>
            <RatingScale value={restroom} onChange={setRestroom} size={30} label="Restroom rating" />
          </View>

          <View style={styles.field}>
            <Text style={styles.fieldLabel}>Food</Text>
            <RatingScale value={food} onChange={setFood} size={30} label="Food rating" />
          </View>

          <View style={styles.field}>
            <Text style={styles.fieldLabel}>Overall stop</Text>
            <RatingScale value={overall} onChange={setOverall} size={30} label="Overall rating" />
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
              <Text style={styles.confirmText}>{submitting ? 'Saving…' : 'Submit'}</Text>
            </Pressable>
          </View>
        </View>
      </View>
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
  scaleHint: {
    fontSize: 11,
    fontWeight: '700',
    color: colors.textMuted,
    letterSpacing: 0.5,
    marginTop: spacing.sm,
  },
  field: {
    marginTop: spacing.lg,
  },
  fieldLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.text,
    marginBottom: spacing.sm,
  },
  error: {
    color: colors.gouge,
    fontSize: 13,
    marginTop: spacing.md,
  },
  actions: {
    flexDirection: 'row',
    gap: spacing.sm,
    marginTop: spacing.xl,
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
