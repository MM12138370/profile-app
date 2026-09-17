import { useNavigation, useRoute, type RouteProp } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { Alert, KeyboardAvoidingView, Platform, Pressable, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { useAuth } from '../auth/AuthContext';
import type { RootStackParamList } from '../navigation/types';
import { useMic } from '../runtime/mic';
import { startReview } from '../runtime/review';
import { useSpeakPlayer } from '../runtime/speak';
import { archivedAudioUri, loadAiSettings } from '../storage';
import { colors, radius, space } from '../theme';
import type { AiSettings, QaTurn } from '../types';
import { AnswerBar } from '../ui/AnswerBar';
import { AudioControls } from '../ui/AudioControls';
import { BusyOverlay } from '../ui/BusyOverlay';
import { useToast } from '../ui/Toast';

type Nav = NativeStackNavigationProp<RootStackParamList, 'InterviewReview'>;
type R = RouteProp<RootStackParamList, 'InterviewReview'>;

export function InterviewReviewScreen() {
  const { user } = useAuth();
  const toast = useToast();
  const navigation = useNavigation<Nav>();
  const { bankId, itemIds } = useRoute<R>().params;
  const { speak, play, pause, resume, stop } = useSpeakPlayer();

  const [run, setRun] = useState<{ session: QaTurn[]; sessionIndex: number } | null>(null);
  const [settings, setSettings] = useState<AiSettings | null>(null);
  const [draft, setDraft] = useState('');
  const [busy, setBusy] = useState('');
  const booted = useRef(false);

  const turn = run?.session[run.sessionIndex];
  const archiveUri = turn ? archivedAudioUri(turn) : null;

  const { recording, onMicIn, onMicOut } = useMic({
    ready: Boolean(turn),
    busy: Boolean(busy),
    settings,
    stopSpeak: stop,
    onTranscript: (text) => setDraft((prev) => (prev.trim() ? `${prev.trim()} ${text}` : text)),
    onBusy: setBusy,
    onError: (title, message) => Alert.alert(title, message),
  });

  useEffect(() => {
    if (!user || booted.current) {
      return;
    }
    booted.current = true;
    try {
      setRun(startReview(user.hashid, bankId, itemIds));
    } catch (e) {
      Alert.alert('还不能复盘', e instanceof Error ? e.message : '请稍后重试', [
        { text: '好', onPress: () => navigation.goBack() },
      ]);
      return;
    }
    void loadAiSettings().then(setSettings);
  }, [bankId, itemIds, navigation, user]);

  useEffect(() => {
    if (!archiveUri) {
      stop();
      return;
    }
    void play(archiveUri).catch((e) => {
      toast.show(e instanceof Error ? e.message : '朗读失败');
    });
  }, [archiveUri, play, stop, toast, turn?.id]);

  useLayoutEffect(() => {
    navigation.setOptions({
      title: '模拟复盘',
      headerRight: () => (
        <Pressable onPress={() => navigation.goBack()} hitSlop={8}>
          <Text style={styles.end}>结束复盘</Text>
        </Pressable>
      ),
    });
  }, [navigation]);

  function send() {
    const answer = draft.trim();
    if (!run || !answer || !turn) {
      return;
    }
    setDraft('');
    if (run.sessionIndex + 1 >= run.session.length) {
      navigation.goBack();
      return;
    }
    setRun({ session: run.session, sessionIndex: run.sessionIndex + 1 });
  }

  async function startPlay() {
    if (!archiveUri) {
      return;
    }
    try {
      await play(archiveUri);
    } catch (e) {
      toast.show(e instanceof Error ? e.message : '播放失败');
    }
  }

  if (!run || !turn) {
    return (
      <SafeAreaView style={styles.safe} edges={['bottom']}>
        <BusyOverlay visible={Boolean(busy)} message={busy} />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safe} edges={['bottom']}>
      <BusyOverlay visible={Boolean(busy)} message={busy} />
      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        keyboardVerticalOffset={88}
      >
        <View style={styles.top}>
          <View />
          <Text style={styles.progress}>
            {Math.min(run.sessionIndex + 1, run.session.length)} / {run.session.length}
          </Text>
        </View>
        <View style={styles.card}>
          <Text style={styles.question}>{turn.question}</Text>
          <AudioControls
            hasAudio={Boolean(archiveUri)}
            speak={speak}
            onPlay={() => void startPlay()}
            onPause={pause}
            onResume={() => resume(archiveUri)}
            onStop={stop}
          />
        </View>
        <AnswerBar
          draft={draft}
          recording={recording}
          onChangeDraft={setDraft}
          onMicIn={onMicIn}
          onMicOut={onMicOut}
          onSend={send}
        />
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.bg },
  flex: { flex: 1 },
  top: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: space.lg,
    paddingTop: space.sm,
    gap: space.sm,
  },
  progress: { color: colors.muted, fontWeight: '700' },
  card: {
    flex: 1,
    margin: space.lg,
    backgroundColor: colors.interviewer,
    borderRadius: radius.md,
    padding: space.lg,
    gap: space.md,
  },
  question: { fontSize: 22, lineHeight: 32, fontWeight: '700', color: colors.ink },
  end: { color: colors.accent, fontWeight: '700' },
});
