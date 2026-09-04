import { useMemo, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  Modal,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';

import { ChevronDownIcon } from './icons';
import { colors, radius, spacing } from '../theme';
import type { CatalogOption } from '../data/vehicleCatalog';

interface PickerFieldProps {
  label: string;
  placeholder: string;
  value: CatalogOption | undefined;
  options: CatalogOption[];
  loading?: boolean;
  /** Disabled until the field above it is answered. */
  disabled?: boolean;
  onChange: (option: CatalogOption) => void;
}

/**
 * A dropdown that opens a searchable list.
 *
 * Built rather than pulled in as a dependency because these lists are long in
 * a way native pickers handle badly — an iOS wheel with 80 makes on it is a
 * genuinely bad way to find "Toyota" — and because a picker is chrome, so it
 * has to wear the app's palette rather than the platform's.
 *
 * The search box appears only past a threshold. Four fuel types do not need
 * filtering; eighty makes do.
 */
const SEARCHABLE_FROM = 12;

export function PickerField({
  label,
  placeholder,
  value,
  options,
  loading = false,
  disabled = false,
  onChange,
}: PickerFieldProps) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');

  const filtered = useMemo(() => {
    const needle = query.trim().toLowerCase();
    if (needle === '') return options;
    return options.filter((option) => option.label.toLowerCase().includes(needle));
  }, [options, query]);

  const close = () => {
    setOpen(false);
    setQuery('');
  };

  return (
    <View style={styles.field}>
      <Text style={styles.fieldLabel}>{label}</Text>
      <Pressable
        style={[styles.control, disabled && styles.controlDisabled]}
        onPress={() => !disabled && !loading && setOpen(true)}
        disabled={disabled || loading}
        accessibilityRole="button"
        accessibilityState={{ disabled: disabled || loading, expanded: open }}
        accessibilityLabel={value ? `${label}: ${value.label}` : `Choose ${label}`}
      >
        <Text style={[styles.controlText, !value && styles.controlPlaceholder]} numberOfLines={1}>
          {value?.label ?? placeholder}
        </Text>
        {loading ? (
          <ActivityIndicator size="small" color={colors.textMuted} />
        ) : (
          <ChevronDownIcon size={12} color={colors.textMuted} />
        )}
      </Pressable>

      <Modal visible={open} transparent animationType="fade" onRequestClose={close}>
        <Pressable style={styles.backdrop} onPress={close}>
          {/* Swallows taps so pressing inside the sheet doesn't dismiss it. */}
          <Pressable style={styles.sheet} onPress={() => {}}>
            <Text style={styles.sheetTitle}>{label}</Text>
            {options.length >= SEARCHABLE_FROM && (
              <TextInput
                style={styles.search}
                value={query}
                onChangeText={setQuery}
                placeholder="Search"
                placeholderTextColor={colors.unknown}
                autoCorrect={false}
                autoCapitalize="none"
              />
            )}
            <FlatList
              data={filtered}
              keyExtractor={(item) => item.value}
              keyboardShouldPersistTaps="handled"
              ListEmptyComponent={<Text style={styles.empty}>Nothing matches "{query}".</Text>}
              renderItem={({ item }) => {
                const selected = item.value === value?.value;
                return (
                  <Pressable
                    style={[styles.row, selected && styles.rowSelected]}
                    onPress={() => {
                      onChange(item);
                      close();
                    }}
                    accessibilityRole="button"
                    accessibilityState={{ selected }}
                  >
                    <Text style={[styles.rowText, selected && styles.rowTextSelected]}>
                      {item.label}
                    </Text>
                  </Pressable>
                );
              }}
            />
          </Pressable>
        </Pressable>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  field: {
    marginTop: spacing.lg,
  },
  fieldLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.text,
    marginBottom: spacing.sm,
  },
  control: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.md,
  },
  controlDisabled: {
    opacity: 0.45,
  },
  controlText: {
    flex: 1,
    fontSize: 15,
    color: colors.text,
  },
  controlPlaceholder: {
    color: colors.unknown,
  },
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.55)',
    justifyContent: 'center',
    padding: spacing.xl,
  },
  sheet: {
    backgroundColor: colors.background,
    borderRadius: radius.lg,
    padding: spacing.lg,
    // Tall enough to scan a list, short enough to stay a sheet over the form.
    maxHeight: '70%',
  },
  sheetTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: colors.text,
    marginBottom: spacing.md,
  },
  search: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    fontSize: 15,
    color: colors.text,
    marginBottom: spacing.sm,
  },
  row: {
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.sm,
    borderRadius: radius.sm,
  },
  rowSelected: {
    backgroundColor: colors.raised,
  },
  rowText: {
    fontSize: 15,
    color: colors.text,
  },
  rowTextSelected: {
    fontWeight: '700',
  },
  empty: {
    fontSize: 14,
    color: colors.textMuted,
    paddingVertical: spacing.lg,
    textAlign: 'center',
  },
});
