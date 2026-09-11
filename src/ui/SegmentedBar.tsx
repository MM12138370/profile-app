import { Pressable, StyleSheet, Text, View } from 'react-native';

import { colors, radius, space } from '../theme';

export function SegmentedBar<K extends string>({
  options,
  value,
  onChange,
}: {
  options: Array<{ key: K; label: string }>;
  value: K;
  onChange: (key: K) => void;
}) {
  return (
    <View style={styles.track}>
      {options.map((option) => {
        const active = option.key === value;
        return (
          <Pressable
            key={option.key}
            onPress={() => onChange(option.key)}
            style={[styles.cell, active && styles.cellOn]}
          >
            <Text style={[styles.label, active && styles.labelOn]}>{option.label}</Text>
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  track: {
    marginHorizontal: space.lg,
    marginBottom: space.md,
    padding: 4,
    flexDirection: 'row',
    backgroundColor: colors.chip,
    borderRadius: radius.md,
  },
  cell: {
    flex: 1,
    minHeight: 36,
    borderRadius: radius.sm,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cellOn: {
    backgroundColor: colors.paper,
  },
  label: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.faint,
  },
  labelOn: {
    color: colors.accent,
  },
});
