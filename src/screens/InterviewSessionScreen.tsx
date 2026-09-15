import { useNavigation, useRoute, type RouteProp } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import {
  AudioQuality,
  IOSOutputFormat,
  requestRecordingPermissionsAsync,
  setAudioModeAsync,
  useAudioPlayer,
  useAudioRecorder,
  type RecordingOptions,
} from 'expo-audio';
import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import {
  Alert,
  FlatList,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { QA_QUESTION_COUNT, runGenerateQa, runReview } from '../ai';
import { synthesizeSpeech, transcribeSpeech } from '../ai/speech';
import { voiceLabel } from '../ai/voices';
import { discardWebMic, startWebMic, stopWebMic } from '../ai/webMic';
import { useAuth } from '../auth/AuthContext';
import type { RootStackParamList } from '../navigation/types';
import {
  listResumes,
  loadAiSettings,
  loadComposedProfile,
  loadJob,
  loadProfileForJob,
  saveAiSettings,
  saveJob,
} from '../storage';
import { colors, radius, space } from '../theme';
import {
  speechConfigured,
  type AiSettings,
  type InterviewResult,
  type Job,
  type Resume,
} from '../types';
import { BusyOverlay } from '../ui/BusyOverlay';
import { Button } from '../ui/Button';
import { ResumePicker } from '../ui/ResumePicker';
import { useToast } from '../ui/Toast';
import { VoicePicker } from '../ui/VoicePicker';

type Nav = NativeStackNavigationProp<RootStackParamList, 'InterviewSession'>;
type R = RouteProp<RootStackParamList, 'InterviewSession'>;

type Bubble = {
  id: string;
  role: 'interviewer' | 'user';
  text: string;
};

type Turn = {
  question: string;
  userAnswer: string;
};

const WAV_RECORDING: RecordingOptions = {
  extension: '.wav',
  sampleRate: 16000,
  numberOfChannels: 1,
  bitRate: 256000,
  android: {
    outputFormat: 'default',
    audioEncoder: 'default',
  },
  ios: {
    outputFormat: IOSOutputFormat.LINEARPCM,
    audioQuality: AudioQuality.HIGH,
    linearPCMBitDepth: 16,
    linearPCMIsBigEndian: false,
    linearPCMIsFloat: false,
  },
  web: {
    mimeType: 'audio/webm',
    bitsPerSecond: 128000,
  },
};

export function InterviewSessionScreen() {
  const { user } = useAuth();
  const toast = useToast();
  const navigation = useNavigation<Nav>();
  const { jobId } = useRoute<R>().params;
  const player = useAudioPlayer(null, { keepAudioSessionActive: true });
  const recorder = useAudioRecorder(WAV_RECORDING);

  const [job, setJob] = useState<Job | null>(null);
  const [resumes, setResumes] = useState<Resume[]>([]);
  const [settings, setSettings] = useState<AiSettings | null>(null);
  const [pickingResume, setPickingResume] = useState(false);
  const [pickingVoice, setPickingVoice] = useState(false);
  const [questions, setQuestions] = useState<string[]>([]);
  const [index, setIndex] = useState(0);
  const [bubbles, setBubbles] = useState<Bubble[]>([]);
  const [draft, setDraft] = useState('');
  const [busy, setBusy] = useState('');
  const [result, setResult] = useState<InterviewResult | null>(null);
  const [finishedAsking, setFinishedAsking] = useState(false);
  const [saved, setSaved] = useState(false);

  const history = useRef<Turn[]>([]);
  const started = useRef(false);
  const saving = useRef(false);
  const playGen = useRef(0);
  const voiceRef = useRef('');
  const settingsRef = useRef<AiSettings | null>(null);
  const listRef = useRef<FlatList<Bubble>>(null);
  const booted = useRef(false);
  const allowLeave = useRef(false);
  const pendingLeave = useRef<(() => void) | null>(null);
  const recordingRef = useRef(false);
  const wantRecord = useRef(false);
  const startingRecord = useRef(false);
  const recUrl = useRef('');
  const pressAt = useRef(0);
  const stopOnRelease = useRef(false);
  const [recording, setRecording] = useState(false);

  const currentQuestion = questions[index] ?? '';
  const voiceId = settings?.ttsVoice ?? '';

  useEffect(() => {
    voiceRef.current = voiceId;
    settingsRef.current = settings;
  }, [settings, voiceId]);

  const speak = useCallback(async (text: string, voice = voiceRef.current) => {
    const current = settingsRef.current ?? (await loadAiSettings());
    settingsRef.current = current;
    const speaker = voice || current.ttsVoice;
    if (!speechConfigured(current) || !text.trim()) {
      return;
    }
    const gen = (playGen.current += 1);
    try {
      player.pause();
      await setAudioModeAsync({ playsInSilentMode: true, allowsRecording: false });
      const uri = await synthesizeSpeech(text, speaker, current);
      if (gen !== playGen.current) {
        return;
      }
      player.replace({ uri });
      const start = Date.now();
      while (!player.isLoaded && Date.now() - start < 4000) {
        await new Promise((resolve) => setTimeout(resolve, 40));
      }
      if (gen === playGen.current) {
        player.play();
      }
    } catch (e) {
      if (gen === playGen.current) {
        toast.show(e instanceof Error ? e.message : '朗读失败');
      }
    }
  }, [player, toast]);

  const beginWithResume = useCallback(
    async (resume: Resume, current: Job) => {
      if (!user) {
        return;
      }
      setBusy('正在出题…');
      try {
        const nextJob = saveJob(user.hashid, { ...current, resumeId: resume.id });
        setJob(nextJob);
        const profile = loadComposedProfile(user.hashid, resume.id);
        const generated = await runGenerateQa(nextJob.structured!, profile, [], QA_QUESTION_COUNT);
        started.current = true;
        setQuestions(generated);
        setIndex(0);
        setBubbles([{ id: 'q-0', role: 'interviewer', text: generated[0] }]);
        void speak(generated[0]);
      } catch (e) {
        started.current = false;
        Alert.alert('没出成题', e instanceof Error ? e.message : '请稍后重试');
      } finally {
        setBusy('');
      }
    },
    [speak, user],
  );

  useEffect(() => {
    if (!user || booted.current) {
      return;
    }
    booted.current = true;
    void (async () => {
      const nextSettings = await loadAiSettings();
      setSettings(nextSettings);
      settingsRef.current = nextSettings;
      voiceRef.current = nextSettings.ttsVoice;
      const loaded = loadJob(user.hashid, jobId);
      setJob(loaded);
      const available = listResumes(user.hashid);
      setResumes(available);
      if (!loaded.structured) {
        Alert.alert('还不能面试', '请先对该岗位做 JD 结构化。', [
          { text: '好', onPress: () => navigation.goBack() },
        ]);
        return;
      }
      if (available.length === 0) {
        Alert.alert('还没有简历', '请先在简历中心创建一份子简历。', [
          { text: '取消', style: 'cancel', onPress: () => navigation.goBack() },
          { text: '去创建', onPress: () => navigation.navigate('Profile', {}) },
        ]);
        return;
      }
      const resume = available.find((item) => item.id === loaded.resumeId);
      if (!resume) {
        setPickingResume(true);
        return;
      }
      await beginWithResume(resume, loaded);
    })();
  }, [beginWithResume, jobId, navigation, user]);

  const persistSession = useCallback(async (): Promise<boolean> => {
    if (!user || !job?.structured || saving.current) {
      return false;
    }
    if (history.current.length === 0) {
      Alert.alert('至少回答一题再保存');
      return false;
    }
    saving.current = true;
    setBusy('正在复盘并保存…');
    const questionsAsked = history.current.map((turn) => turn.question);
    const userAnswers = history.current.map((turn) => turn.userAnswer);
    const standardAnswers = questionsAsked.map(() => '');
    let review: Pick<InterviewResult, 'score' | 'matchScore' | 'optimizationPoints'> | undefined;
    try {
      try {
        review = await runReview({
          jd: job.structured,
          profile: loadProfileForJob(user.hashid, job),
          questions: questionsAsked,
          standardAnswers,
          userAnswers,
        });
      } catch (e) {
        toast.show(e instanceof Error ? e.message : '复盘失败，问答仍会保存');
      }
      const interviewResult: InterviewResult = {
        questions: questionsAsked,
        standardAnswers,
        userAnswers,
        savedAt: new Date().toISOString(),
        voice: voiceRef.current,
        ...review,
      };
      const latest = loadJob(user.hashid, job.id);
      saveJob(user.hashid, { ...latest, interviewResult });
      setResult(interviewResult);
      setSaved(true);
      toast.show('已保存到面试助手');
      return true;
    } catch (e) {
      saving.current = false;
      Alert.alert('保存失败', e instanceof Error ? e.message : '请稍后重试');
      return false;
    } finally {
      setBusy('');
    }
  }, [job, toast, user]);

  const leave = useCallback(() => {
    allowLeave.current = true;
    player.pause();
    playGen.current += 1;
    const action = pendingLeave.current;
    pendingLeave.current = null;
    if (action) {
      action();
    } else {
      navigation.goBack();
    }
  }, [navigation, player]);

  const promptSave = useCallback(
    (mode: 'end' | 'leave', allDone = finishedAsking) => {
      if (saved || result) {
        leave();
        return;
      }
      if (history.current.length === 0) {
        if (mode === 'leave') {
          leave();
          return;
        }
        Alert.alert('还没开始回答', '至少回答一题，或直接离开。', [
          { text: '继续', style: 'cancel' },
          { text: '离开', style: 'destructive', onPress: leave },
        ]);
        return;
      }
      Alert.alert(
        '保存本次面试？',
        '同意后会写入面试助手。不同意则本次问答不会留下。',
        [
          ...(mode === 'end' && !allDone
            ? [{ text: '继续面试', style: 'cancel' as const }]
            : []),
          { text: '不保存', style: 'destructive', onPress: leave },
          {
            text: '保存',
            onPress: () => {
              void persistSession().then((ok) => {
                if (ok && mode === 'leave') {
                  leave();
                }
              });
            },
          },
        ],
      );
    },
    [finishedAsking, leave, persistSession, result, saved],
  );

  useEffect(() => {
    const sub = navigation.addListener('beforeRemove', (e) => {
      if (allowLeave.current || saved || result || history.current.length === 0) {
        return;
      }
      e.preventDefault();
      pendingLeave.current = () => navigation.dispatch(e.data.action);
      promptSave('leave');
    });
    return sub;
  }, [navigation, promptSave, result, saved]);

  useLayoutEffect(() => {
    navigation.setOptions({
      headerRight: () =>
        result ? null : (
          <Pressable onPress={() => promptSave('end')} hitSlop={8}>
            <Text style={styles.end}>结束面试</Text>
          </Pressable>
        ),
    });
  }, [navigation, promptSave, result]);

  useEffect(() => {
    return () => {
      wantRecord.current = false;
      recordingRef.current = false;
      discardWebMic();
      if (recUrl.current.startsWith('blob:')) {
        URL.revokeObjectURL(recUrl.current);
        recUrl.current = '';
      }
    };
  }, []);

  useEffect(() => {
    if (!questions.length) {
      return;
    }
    if (Platform.OS === 'web') {
      if (!navigator.mediaDevices?.getUserMedia) {
        return;
      }
      void navigator.mediaDevices
        .getUserMedia({ audio: true })
        .then((stream) => {
          stream.getTracks().forEach((track) => track.stop());
        })
        .catch(() => undefined);
      return;
    }
    void requestRecordingPermissionsAsync();
  }, [questions.length]);

  async function beginRecord() {
    if (finishedAsking || recordingRef.current || startingRecord.current) {
      return;
    }
    const current = settings ?? (await loadAiSettings());
    settingsRef.current = current;
    if (!speechConfigured(current)) {
      wantRecord.current = false;
      Alert.alert('还没接语音', '请先在设置 › 连接大模型 里填写豆包语音凭证，或直接用文字作答。');
      return;
    }
    startingRecord.current = true;
    try {
      player.pause();
      playGen.current += 1;
      if (Platform.OS === 'web') {
        await startWebMic();
      } else {
        const permission = await requestRecordingPermissionsAsync();
        if (!permission.granted) {
          throw new Error('请允许使用麦克风');
        }
        await setAudioModeAsync({ allowsRecording: true, playsInSilentMode: true });
        await recorder.prepareToRecordAsync();
        recorder.record();
      }
      if (!wantRecord.current) {
        recordingRef.current = true;
        setRecording(true);
        await finishRecord();
        return;
      }
      recordingRef.current = true;
      setRecording(true);
    } catch (e) {
      wantRecord.current = false;
      recordingRef.current = false;
      setRecording(false);
      discardWebMic();
      Alert.alert('没法录音', e instanceof Error ? e.message : '请改用文字作答');
    } finally {
      startingRecord.current = false;
    }
  }

  async function finishRecord() {
    if (!recordingRef.current) {
      discardWebMic();
      return;
    }
    recordingRef.current = false;
    setRecording(false);
    setBusy('正在识别回答…');
    try {
      let uri = '';
      if (Platform.OS === 'web') {
        const blob = await stopWebMic();
        if (recUrl.current.startsWith('blob:')) {
          URL.revokeObjectURL(recUrl.current);
        }
        uri = URL.createObjectURL(blob);
        recUrl.current = uri;
      } else {
        await recorder.stop();
        uri = recorder.uri ?? '';
        await setAudioModeAsync({ allowsRecording: false, playsInSilentMode: true });
      }
      if (!uri) {
        throw new Error('没有录到声音');
      }
      const text = await transcribeSpeech(uri, settingsRef.current ?? settings ?? undefined);
      setDraft((prev) => (prev.trim() ? `${prev.trim()} ${text}` : text));
    } catch (e) {
      Alert.alert('识别失败', e instanceof Error ? e.message : '请改用文字作答');
    } finally {
      if (recUrl.current.startsWith('blob:')) {
        URL.revokeObjectURL(recUrl.current);
        recUrl.current = '';
      }
      setBusy('');
    }
  }

  function onMicIn() {
    if (finishedAsking || busy) {
      return;
    }
    if (recordingRef.current) {
      stopOnRelease.current = true;
      return;
    }
    stopOnRelease.current = false;
    pressAt.current = Date.now();
    wantRecord.current = true;
    void beginRecord();
  }

  function onMicOut() {
    if (stopOnRelease.current) {
      stopOnRelease.current = false;
      wantRecord.current = false;
      if (recordingRef.current) {
        void finishRecord();
      }
      return;
    }
    if (Date.now() - pressAt.current < 280) {
      wantRecord.current = true;
      return;
    }
    wantRecord.current = false;
    if (startingRecord.current) {
      return;
    }
    if (recordingRef.current) {
      void finishRecord();
    }
  }

  function send(text = draft) {
    const answer = text.trim();
    if (!answer || !currentQuestion || finishedAsking) {
      return;
    }
    setDraft('');
    const turnIndex = history.current.length;
    setBubbles((prev) => [...prev, { id: `a-${turnIndex}`, role: 'user', text: answer }]);
    history.current = [...history.current, { question: currentQuestion, userAnswer: answer }];
    if (index + 1 >= questions.length) {
      setFinishedAsking(true);
      promptSave('end', true);
      return;
    }
    const nextIndex = index + 1;
    const next = questions[nextIndex];
    setIndex(nextIndex);
    setBubbles((prev) => [...prev, { id: `q-${nextIndex}`, role: 'interviewer', text: next }]);
    void speak(next);
  }

  async function changeVoice(nextVoice: string) {
    if (!settings) {
      return;
    }
    const next = { ...settings, ttsVoice: nextVoice };
    setSettings(next);
    await saveAiSettings(next);
    if (currentQuestion) {
      void speak(currentQuestion, nextVoice);
    }
  }

  if (result) {
    return (
      <SafeAreaView style={styles.safe} edges={['bottom']}>
        <View style={styles.review}>
          <Text style={styles.kicker}>{saved ? '已写入面试助手' : '面试复盘'}</Text>
          {result.score !== undefined ? <Text style={styles.score}>{result.score} 分</Text> : null}
          {result.matchScore !== undefined ? (
            <Text style={styles.match}>对该岗位匹配度 {result.matchScore} / 10</Text>
          ) : null}
          {result.optimizationPoints ? <Text style={styles.points}>{result.optimizationPoints}</Text> : null}
          <Button
            label="返回"
            onPress={() => {
              allowLeave.current = true;
              navigation.goBack();
            }}
          />
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safe} edges={['bottom']}>
      <BusyOverlay visible={Boolean(busy)} message={busy} />
      <ResumePicker
        visible={pickingResume}
        resumes={resumes}
        selectedId={job?.resumeId}
        title="选择简历"
        hint="面试问答会按这份简历出题，只用简历里有的事实。"
        onClose={() => {
          setPickingResume(false);
          if (!started.current) {
            navigation.goBack();
          }
        }}
        onSelect={(resume) => {
          setPickingResume(false);
          if (job) {
            void beginWithResume(resume, job);
          }
        }}
      />
      <VoicePicker
        visible={pickingVoice}
        selectedId={voiceId}
        onSelect={(id) => void changeVoice(id)}
        onClose={() => setPickingVoice(false)}
        onPreview={(id) => void speak('你好，我是今天的面试官。', id)}
      />
      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        keyboardVerticalOffset={88}
      >
        {questions.length > 0 ? (
          <View style={styles.top}>
            <Pressable
              onPress={() => setPickingVoice(true)}
              style={({ pressed }) => [styles.voiceBtn, pressed && styles.pressed]}
            >
              <Text style={styles.voiceText}>{voiceLabel(voiceId) || '选择音色'}</Text>
            </Pressable>
            <Text style={styles.progress}>
              {Math.min(index + 1, questions.length)} / {questions.length}
            </Text>
          </View>
        ) : null}
        <FlatList
          ref={listRef}
          data={bubbles}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.list}
          onContentSizeChange={() => listRef.current?.scrollToEnd({ animated: true })}
          renderItem={({ item }) => (
            <View style={[styles.bubble, item.role === 'user' ? styles.user : styles.bot]}>
              <Text style={[styles.bubbleText, item.role === 'user' && styles.userText]}>{item.text}</Text>
              {item.role === 'interviewer' ? (
                <Pressable onPress={() => void speak(item.text)} hitSlop={6}>
                  <Text style={styles.play}>朗读</Text>
                </Pressable>
              ) : null}
            </View>
          )}
        />
        {finishedAsking || questions.length === 0 ? null : (
          <View style={styles.composer}>
            <TextInput
              value={draft}
              onChangeText={setDraft}
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
              <Text style={[styles.micText, recording && styles.micOnText]}>
                {recording ? '停' : '说'}
              </Text>
            </Pressable>
            <Pressable style={styles.send} onPress={() => send()}>
              <Text style={styles.sendText}>发送</Text>
            </Pressable>
          </View>
        )}
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
  list: { padding: space.lg, gap: space.sm, paddingBottom: 24 },
  bubble: {
    maxWidth: '86%',
    borderRadius: radius.md,
    padding: space.md,
    gap: 8,
  },
  bot: {
    alignSelf: 'flex-start',
    backgroundColor: colors.interviewer,
  },
  user: {
    alignSelf: 'flex-end',
    backgroundColor: colors.accent,
  },
  bubbleText: {
    fontSize: 16,
    lineHeight: 22,
    color: colors.ink,
  },
  userText: { color: '#fff' },
  play: { color: colors.accent, fontWeight: '700', fontSize: 13 },
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
  micOn: {
    backgroundColor: colors.danger,
  },
  micText: { color: colors.accent, fontWeight: '700' },
  micOnText: { color: '#fff' },
  send: {
    backgroundColor: colors.accent,
    borderRadius: radius.pill,
    paddingHorizontal: 16,
    paddingVertical: 10,
  },
  sendText: { color: '#fff', fontWeight: '700' },
  end: { color: colors.accent, fontWeight: '700' },
  review: { flex: 1, padding: space.lg, gap: space.md, justifyContent: 'center' },
  kicker: { color: colors.accent, fontWeight: '700' },
  score: { fontSize: 48, fontWeight: '800', color: colors.ink },
  match: { fontSize: 18, color: colors.good, fontWeight: '700' },
  points: { fontSize: 16, lineHeight: 24, color: colors.ink },
});
