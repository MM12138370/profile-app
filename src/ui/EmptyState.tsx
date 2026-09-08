import { StyleSheet, Text, View } from 'react-native';

import { colors, space } from '../theme';

export function EmptyState({ title, hint }: { title: string; hint?: string }) {
  return (
    <View style={styles.wrap}>
      <Text style={styles.title}>{title}</Text>
      {hint ? <Text style={styles.hint}>{hint}</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    paddingVertical: space.xl,
    alignItems: 'center',
    gap: space.sm,
  },
  title: {
    fontSize: 16,
    color: colors.ink,
    fontWeight: '600',
  },
  hint: {
    fontSize: 14,
    color: colors.muted,
    textAlign: 'center',
    lineHeight: 20,
    paddingHorizontal: space.lg,
  },
});
