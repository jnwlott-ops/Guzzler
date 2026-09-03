import { useEffect, useState } from 'react';
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

import { estimateRange, formatLevel, formatMiles } from '../lib/range';
import { colors, radius, spacing } from '../theme';
import { VEHICLE_UNITS, type Vehicle, type VehicleFuelType } from '../types';
import { DEFAULT_VEHICLE } from '../hooks/useVehicle';

interface VehicleModalProps {
  visible: boolean;
  vehicle: Vehicle | undefined;
  onSave: (vehicle: Vehicle) => Promise<void>;
  onClear: () => Promise<void>;
  onClose: () => void;
}

const LEVELS = [0, 0.25, 0.5, 0.75, 1];

/**
 * Vehicle setup. Deliberately four fields and a level picker rather than a
 * year/make/model lookup: the driver knows their own MPG and tank size, and
 * making them page through three dropdowns before the map is useful would cost
 * more users than the precision is worth.
 *
 * A lookup against the free EPA fueleconomy.gov API is the obvious upgrade —
 * see docs/RANGE.md.
 */
export function VehicleModal({ visible, vehicle, onSave, onClear, onClose }: VehicleModalProps) {
  const [label, setLabel] = useState('');
  const [fuelType, setFuelType] = useState<VehicleFuelType>('gas');
  const [capacity, setCapacity] = useState('');
  const [efficiency, setEfficiency] = useState('');
  const [level, setLevel] = useState(0.5);
  const [error, setError] = useState<string | undefined>();

  // Re-seed the form each time it opens, so cancelling never leaves half-typed
  // values behind for the next open.
  //
  // Only ever prefilled from a vehicle the driver actually saved. Seeding a
  // new form from DEFAULT_VEHICLE meant every field arrived pre-typed, so
  // naming your own car started with deleting the words "My car" — a default
  // that has to be erased is worse than no default at all. Empty fields let
  // the placeholders show what to write instead.
  useEffect(() => {
    if (!visible) return;
    setLabel(vehicle?.label ?? '');
    setFuelType(vehicle?.fuelType ?? DEFAULT_VEHICLE.fuelType);
    setCapacity(vehicle ? String(vehicle.capacity) : '');
    setEfficiency(vehicle ? String(vehicle.efficiency) : '');
    setLevel(vehicle?.level ?? DEFAULT_VEHICLE.level);
    setError(undefined);
  }, [visible, vehicle]);

  const units = VEHICLE_UNITS[fuelType];

  const parsedCapacity = Number.parseFloat(capacity);
  const parsedEfficiency = Number.parseFloat(efficiency);

  // Live preview, so the driver sees the consequence of what they typed before
  // committing to it.
  const preview = estimateRange({
    label,
    fuelType,
    capacity: parsedCapacity,
    efficiency: parsedEfficiency,
    level,
  });

  const submit = async () => {
    if (!Number.isFinite(parsedCapacity) || parsedCapacity <= 0) {
      setError(`Enter a ${fuelType === 'gas' ? 'tank size' : 'battery size'} in ${units.capacity}.`);
      return;
    }
    if (!Number.isFinite(parsedEfficiency) || parsedEfficiency <= 0) {
      setError(`Enter an efficiency in ${units.efficiency}.`);
      return;
    }

    await onSave({
      label: label.trim() || DEFAULT_VEHICLE.label,
      fuelType,
      capacity: parsedCapacity,
      efficiency: parsedEfficiency,
      level,
    });
    onClose();
  };

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <KeyboardAvoidingView
        style={styles.backdrop}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <View style={styles.card}>
          <ScrollView keyboardShouldPersistTaps="handled">
            <Text style={styles.title}>Your vehicle</Text>
            <Text style={styles.subtitle}>
              Used to show how far you can get on what's in the tank.
            </Text>

            <View style={styles.field}>
              <Text style={styles.fieldLabel}>Name</Text>
              <TextInput
                style={styles.input}
                value={label}
                onChangeText={setLabel}
                selectTextOnFocus
                placeholder="2019 Camry"
                placeholderTextColor={colors.unknown}
                maxLength={40}
              />
            </View>

            <View style={styles.field}>
              <Text style={styles.fieldLabel}>Fuel</Text>
              <View style={styles.segments}>
                {(['gas', 'ev'] as const).map((type) => (
                  <Pressable
                    key={type}
                    onPress={() => setFuelType(type)}
                    style={[styles.segment, fuelType === type && styles.segmentActive]}
                    accessibilityRole="button"
                    accessibilityState={{ selected: fuelType === type }}
                  >
                    <Text
                      style={[
                        styles.segmentText,
                        fuelType === type && styles.segmentTextActive,
                      ]}
                    >
                      {type === 'gas' ? '⛽ Gas' : '⚡ Electric'}
                    </Text>
                  </Pressable>
                ))}
              </View>
            </View>

            <View style={styles.row}>
              <View style={styles.rowField}>
                <Text style={styles.fieldLabel}>
                  {fuelType === 'gas' ? 'Tank' : 'Battery'} ({units.capacity})
                </Text>
                <TextInput
                  style={styles.input}
                  value={capacity}
                  selectTextOnFocus
                  onChangeText={(text) => {
                    setCapacity(text);
                    setError(undefined);
                  }}
                  keyboardType="decimal-pad"
                  placeholder={fuelType === 'gas' ? '14' : '75'}
                  placeholderTextColor={colors.unknown}
                  maxLength={6}
                />
              </View>
              <View style={styles.rowField}>
                <Text style={styles.fieldLabel}>{units.efficiency}</Text>
                <TextInput
                  style={styles.input}
                  value={efficiency}
                  selectTextOnFocus
                  onChangeText={(text) => {
                    setEfficiency(text);
                    setError(undefined);
                  }}
                  keyboardType="decimal-pad"
                  placeholder={fuelType === 'gas' ? '30' : '3.5'}
                  placeholderTextColor={colors.unknown}
                  maxLength={6}
                />
              </View>
            </View>

            <View style={styles.field}>
              <Text style={styles.fieldLabel}>
                Current level · {formatLevel(level)}
              </Text>
              <View style={styles.segments}>
                {LEVELS.map((option) => (
                  <Pressable
                    key={option}
                    onPress={() => setLevel(option)}
                    style={[styles.levelSegment, level === option && styles.segmentActive]}
                    accessibilityRole="button"
                    accessibilityState={{ selected: level === option }}
                    accessibilityLabel={formatLevel(option)}
                  >
                    <Text
                      style={[styles.segmentText, level === option && styles.segmentTextActive]}
                    >
                      {option === 0 ? 'E' : option === 1 ? 'F' : `${option * 100}%`}
                    </Text>
                  </Pressable>
                ))}
              </View>
            </View>

            {preview && (
              <View style={styles.preview}>
                <Text style={styles.previewRange}>{formatMiles(preview.comfortableMiles)}</Text>
                <Text style={styles.previewCaption}>
                  before reserve · {formatMiles(preview.totalMiles)} absolute max
                </Text>
              </View>
            )}

            {error && <Text style={styles.error}>{error}</Text>}

            <View style={styles.actions}>
              <Pressable style={[styles.button, styles.cancel]} onPress={onClose}>
                <Text style={styles.cancelText}>Cancel</Text>
              </Pressable>
              <Pressable style={[styles.button, styles.confirm]} onPress={submit}>
                <Text style={styles.confirmText}>Save</Text>
              </Pressable>
            </View>

            {vehicle && (
              <Pressable
                onPress={async () => {
                  await onClear();
                  onClose();
                }}
                style={styles.remove}
              >
                <Text style={styles.removeText}>Remove vehicle</Text>
              </Pressable>
            )}
          </ScrollView>
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
    padding: spacing.lg,
  },
  card: {
    backgroundColor: colors.background,
    borderRadius: radius.lg,
    padding: spacing.lg,
    maxHeight: '88%',
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
  field: {
    marginTop: spacing.lg,
  },
  fieldLabel: {
    fontSize: 13,
    fontWeight: '600',
    color: colors.text,
    marginBottom: spacing.sm,
  },
  input: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    backgroundColor: colors.surface,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.md - 2,
    fontSize: 16,
    color: colors.text,
  },
  row: {
    flexDirection: 'row',
    gap: spacing.md,
    marginTop: spacing.lg,
  },
  rowField: {
    flex: 1,
  },
  segments: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  segment: {
    flex: 1,
    paddingVertical: spacing.md - 2,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    alignItems: 'center',
  },
  levelSegment: {
    flex: 1,
    paddingVertical: spacing.sm,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    alignItems: 'center',
  },
  segmentActive: {
    backgroundColor: colors.accent,
    borderColor: colors.accent,
  },
  segmentText: {
    fontSize: 13,
    fontWeight: '600',
    color: colors.textMuted,
  },
  segmentTextActive: {
    color: colors.onAccent,
  },
  preview: {
    marginTop: spacing.lg,
    padding: spacing.md,
    borderRadius: radius.md,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: 'center',
  },
  previewRange: {
    fontSize: 26,
    fontWeight: '800',
    color: colors.text,
    fontVariant: ['tabular-nums'],
  },
  previewCaption: {
    fontSize: 12,
    color: colors.textMuted,
    marginTop: 2,
  },
  error: {
    color: colors.gouge,
    fontSize: 13,
    marginTop: spacing.md,
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
    color: colors.onAccent,
    fontWeight: '700',
    fontSize: 15,
  },
  remove: {
    alignItems: 'center',
    paddingVertical: spacing.md,
  },
  removeText: {
    fontSize: 13,
    color: colors.gouge,
    fontWeight: '600',
  },
});
