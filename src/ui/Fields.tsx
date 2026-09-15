import { Platform, StyleSheet, Text, TextInput, View, type TextInputProps } from 'react-native';

import { colors, radius, space } from '../theme';

type Props = TextInputProps & {
  label?: string;
};

export function Field({ label, style, editable = true, ...rest }: Props) {
  return (
    <View style={[styles.wrap, { pointerEvents: editable ? 'auto' : 'none' }]}>
      {label ? <Text style={styles.label}>{label}</Text> : null}
      <TextInput
        placeholderTextColor={colors.faint}
        editable={editable}
        {...rest}
        style={[
          styles.input,
          rest.multiline && styles.multiline,
          Platform.OS === 'web' && styles.web,
          style,
        ]}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    gap: 6,
  },
  label: {
    fontSize: 13,
    color: colors.muted,
    fontWeight: '600',
  },
  input: {
    backgroundColor: colors.paper,
    borderRadius: radius.sm,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.line,
    paddingHorizontal: space.md,
    paddingVertical: 12,
    fontSize: 16,
    color: colors.ink,
  },
  multiline: {
    minHeight: 88,
    textAlignVertical: 'top',
  },
  web: {
    outlineWidth: 0,
  },
});
