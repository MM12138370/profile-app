import { useFocusEffect } from '@react-navigation/native';
import { setAudioModeAsync, useAudioPlayer } from 'expo-audio';
import { useCallback, useState } from 'react';
import { Alert, ScrollView, StyleSheet, Text } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { synthesizeSpeech } from '../ai/speech';
import { voiceLabel } from '../ai/voices';
import { loadAiSettings, saveAiSettings } from '../storage';
import { colors, space } from '../theme';
import type { AiSettings } from '../types';
import { Button } from '../ui/Button';
import { Field } from '../ui/Fields';
import { useToast } from '../ui/Toast';
import { VoiceField, VoicePicker } from '../ui/VoicePicker';

export function AiConnectScreen() {
  const toast = useToast();
  const player = useAudioPlayer(null, { keepAudioSessionActive: true });
  const [settings, setSettings] = useState<AiSettings | null>(null);
  const [pickingVoice, setPickingVoice] = useState(false);

  useFocusEffect(
    useCallback(() => {
      void loadAiSettings().then(setSettings);
    }, []),
  );

  async function save() {
    if (!settings) {
      return;
    }
    await saveAiSettings(trimmed(settings));
    toast.show('保存成功');
  }

  async function preview(voice: string) {
    if (!settings) {
      return;
    }
    try {
      await setAudioModeAsync({ playsInSilentMode: true, allowsRecording: false });
      const uri = await synthesizeSpeech('你好，我是今天的面试官。请先介绍一下你自己。', voice, trimmed(settings));
      player.replace({ uri });
      const start = Date.now();
      while (!player.isLoaded && Date.now() - start < 4000) {
        await new Promise((resolve) => setTimeout(resolve, 40));
      }
      player.play();
    } catch (e) {
      Alert.alert('试听失败', e instanceof Error ? e.message : '请检查语音凭证后重试');
    }
  }

  if (!settings) {
    return null;
  }

  return (
    <SafeAreaView style={styles.safe} edges={['bottom']}>
      <VoicePicker
        visible={pickingVoice}
        selectedId={settings.ttsVoice}
        onSelect={(ttsVoice) => setSettings({ ...settings, ttsVoice })}
        onClose={() => setPickingVoice(false)}
        onPreview={(id) => void preview(id)}
      />
      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        <Text style={styles.section}>对话模型</Text>
        <Text style={styles.hint}>
          走 OpenAI 兼容的 Chat Completions。豆包请填火山方舟地址，模型填接入点 ID。
        </Text>
        <Field
          label="API Base URL"
          value={settings.baseURL}
          autoCapitalize="none"
          autoCorrect={false}
          placeholder="https://ark.cn-beijing.volces.com/api/v3"
          onChangeText={(baseURL) => setSettings({ ...settings, baseURL })}
        />
        <Field
          label="API Key"
          value={settings.apiKey}
          autoCapitalize="none"
          autoCorrect={false}
          secureTextEntry
          placeholder="方舟 API Key"
          onChangeText={(apiKey) => setSettings({ ...settings, apiKey })}
        />
        <Field
          label="模型 / 接入点"
          value={settings.model}
          autoCapitalize="none"
          autoCorrect={false}
          placeholder="ep-xxxxxxxx 或模型名"
          onChangeText={(model) => setSettings({ ...settings, model })}
        />

        <Text style={styles.section}>豆包语音</Text>
        <Text style={styles.hint}>
          文字转语音、语音转文字走豆包语音开放接口，填语音 API Key。留空时会尝试使用上面的对话 Key。
        </Text>
        <Field
          label="语音 API Key"
          value={settings.speechApiKey}
          autoCapitalize="none"
          autoCorrect={false}
          secureTextEntry
          placeholder="可与对话 Key 相同或单独填写"
          onChangeText={(speechApiKey) => setSettings({ ...settings, speechApiKey })}
        />
        <Field
          label="TTS 资源 ID"
          value={settings.ttsResourceId}
          autoCapitalize="none"
          autoCorrect={false}
          placeholder="seed-tts-2.0"
          onChangeText={(ttsResourceId) => setSettings({ ...settings, ttsResourceId })}
        />
        <Field
          label="ASR 资源 ID"
          value={settings.sttResourceId}
          autoCapitalize="none"
          autoCorrect={false}
          placeholder="volc.bigasr.auc_turbo"
          onChangeText={(sttResourceId) => setSettings({ ...settings, sttResourceId })}
        />
        <VoiceField
          label="默认音色"
          voiceId={settings.ttsVoice}
          onPress={() => setPickingVoice(true)}
        />
        <Text style={styles.meta}>当前 {voiceLabel(settings.ttsVoice)}</Text>
        <Button label="保存" onPress={() => void save()} />
      </ScrollView>
    </SafeAreaView>
  );
}

function trimmed(settings: AiSettings): AiSettings {
  return {
    ...settings,
    baseURL: settings.baseURL.trim(),
    apiKey: settings.apiKey.trim(),
    model: settings.model.trim(),
    speechApiKey: settings.speechApiKey.trim(),
    ttsResourceId: settings.ttsResourceId.trim() || 'seed-tts-2.0',
    sttResourceId: settings.sttResourceId.trim() || 'volc.bigasr.auc_turbo',
    ttsVoice: settings.ttsVoice.trim(),
  };
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.bg },
  content: { padding: space.lg, gap: space.md, paddingBottom: 56 },
  section: {
    marginTop: space.sm,
    fontSize: 13,
    fontWeight: '700',
    color: colors.faint,
    letterSpacing: 0.6,
  },
  hint: { fontSize: 13, lineHeight: 18, color: colors.muted },
  meta: { color: colors.faint, fontSize: 13 },
});
