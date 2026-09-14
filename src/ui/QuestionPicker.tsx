import { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text } from 'react-native';

import { colors, radius, space } from '../theme';
import { Button } from './Button';
import { CenterSheet } from './CenterSheet';

export type ReusableQuestion = {
  jobTitle: string;
  question: string;
};

export function QuestionPicker({
  visible,
  items,
  onClose,
  onConfirm,
}: {
  visible: boolean;
  items: ReusableQuestion[];
  onClose: () => void;
  onConfirm: (questions: string[]) => void;
}) {
  const [picked, setPicked] = useState<string[]>([]);

  function toggle(question: string) {
    setPicked((prev) =>
      prev.includes(question) ? prev.filter((item) => item !== question) : [...prev, question],
    );
  }

  return (
    <CenterSheet
      visible={visible}
      onClose={() => {
        setPicked([]);
        onClose();
      }}
    >
      <Text style={styles.title}>选用其他岗位的问题</Text>
      <Text style={styles.hint}>只列出你在其他岗位手动加过的题，选中后加入本岗位。</Text>
      {items.length === 0 ? (
        <Text style={styles.empty}>其他岗位还没有手动添加过的问题。</Text>
      ) : (
        <ScrollView style={styles.list} keyboardShouldPersistTaps="handled">
          {items.map((item) => {
            const active = picked.includes(item.question);
            return (
              <Pressable
                key={`${item.jobTitle}-${item.question}`}
                onPress={() => toggle(item.question)}
                style={({ pressed }) => [styles.row, active && styles.active, pressed && styles.pressed]}
              >
                <Text style={[styles.question, active && styles.activeQuestion]}>{item.question}</Text>
                <Text style={styles.sub}>{item.jobTitle}</Text>
              </Pressable>
            );
          })}
        </ScrollView>
      )}
      <Button
        label={picked.length ? `加入 ${picked.length} 题` : '加入'}
        disabled={picked.length === 0}
        onPress={() => {
          onConfirm(picked);
          setPicked([]);
        }}
      />
      <Button
        variant="ghost"
        label="取消"
        onPress={() => {
          setPicked([]);
          onClose();
        }}
      />
    </CenterSheet>
  );
}

const styles = StyleSheet.create({
  title: {
    fontSize: 17,
    fontWeight: '700',
    color: colors.ink,
  },
  hint: {
    fontSize: 13,
    lineHeight: 18,
    color: colors.muted,
  },
  empty: {
    fontSize: 14,
    color: colors.muted,
    lineHeight: 20,
  },
  list: {
    maxHeight: 320,
  },
  row: {
    paddingVertical: 12,
    paddingHorizontal: space.sm,
    borderRadius: radius.sm,
    gap: 4,
  },
  active: {
    backgroundColor: colors.accentSoft,
  },
  pressed: {
    opacity: 0.82,
  },
  question: {
    fontSize: 15,
    fontWeight: '600',
    color: colors.ink,
  },
  activeQuestion: {
    color: colors.accent,
  },
  sub: {
    fontSize: 13,
    color: colors.muted,
  },
});
