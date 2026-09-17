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
  KeyboardAvoidingView,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { synthesizeSpeech, transcribeSpeech } from '../ai/speech';
import { voiceLabel } from '../ai/voices';
import { discardWebMic, startWebMic, stopWebMic } from '../ai/webMic';
import { useAuth } from '../auth/AuthContext';
import { answerTurn, currentTurn, prefetchAudio, viewStatus } from '../interview';
import type { RootStackParamList } from '../navigation/types';
import { audioPlayUri, loadAiSettings, loadJob, saveAiSettings } from '../storage';
import { colors, radius, space } from '../theme';
import { speechConfigured, type AiSettings, type Job } from '../types';
import { BusyOverlay } from '../ui/BusyOverlay';
import { useToast } from '../ui/Toast';
import { VoicePicker } from '../ui/VoicePicker';

type Nav = NativeStackNavigationProp<RootStackParamList, 'InterviewSession'>;
type R = RouteProp<RootStackParamList, 'InterviewSession'>;

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
  const [settings, setSettings] = useState<AiSettings | null>(null);
  const [pickingVoice, setPickingVoice] = useState(false);
  const [draft, setDraft] = useState('');
  const [busy, setBusy] = useState('');
  const [recording, setRecording] = useState(false);

  const playGen = useRef(0);
  const settingsRef = useRef<AiSettings | null>(null);
  const booted = useRef(false);
  const recordingRef = useRef(false);
  const wantRecord = useRef(false);
  const startingRecord = useRef(false);
  const recUrl = useRef('');
  const pressAt = useRef(0);
  const stopOnRelease = useRef(false);

  const turn = job ? currentTurn(job) : undefined;
  const voiceId = settings?.ttsVoice ?? '';

  const goSave = useCallback(() => {
    navigation.replace('InterviewSave', { jobId });
  }, [jobId, navigation]);

  useEffect(() => {
    settingsRef.current = settings;
  }, [settings]);

  useEffect(() => {
    if (!user || booted.current) {
      return;
    }
    booted.current = true;
    void (async () => {
      const nextSettings = await loadAiSettings();
      setSettings(nextSettings);
      settingsRef.current = nextSettings;
      const loaded = loadJob(user.hashid, jobId);
      if (!loaded || viewStatus(loaded) !== 'active') {
        Alert.alert('没有进行中的面试', '', [{ text: '好', onPress: () => navigation.goBack() }]);
        return;
      }
      if (loaded.sessionIndex >= loaded.session.length) {
        goSave();
        return;
      }
      setJob(loaded);
    })();
  }, [goSave, jobId, navigation, user]);

  const play = useCallback(
    async (uri: string) => {
      const gen = (playGen.current += 1);
      try {
        player.pause();
        await setAudioModeAsync({ playsInSilentMode: true, allowsRecording: false });
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
    },
    [player, toast],
  );

  useEffect(() => {
    if (!user || !job || !settings || !turn) {
      return;
    }
    void prefetchAudio(user.hashid, job.id, job.sessionIndex, settings, setJob).catch((e) => {
      toast.show(e instanceof Error ? e.message : '语音生成失败');
    });
  }, [job?.id, job?.sessionIndex, settings, toast, turn?.id, user]);

  useEffect(() => {
    if (!turn?.audio) {
      return;
    }
    const uri = audioPlayUri(turn.audio);
    if (uri && turn.audioText === turn.question) {
      void play(uri);
    }
  }, [play, turn?.audio, turn?.audioText, turn?.id, turn?.question]);

  useLayoutEffect(() => {
    navigation.setOptions({
      headerRight: () => (
        <Pressable onPress={goSave} hitSlop={8}>
          <Text style={styles.end}>结束面试</Text>
        </Pressable>
      ),
    });
  }, [goSave, navigation]);

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
    if (!turn) {
      return;
    }
    if (Platform.OS === 'web') {
      if (!navigator.mediaDevices?.getUserMedia) {
        return;
      }
      void navigator.mediaDevices
        .getUserMedia({ audio: true })
        .then((stream) => stream.getTracks().forEach((track) => track.stop()))
        .catch(() => undefined);
      return;
    }
    void requestRecordingPermissionsAsync();
  }, [turn]);

  async function beginRecord() {
    if (recordingRef.current || startingRecord.current) {
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
    if (busy) {
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

  function send() {
    const answer = draft.trim();
    if (!user || !job || !answer || !turn) {
      return;
    }
    const next = answerTurn(user.hashid, job.id, answer);
    setDraft('');
    if (next.sessionIndex >= next.session.length) {
      goSave();
      return;
    }
    setJob(next);
  }

  async function changeVoice(nextVoice: string) {
    if (!settings) {
      return;
    }
    const next = { ...settings, ttsVoice: nextVoice };
    setSettings(next);
    await saveAiSettings(next);
    if (turn?.question) {
      try {
        const uri = await synthesizeSpeech(turn.question, nextVoice, next);
        await play(uri);
      } catch (e) {
        toast.show(e instanceof Error ? e.message : '朗读失败');
      }
    }
  }

  async function replay() {
    if (!turn?.question) {
      return;
    }
    const uri = turn.audio && turn.audioText === turn.question ? audioPlayUri(turn.audio) : null;
    if (uri) {
      await play(uri);
      return;
    }
    try {
      const current = settingsRef.current ?? (await loadAiSettings());
      await play(await synthesizeSpeech(turn.question, current.ttsVoice, current));
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
          <Pressable onPress={() => void replay()} hitSlop={6}>
            <Text style={styles.play}>朗读</Text>
          </Pressable>
        </View>
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
            <Text style={[styles.micText, recording && styles.micOnText]}>{recording ? '停' : '说'}</Text>
          </Pressable>
          <Pressable style={styles.send} onPress={send}>
            <Text style={styles.sendText}>发送</Text>
          </Pressable>
        </View>
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
  play: { color: colors.accent, fontWeight: '700', fontSize: 15 },
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
  end: { color: colors.accent, fontWeight: '700' },
});
