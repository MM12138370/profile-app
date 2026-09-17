import { useNavigation, useRoute, type RouteProp } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import { Alert, KeyboardAvoidingView, Platform, Pressable, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { synthesizeSpeech } from '../ai/speech';
import { voiceLabel } from '../ai/voices';
import { useAuth } from '../auth/AuthContext';
import { archiveSessionTurns, interviewStatus } from '../edit/interview';
import type { RootStackParamList } from '../navigation/types';
import { answerTurn } from '../runtime/interview';
import { useMic } from '../runtime/mic';
import { useSpeakPlayer } from '../runtime/speak';
import { archivedAudioUri, loadAiSettings, loadJob, saveAiSettings } from '../storage';
import { colors, radius, space } from '../theme';
import { speechConfigured, type AiSettings, type Job } from '../types';
import { AnswerBar } from '../ui/AnswerBar';
import { BusyOverlay } from '../ui/BusyOverlay';
import { useToast } from '../ui/Toast';
import { VoicePicker } from '../ui/VoicePicker';

type Nav = NativeStackNavigationProp<RootStackParamList, 'InterviewSession'>;
type R = RouteProp<RootStackParamList, 'InterviewSession'>;

export function InterviewSessionScreen() {
  const { user } = useAuth();
  const toast = useToast();
  const navigation = useNavigation<Nav>();
  const { jobId } = useRoute<R>().params;
  const { speak, play, pause, resume, stop } = useSpeakPlayer();

  const [job, setJob] = useState<Job | null>(null);
  const [settings, setSettings] = useState<AiSettings | null>(null);
  const [pickingVoice, setPickingVoice] = useState(false);
  const [draft, setDraft] = useState('');
  const [busy, setBusy] = useState('');
  const booted = useRef(false);

  const turn = job?.session[job.sessionIndex];
  const voiceId = settings?.ttsVoice ?? '';
  const archiveUri = turn ? archivedAudioUri(turn) : null;

  const finish = useCallback(() => {
    navigation.replace('InterviewSave', { jobId });
  }, [jobId, navigation]);

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
    const loaded = loadJob(user.hashid, jobId);
    if (!loaded || interviewStatus(loaded) !== 'active') {
      Alert.alert('没有进行中的面试', '', [{ text: '好', onPress: () => navigation.goBack() }]);
      return;
    }
    if (loaded.sessionIndex >= loaded.session.length) {
      navigation.replace('InterviewSave', { jobId });
      return;
    }
    setJob(loaded);
    void loadAiSettings().then(setSettings);
  }, [jobId, navigation, user]);

  const playRef = useRef(play);
  const stopRef = useRef(stop);
  const toastRef = useRef(toast);
  playRef.current = play;
  stopRef.current = stop;
  toastRef.current = toast;

  useEffect(() => {
    if (!archiveUri) {
      stopRef.current();
      return;
    }
    void playRef.current(archiveUri).catch((e) => {
      toastRef.current.show(e instanceof Error ? e.message : '朗读失败');
    });
    return () => {
      stopRef.current();
    };
  }, [archiveUri]);

  useLayoutEffect(() => {
    navigation.setOptions({
      title: '面试',
      headerRight: () => (
        <Pressable onPress={finish} hitSlop={8}>
          <Text style={styles.end}>结束面试</Text>
        </Pressable>
      ),
    });
  }, [finish, navigation]);

  function send() {
    const answer = draft.trim();
    if (!user || !job || !answer || !turn) {
      return;
    }
    const next = answerTurn(user.hashid, jobId, answer);
    setDraft('');
    if (next.sessionIndex >= next.session.length) {
      finish();
      return;
    }
    setJob(next);
  }

  async function changeVoice(nextVoice: string) {
    if (!settings || !user || !job) {
      return;
    }
    const next = { ...settings, ttsVoice: nextVoice };
    setSettings(next);
    await saveAiSettings(next);
    try {
      const nextJob = await archiveSessionTurns(
        user.hashid,
        jobId,
        [job.sessionIndex, job.sessionIndex + 1],
        next,
        setJob,
      );
      const current = nextJob.session[nextJob.sessionIndex];
      const uri = current ? archivedAudioUri(current) : null;
      if (uri) {
        await play(uri);
      }
    } catch (e) {
      toast.show(e instanceof Error ? e.message : '语音生成失败');
    }
  }

  async function startSpeak() {
    if (archiveUri) {
      await play(archiveUri);
      return;
    }
    if (!user || !job) {
      return;
    }
    const current = settings ?? (await loadAiSettings());
    if (!speechConfigured(current)) {
      Alert.alert('还没接语音', '请先在设置 › 连接大模型 里填写豆包语音凭证。');
      return;
    }
    try {
      await archiveSessionTurns(user.hashid, jobId, [job.sessionIndex], current, setJob);
    } catch (e) {
      toast.show(e instanceof Error ? e.message : '朗读失败');
    }
  }

  if (!job || !turn) {
    return (
      <SafeAreaView style={styles.safe} edges={['bottom']}>
        <BusyOverlay visible={Boolean(busy)} message={busy} />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safe} edges={['bottom']}>
      <BusyOverlay visible={Boolean(busy)} message={busy} />
      <VoicePicker
        visible={pickingVoice}
        selectedId={voiceId}
        onSelect={(id) => void changeVoice(id)}
        onClose={() => setPickingVoice(false)}
        onPreview={(id) => void synthesizeSpeech('你好，我是今天的面试官。', id).then(play)}
      />
      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        keyboardVerticalOffset={88}
      >
        <View style={styles.top}>
          <Pressable
            onPress={() => setPickingVoice(true)}
            style={({ pressed }) => [styles.voiceBtn, pressed && styles.pressed]}
          >
            <Text style={styles.voiceText}>{voiceLabel(voiceId) || '选择音色'}</Text>
          </Pressable>
          <Text style={styles.progress}>
            {Math.min(job.sessionIndex + 1, job.session.length)} / {job.session.length}
          </Text>
        </View>
        <View style={styles.card}>
          <Text style={styles.question}>{turn.question}</Text>
          {archiveUri || turn.question ? (
            <View style={styles.speak}>
              {speak === 'idle' ? (
                <Pressable onPress={() => void startSpeak()} hitSlop={6}>
                  <Text style={styles.play}>朗读</Text>
                </Pressable>
              ) : (
                <>
                  <Pressable onPress={speak === 'playing' ? pause : () => resume(archiveUri)} hitSlop={6}>
                    <Text style={styles.play}>{speak === 'playing' ? '暂停' : '继续'}</Text>
                  </Pressable>
                  <Pressable onPress={stop} hitSlop={6} accessibilityLabel="停止朗读">
                    <Text style={styles.play}>停止朗读</Text>
                  </Pressable>
                </>
              )}
            </View>
          ) : null}
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
  voiceBtn: {
    backgroundColor: colors.accentSoft,
    borderRadius: radius.pill,
    paddingHorizontal: 12,
    paddingVertical: 6,
    maxWidth: '72%',
  },
  voiceText: { color: colors.accent, fontWeight: '700', fontSize: 13 },
  progress: { color: colors.muted, fontWeight: '700' },
  pressed: { opacity: 0.82 },
  card: {
    flex: 1,
    margin: space.lg,
    backgroundColor: colors.interviewer,
    borderRadius: radius.md,
    padding: space.lg,
    gap: space.md,
  },
  question: { fontSize: 22, lineHeight: 32, fontWeight: '700', color: colors.ink },
  speak: { flexDirection: 'row', alignItems: 'center', gap: space.md },
  play: { color: colors.accent, fontWeight: '700', fontSize: 15 },
  end: { color: colors.accent, fontWeight: '700' },
});
