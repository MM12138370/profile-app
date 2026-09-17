import {
  AudioQuality,
  IOSOutputFormat,
  requestRecordingPermissionsAsync,
  setAudioModeAsync,
  useAudioRecorder,
  type RecordingOptions,
} from 'expo-audio';
import { useEffect, useRef, useState } from 'react';
import { Platform } from 'react-native';

import { transcribeSpeech } from '../ai/speech';
import { discardWebMic, startWebMic, stopWebMic } from '../ai/webMic';
import { loadAiSettings } from '../storage';
import { speechConfigured, type AiSettings } from '../types';

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

export function useMic({
  ready,
  busy,
  settings,
  stopSpeak,
  onTranscript,
  onBusy,
  onError,
}: {
  ready: boolean;
  busy: boolean;
  settings: AiSettings | null;
  stopSpeak: () => void;
  onTranscript: (text: string) => void;
  onBusy: (message: string) => void;
  onError: (title: string, message: string) => void;
}) {
  const recorder = useAudioRecorder(WAV_RECORDING);
  const [recording, setRecording] = useState(false);
  const settingsRef = useRef(settings);
  const recordingRef = useRef(false);
  const wantRecord = useRef(false);
  const startingRecord = useRef(false);
  const recUrl = useRef('');
  const pressAt = useRef(0);
  const stopOnRelease = useRef(false);

  useEffect(() => {
    settingsRef.current = settings;
  }, [settings]);

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
    if (!ready) {
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
  }, [ready]);

  async function beginRecord() {
    if (recordingRef.current || startingRecord.current) {
      return;
    }
    const current = settingsRef.current ?? (await loadAiSettings());
    settingsRef.current = current;
    if (!speechConfigured(current)) {
      wantRecord.current = false;
      onError('还没接语音', '请先在设置 › 连接大模型 里填写豆包语音凭证，或直接用文字作答。');
      return;
    }
    startingRecord.current = true;
    try {
      stopSpeak();
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
      onError('没法录音', e instanceof Error ? e.message : '请改用文字作答');
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
    onBusy('正在识别回答…');
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
      const text = await transcribeSpeech(uri, settingsRef.current ?? undefined);
      onTranscript(text);
    } catch (e) {
      onError('识别失败', e instanceof Error ? e.message : '请改用文字作答');
    } finally {
      if (recUrl.current.startsWith('blob:')) {
        URL.revokeObjectURL(recUrl.current);
        recUrl.current = '';
      }
      onBusy('');
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

  return { recording, onMicIn, onMicOut };
}
