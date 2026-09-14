import { StyleSheet, Text, View } from 'react-native';

import { JD_FIELDS } from '../jobText';
import { colors, space } from '../theme';
import type { StructuredJD } from '../types';
import { Field } from './Fields';

export function JobFields({
  value,
  editing,
  onChange,
}: {
  value: StructuredJD;
  editing?: boolean;
  onChange?: (next: StructuredJD) => void;
}) {
  return (
    <View style={styles.list}>
      {JD_FIELDS.map(({ key, label, multiline }) =>
        editing && onChange ? (
          <Field
            key={key}
            label={label}
            value={value[key]}
            multiline={multiline}
            onChangeText={(text) => onChange({ ...value, [key]: text })}
            placeholder="未识别"
          />
        ) : (
          <View key={key} style={styles.row}>
            <Text style={styles.label}>{label}</Text>
            <Text style={[styles.value, !value[key].trim() && styles.empty]}>
              {value[key].trim() || '未识别'}
            </Text>
          </View>
        ),
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  list: { gap: space.md },
  row: { gap: 6 },
  label: {
    fontSize: 13,
    color: colors.muted,
    fontWeight: '600',
  },
  value: {
    color: colors.ink,
    fontSize: 15,
    lineHeight: 22,
  },
  empty: {
    color: colors.faint,
  },
});
