import { Pressable, ScrollView, StyleSheet, Text } from 'react-native';

import { colors, radius, space } from '../theme';
import { resumeLabel, type Resume } from '../types';
import { Button } from './Button';
import { CenterSheet } from './CenterSheet';

export function ResumePicker({
  visible,
  resumes,
  selectedId,
  title,
  hint,
  onSelect,
  onClose,
}: {
  visible: boolean;
  resumes: Resume[];
  selectedId?: string;
  title: string;
  hint: string;
  onSelect: (resume: Resume) => void;
  onClose: () => void;
}) {
  return (
    <CenterSheet visible={visible} onClose={onClose}>
      <Text style={styles.title}>{title}</Text>
      <Text style={styles.hint}>{hint}</Text>
      <ScrollView style={styles.list} keyboardShouldPersistTaps="handled">
        {resumes.map((item) => {
          const active = item.id === selectedId;
          const sub = [item.jobIntention, item.intendedCities].filter((value) => value.trim()).join(' · ');
          return (
            <Pressable
              key={item.id}
              onPress={() => onSelect(item)}
              style={({ pressed }) => [styles.row, active && styles.active, pressed && styles.pressed]}
            >
              <Text style={[styles.label, active && styles.activeLabel]}>{resumeLabel(item)}</Text>
              {sub ? <Text style={styles.sub}>{sub}</Text> : null}
            </Pressable>
          );
        })}
      </ScrollView>
      <Button variant="ghost" label="取消" onPress={onClose} />
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
  label: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.ink,
  },
  activeLabel: {
    color: colors.accent,
  },
  sub: {
    fontSize: 13,
    color: colors.muted,
  },
});
