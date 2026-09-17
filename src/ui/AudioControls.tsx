import { StyleSheet, View } from 'react-native';

import type { SpeakState } from '../runtime/speak';
import { space } from '../theme';
import { Button } from './Button';

export function AudioControls({
  hasAudio,
  speak,
  onPlay,
  onPause,
  onResume,
  onStop,
  onGenerate,
}: {
  hasAudio: boolean;
  speak: SpeakState;
  onPlay: () => void;
  onPause: () => void;
  onResume: () => void;
  onStop: () => void;
  onGenerate?: () => void;
}) {
  if (!hasAudio) {
    return onGenerate ? <Button variant="ghost" label="生成语音" onPress={onGenerate} /> : null;
  }
  if (speak === 'idle') {
    return <Button variant="ghost" label="播放" onPress={onPlay} />;
  }
  return (
    <View style={styles.row}>
      <Button
        variant="ghost"
        label={speak === 'playing' ? '暂停' : '继续'}
        style={styles.half}
        onPress={speak === 'playing' ? onPause : onResume}
      />
      <Button variant="ghost" label="停止播放" style={styles.half} onPress={onStop} />
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', gap: space.sm },
  half: { flex: 1 },
});
