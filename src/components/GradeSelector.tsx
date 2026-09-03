import { Pressable, StyleSheet, Text, View } from 'react-native';

import { colors, radius, spacing } from '../theme';
import { FUEL_GRADES, FUEL_GRADE_LABELS, type FuelGrade } from '../types';

interface GradeSelectorProps {
  value: FuelGrade;
  onChange: (grade: FuelGrade) => void;
}

/** Segmented control for the fuel grade the whole map is priced against. */
export function GradeSelector({ value, onChange }: GradeSelectorProps) {
  return (
    <View style={styles.container}>
      {FUEL_GRADES.map((grade) => {
        const selected = grade === value;
        return (
          <Pressable
            key={grade}
            onPress={() => onChange(grade)}
            style={[styles.segment, selected && styles.segmentSelected]}
            accessibilityRole="button"
            accessibilityState={{ selected }}
            accessibilityLabel={`Show ${FUEL_GRADE_LABELS[grade]} prices`}
          >
            <Text style={[styles.label, selected && styles.labelSelected]}>
              {FUEL_GRADE_LABELS[grade]}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    padding: 3,
    borderWidth: 1,
    borderColor: colors.border,
  },
  segment: {
    flex: 1,
    paddingVertical: spacing.sm,
    alignItems: 'center',
    borderRadius: radius.sm,
  },
  segmentSelected: {
    backgroundColor: colors.raised,
  },
  label: {
    fontSize: 13,
    fontWeight: '600',
    color: colors.textMuted,
  },
  labelSelected: {
    color: colors.text,
  },
});
