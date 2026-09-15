import { useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import { TTS_VOICES, voiceGroups, voicesInGroup, type VoiceGroupId } from '../ai/voices';
import { colors, radius, space } from '../theme';
import { Button } from './Button';
import { CenterSheet } from './CenterSheet';
import { Chip, ChipRow } from './Chips';

export function VoicePicker({
  visible,
  selectedId,
  onSelect,
  onClose,
  onPreview,
}: {
  visible: boolean;
  selectedId: string;
  onSelect: (id: string) => void;
  onClose: () => void;
  onPreview?: (id: string) => void;
}) {
  const [group, setGroup] = useState<VoiceGroupId>('recommend');
  const voices = useMemo(() => voicesInGroup(group), [group]);

  return (
    <CenterSheet visible={visible} onClose={onClose}>
      <Text style={styles.title}>选择音色</Text>
      <Text style={styles.hint}>音色来自豆包语音合成大模型 2.0，面试官提问时会用选中的声音朗读。</Text>
      <ChipRow>
        {voiceGroups.map((item) => (
          <Chip
            key={item.id}
            label={item.label}
            active={group === item.id}
            onPress={() => setGroup(item.id)}
          />
        ))}
      </ChipRow>
      <ScrollView style={styles.list} keyboardShouldPersistTaps="handled">
        {voices.map((voice) => {
          const active = voice.id === selectedId;
          return (
            <Pressable
              key={voice.id}
              onPress={() => onSelect(voice.id)}
              style={({ pressed }) => [styles.row, active && styles.active, pressed && styles.pressed]}
            >
              <View style={styles.rowText}>
                <Text style={[styles.name, active && styles.activeName]}>{voice.name}</Text>
                <Text style={styles.id}>{voice.id}</Text>
              </View>
              {onPreview ? (
                <Pressable
                  onPress={() => onPreview(voice.id)}
                  hitSlop={8}
                  accessibilityRole="button"
                  accessibilityLabel={`试听${voice.name}`}
                >
                  <Text style={styles.preview}>试听</Text>
                </Pressable>
              ) : null}
            </Pressable>
          );
        })}
        {voices.length === 0 ? <Text style={styles.empty}>这一类暂时没有音色。</Text> : null}
      </ScrollView>
      <Button variant="ghost" label="完成" onPress={onClose} />
    </CenterSheet>
  );
}

export function VoiceField({
  label,
  voiceId,
  onPress,
}: {
  label: string;
  voiceId: string;
  onPress: () => void;
}) {
  const name = TTS_VOICES.find((item) => item.id === voiceId)?.name ?? voiceId;
  return (
    <Pressable onPress={onPress} style={({ pressed }) => [styles.field, pressed && styles.pressed]}>
      <Text style={styles.fieldLabel}>{label}</Text>
      <Text style={styles.fieldValue}>{name || '点击选择'}</Text>
    </Pressable>
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
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.sm,
  },
  rowText: {
    flex: 1,
    gap: 2,
  },
  active: {
    backgroundColor: colors.accentSoft,
  },
  pressed: {
    opacity: 0.82,
  },
  name: {
    fontSize: 15,
    fontWeight: '600',
    color: colors.ink,
  },
  activeName: {
    color: colors.accent,
  },
  id: {
    fontSize: 11,
    color: colors.faint,
  },
  preview: {
    color: colors.accent,
    fontWeight: '700',
    fontSize: 13,
  },
  empty: {
    fontSize: 14,
    color: colors.muted,
    paddingVertical: space.md,
  },
  field: {
    backgroundColor: colors.paper,
    borderRadius: radius.sm,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.line,
    paddingHorizontal: space.md,
    paddingVertical: 12,
    gap: 6,
  },
  fieldLabel: {
    fontSize: 13,
    color: colors.muted,
    fontWeight: '600',
  },
  fieldValue: {
    fontSize: 16,
    color: colors.ink,
    fontWeight: '600',
  },
});
