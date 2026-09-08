import { useEffect, useState } from 'react';
import { Alert, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { useAuth } from '../auth/AuthContext';
import { loadAiSettings, saveAiSettings } from '../storage';
import { colors, space } from '../theme';
import type { AiSettings } from '../types';
import { Button } from '../ui/Button';
import { Field } from '../ui/Fields';

export function SettingsScreen() {
  const { user, logout } = useAuth();
  const [settings, setSettings] = useState<AiSettings | null>(null);

  useEffect(() => {
    void loadAiSettings().then(setSettings);
  }, []);

  async function save() {
    if (!settings) {
      return;
    }
    await saveAiSettings({
      ...settings,
      baseURL: settings.baseURL.trim(),
      apiKey: settings.apiKey.trim(),
      model: settings.model.trim(),
    });
    Alert.alert('已保存', '模型调用走本机直连，兼容 OpenAI 接口。');
  }

  if (!settings) {
    return null;
  }

  return (
    <SafeAreaView style={styles.safe} edges={['bottom']}>
      <ScrollView contentContainerStyle={styles.content}>
        <Text style={styles.lead}>
          没有服务端。LangGraph 工作流在 App 内运行，LLM 用你配置的 OpenAI 兼容接口。Windows 浏览器预览把档案存在本机 localStorage；iOS / Android 写入沙盒文件。
        </Text>
        <Field
          label="API Base URL"
          value={settings.baseURL}
          autoCapitalize="none"
          autoCorrect={false}
          placeholder="https://api.openai.com/v1"
          onChangeText={(baseURL) => setSettings({ ...settings, baseURL })}
        />
        <Field
          label="API Key"
          value={settings.apiKey}
          autoCapitalize="none"
          autoCorrect={false}
          secureTextEntry
          placeholder="sk-..."
          onChangeText={(apiKey) => setSettings({ ...settings, apiKey })}
        />
        <Field
          label="模型"
          value={settings.model}
          autoCapitalize="none"
          autoCorrect={false}
          placeholder="gpt-4o-mini"
          onChangeText={(model) => setSettings({ ...settings, model })}
        />
        <Text style={styles.hint}>
          DeepSeek 可把 Base URL 设为 https://api.deepseek.com/v1，模型填 deepseek-chat。
        </Text>
        <Button label="保存模型设置" onPress={() => void save()} />
        <View style={styles.gap} />
        <Text style={styles.meta}>当前用户 {user?.username}</Text>
        <Button variant="danger" label="退出登录" onPress={() => void logout()} />
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.bg },
  content: { padding: space.lg, gap: space.md },
  lead: { fontSize: 15, lineHeight: 22, color: colors.muted },
  hint: { fontSize: 13, lineHeight: 18, color: colors.muted },
  gap: { height: 12 },
  meta: { color: colors.faint, fontSize: 13 },
});
