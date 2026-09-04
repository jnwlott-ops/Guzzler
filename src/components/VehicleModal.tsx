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

import { PickerField } from './PickerField';
import { FUEL_TYPE_ICONS } from './icons/amenityIcons';
import { activeVehicleCatalog } from '../data/vehicleCatalog';
import { useVehicleCatalog } from '../hooks/useVehicleCatalog';
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
 * Vehicle setup, either by looking the car up or by typing the numbers in.
 *
 * Lookup is the default because most drivers know their year/make/model and
 * far fewer know their MPG. But it is never the only path: the catalog is a
 * network call, this app is used in cars with one bar of signal, and a form
 * that cannot be completed offline is a form that loses the user. Manual entry
 * stays a tap away and every looked-up number lands in an editable field.
 *
 * The lookup fills MPG exactly and tank size only approximately — no free
 * source publishes tank capacity. See src/lib/tankSize.ts.
 */
export function VehicleModal({ visible, vehicle, onSave, onClear, onClose }: VehicleModalProps) {
  const [label, setLabel] = useState('');
  const [fuelType, setFuelType] = useState<VehicleFuelType>('gas');
  const [capacity, setCapacity] = useState('');
  const [efficiency, setEfficiency] = useState('');
  const [level, setLevel] = useState(0.5);
  const [error, setError] = useState<string | undefined>();
  const [mode, setMode] = useState<'lookup' | 'manual'>('lookup');
  /** Set when the capacity currently in the box came from the size-class guess
   *  rather than from the driver, so the UI can admit which it is. */
  const [capacityEstimated, setCapacityEstimated] = useState(false);

  const catalog = useVehicleCatalog(visible && mode === 'lookup');

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
    setCapacityEstimated(false);
    // Editing an existing car opens on the numbers; a new one opens on lookup.
    setMode(vehicle ? 'manual' : 'lookup');
  }, [visible, vehicle]);

  // A resolved trim fills the form and hands over to the manual view, so the
  // driver sees exactly what was filled in and can correct the guessed tank.
  useEffect(() => {
    const found = catalog.resolved;
    if (!found) return;
    setLabel(found.label);
    setFuelType(found.fuelType);
    setEfficiency(String(found.efficiency));
    setCapacity(String(found.estimatedCapacity));
    setCapacityEstimated(true);
    setError(undefined);
    setMode('manual');
  }, [catalog.resolved]);

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

            <View style={styles.modeRow}>
              {(['lookup', 'manual'] as const).map((option) => (
                <Pressable
                  key={option}
                  onPress={() => setMode(option)}
                  style={[styles.segment, mode === option && styles.segmentActive]}
                  accessibilityRole="button"
                  accessibilityState={{ selected: mode === option }}
                >
                  <Text style={[styles.segmentText, mode === option && styles.segmentTextActive]}>
                    {option === 'lookup' ? 'Look it up' : 'Enter manually'}
                  </Text>
                </Pressable>
              ))}
            </View>

            {mode === 'lookup' ? (
              <>
                <PickerField
                  label="Year"
                  placeholder="Choose a year"
                  value={catalog.selection.year}
                  options={catalog.years}
                  loading={catalog.loading === 'year'}
                  onChange={(option) => catalog.choose('year', option)}
                />
                <PickerField
                  label="Make"
                  placeholder="Choose a make"
                  value={catalog.selection.make}
                  options={catalog.makes}
                  loading={catalog.loading === 'make'}
                  disabled={!catalog.selection.year}
                  onChange={(option) => catalog.choose('make', option)}
                />
                <PickerField
                  label="Model"
                  placeholder="Choose a model"
                  value={catalog.selection.model}
                  options={catalog.models}
                  loading={catalog.loading === 'model'}
                  disabled={!catalog.selection.make}
                  onChange={(option) => catalog.choose('model', option)}
                />
                <PickerField
                  label="Engine"
                  placeholder="Choose an engine"
                  value={catalog.selection.trim}
                  options={catalog.trims}
                  loading={catalog.loading === 'trim' || catalog.loading === 'details'}
                  disabled={!catalog.selection.model}
                  onChange={(option) => catalog.choose('trim', option)}
                />

                {catalog.error && (
                  <View style={styles.lookupError}>
                    <Text style={styles.error}>{catalog.error}</Text>
                    <Pressable onPress={() => setMode('manual')} accessibilityRole="button">
                      <Text style={styles.link}>Enter the numbers yourself instead</Text>
                    </Pressable>
                  </View>
                )}

                <Text style={styles.attribution}>{activeVehicleCatalog.attribution}</Text>
              </>
            ) : (
              <>
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
                    <View style={styles.segmentInner}>
                      {(() => {
                        const Icon = FUEL_TYPE_ICONS[type];
                        return (
                          <Icon
                            size={14}
                            color={fuelType === type ? colors.onAccent : colors.textMuted}
                          />
                        );
                      })()}
                      <Text
                        style={[
                          styles.segmentText,
                          fuelType === type && styles.segmentTextActive,
                        ]}
                      >
                        {type === 'gas' ? 'Gas' : 'Electric'}
                      </Text>
                    </View>
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
                    setCapacityEstimated(false);
                    setError(undefined);
                  }}
                  keyboardType="decimal-pad"
                  placeholder={fuelType === 'gas' ? '14' : '75'}
                  placeholderTextColor={colors.unknown}
                  maxLength={6}
                />
                {capacityEstimated && (
                  <Text style={styles.estimateNote}>
                    Estimated from size class — check your manual and correct it.
                  </Text>
                )}
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

              </>
            )}

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
  segmentInner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs + 2,
  },
  modeRow: {
    flexDirection: 'row',
    gap: spacing.sm,
    marginTop: spacing.lg,
  },
  lookupError: {
    marginTop: spacing.md,
    gap: spacing.xs,
  },
  link: {
    fontSize: 13,
    fontWeight: '700',
    color: colors.accent,
  },
  attribution: {
    fontSize: 11,
    color: colors.textMuted,
    marginTop: spacing.lg,
  },
  estimateNote: {
    fontSize: 11,
    color: colors.textMuted,
    marginTop: spacing.xs,
    lineHeight: 15,
  },
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
