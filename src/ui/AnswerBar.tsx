import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native';

import { colors, radius, space } from '../theme';

export function AnswerBar({
  draft,
  recording,
  onChangeDraft,
  onMicIn,
  onMicOut,
  onSend,
}: {
  draft: string;
  recording: boolean;
  onChangeDraft: (text: string) => void;
  onMicIn: () => void;
  onMicOut: () => void;
  onSend: () => void;
}) {
  return (
    <View style={styles.composer}>
      <TextInput
        value={draft}
        onChangeText={onChangeDraft}
        placeholder={recording ? '正在录音，松手或再点「停」结束' : '按住「说」或写下你的回答'}
        placeholderTextColor={colors.faint}
        style={styles.input}
        multiline
        editable={!recording}
      />
      <Pressable
        style={[styles.mic, recording && styles.micOn]}
        onPressIn={onMicIn}
        onPressOut={onMicOut}
        hitSlop={8}
        accessibilityLabel={recording ? '松开结束录音' : '按住说话'}
      >
        <Text style={[styles.micText, recording && styles.micOnText]}>{recording ? '停' : '说'}</Text>
      </Pressable>
      <Pressable style={styles.send} onPress={onSend}>
        <Text style={styles.sendText}>发送</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  composer: {
    flexDirection: 'row',
    gap: space.sm,
    padding: space.md,
    alignItems: 'flex-end',
    backgroundColor: colors.paper,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.line,
  },
  input: {
    flex: 1,
    minHeight: 40,
    maxHeight: 120,
    fontSize: 16,
    color: colors.ink,
  },
  mic: {
    backgroundColor: colors.accentSoft,
    borderRadius: radius.pill,
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  micOn: { backgroundColor: colors.danger },
  micText: { color: colors.accent, fontWeight: '700' },
  micOnText: { color: '#fff' },
  send: {
    backgroundColor: colors.accent,
    borderRadius: radius.pill,
    paddingHorizontal: 16,
    paddingVertical: 10,
  },
  sendText: { color: '#fff', fontWeight: '700' },
});
