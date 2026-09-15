import { useEffect, useRef, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { colors, radius, space } from '../theme';
import { withQAEdits, type QAItem } from '../types';
import { DiffText } from './DiffText';
import { Field } from './Fields';

export function QACard({
  item,
  index,
  autoFocus,
  onChange,
  onDelete,
}: {
  item: QAItem;
  index: number;
  autoFocus?: boolean;
  onChange: (item: QAItem) => void;
  onDelete: () => void;
}) {
  const manual = item.source === 'manual';
  const [question, setQuestion] = useState(item.question);
  const [answer, setAnswer] = useState(item.answer);
  const itemRef = useRef(item);
  const onChangeRef = useRef(onChange);
  const draftRef = useRef({ question: item.question, answer: item.answer });
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  itemRef.current = item;
  onChangeRef.current = onChange;

  useEffect(() => {
    setQuestion(item.question);
    setAnswer(item.answer);
    draftRef.current = { question: item.question, answer: item.answer };
  }, [item.id, item.question, item.answer]);

  useEffect(() => {
    return () => {
      if (timer.current) {
        clearTimeout(timer.current);
      }
    };
  }, []);

  function commit(nextQuestion: string, nextAnswer: string) {
    if (timer.current) {
      clearTimeout(timer.current);
      timer.current = null;
    }
    const current = itemRef.current;
    if (nextQuestion === current.question && nextAnswer === current.answer) {
      return;
    }
    onChangeRef.current(withQAEdits(current, { question: nextQuestion, answer: nextAnswer }));
  }

  function schedule(nextQuestion: string, nextAnswer: string) {
    if (timer.current) {
      clearTimeout(timer.current);
    }
    timer.current = setTimeout(() => commit(nextQuestion, nextAnswer), 320);
  }

  const hasPolish = !manual && Boolean(item.polishTips.trim() || item.polishedAnswer.trim());

  return (
    <View style={styles.card}>
      <View style={styles.head}>
        <View style={styles.titleRow}>
          <Text style={styles.title}>Q{index + 1}</Text>
          {manual ? <Text style={styles.tag}>手动</Text> : null}
        </View>
        <Pressable
          onPress={() => {
            if (timer.current) {
              clearTimeout(timer.current);
              timer.current = null;
            }
            onDelete();
          }}
          accessibilityRole="button"
          accessibilityLabel="删除"
        >
          <Text style={styles.delete}>删除</Text>
        </Pressable>
      </View>
      <Field
        label="问题"
        value={question}
        onChangeText={(value) => {
          setQuestion(value);
          draftRef.current = { ...draftRef.current, question: value };
          schedule(value, draftRef.current.answer);
        }}
        onBlur={() => commit(draftRef.current.question, draftRef.current.answer)}
        placeholder={manual ? '面试时要问到的问题' : '问题'}
        multiline
        autoFocus={autoFocus}
        style={styles.question}
      />
      {manual ? null : (
        <Field
          label="我的回答"
          value={answer}
          onChangeText={(value) => {
            setAnswer(value);
            draftRef.current = { ...draftRef.current, answer: value };
            schedule(draftRef.current.question, value);
          }}
          onBlur={() => commit(draftRef.current.question, draftRef.current.answer)}
          placeholder="先按自己的实际情况作答，全部答完后再润色"
          multiline
        />
      )}
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
  question: {
    minHeight: 72,
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
