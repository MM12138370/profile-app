import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native';

import { colors, radius, space } from '../theme';
import type { QAItem } from '../types';
import { DiffText } from './DiffText';

export function QACard({
  item,
  index,
  onChange,
  onDelete,
}: {
  item: QAItem;
  index: number;
  onChange: (item: QAItem) => void;
  onDelete: () => void;
}) {
  const hasPolish = Boolean(item.polishTips.trim() || item.polishedAnswer.trim());

  return (
    <View style={styles.card}>
      <View style={styles.head}>
        <View style={styles.titleRow}>
          <Text style={styles.title}>Q{index + 1}</Text>
          {item.source === 'manual' ? <Text style={styles.tag}>手动</Text> : null}
        </View>
        <Pressable onPress={onDelete} accessibilityRole="button" accessibilityLabel="删除">
          <Text style={styles.delete}>删除</Text>
        </Pressable>
      </View>
      <TextInput
        value={item.question}
        onChangeText={(question) => onChange({ ...item, question })}
        placeholder="问题"
        placeholderTextColor={colors.faint}
        style={styles.input}
        multiline
      />
      <TextInput
        value={item.answer}
        onChangeText={(answer) => onChange({ ...item, answer })}
        placeholder="先按自己的实际情况作答，全部答完后再润色"
        placeholderTextColor={colors.faint}
        style={styles.input}
        multiline
      />
      {hasPolish ? (
        <View style={styles.polish}>
          {item.polishTips.trim() ? (
            <>
              <Text style={styles.kicker}>润色建议</Text>
              <Text style={styles.tips}>{item.polishTips.trim()}</Text>
            </>
          ) : null}
          {item.polishedAnswer.trim() ? (
            <>
              <Text style={styles.kicker}>润色前</Text>
              <DiffText before={item.answer} after={item.polishedAnswer} side="before" />
              <Text style={styles.kicker}>润色后</Text>
              <DiffText before={item.answer} after={item.polishedAnswer} side="after" />
            </>
          ) : null}
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.paper,
    borderRadius: radius.md,
    padding: space.md,
    gap: 8,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.line,
  },
  head: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  title: {
    fontWeight: '700',
    color: colors.ink,
    fontSize: 15,
  },
  tag: {
    fontSize: 11,
    fontWeight: '700',
    color: colors.accent,
    backgroundColor: colors.accentSoft,
    overflow: 'hidden',
    borderRadius: radius.pill,
    paddingHorizontal: 8,
    paddingVertical: 2,
  },
  delete: {
    color: colors.danger,
    fontWeight: '600',
  },
  input: {
    fontSize: 15,
    color: colors.ink,
    minHeight: 44,
    textAlignVertical: 'top',
  },
  polish: {
    gap: 8,
    paddingTop: 4,
  },
  kicker: {
    fontSize: 13,
    fontWeight: '700',
    color: colors.muted,
  },
  tips: {
    fontSize: 14,
    lineHeight: 20,
    color: colors.ink,
  },
});
