import { useEffect, useState } from 'react';
import { Alert, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { useAuth } from '../auth/AuthContext';
import { loadAiSettings, saveAiSettings } from '../storage';
import { colors, space } from '../theme';
import type { AiSettings } from '../types';
import { Button } from '../ui/Button';
import { Field } from '../ui/Fields';

export function SettingsScreen() {
  const { user, updateNickname, logout } = useAuth();
  const [nickname, setNickname] = useState(user?.nickname ?? '');
  const [settings, setSettings] = useState<AiSettings | null>(null);

  useEffect(() => {
    setNickname(user?.nickname ?? '');
  }, [user?.nickname]);

  useEffect(() => {
    void loadAiSettings().then(setSettings);
  }, []);

  async function saveNick() {
    await updateNickname(nickname);
    Alert.alert('已保存', '下次欢迎页会用这个称呼。');
  }

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

  return (
    <SafeAreaView style={styles.safe} edges={['bottom']}>
      <ScrollView contentContainerStyle={styles.content}>
        <Field
          label="修改昵称"
          value={nickname}
          placeholder="怎么称呼你"
          onChangeText={setNickname}
        />
        <Button label="保存" onPress={() => void saveNick()} />
        <View style={styles.gap} />
        <Pressable onPress={() => void logout()} style={({ pressed }) => [pressed && styles.pressed]}>
          <Text style={styles.logout}>退出登录</Text>
        </Pressable>

        {settings ? (
          <>
            <Text style={styles.section}>模型接口</Text>
            <Text style={styles.hint}>本机直连 OpenAI 兼容接口，仅本机保存。</Text>
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
            <Button variant="ghost" label="保存模型设置" onPress={() => void save()} />
          </>
        ) : null}
        <Text style={styles.meta}>当前账号 {user?.username}</Text>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.bg },
  content: { padding: space.lg, gap: space.md },
  gap: { height: 8 },
  pressed: { opacity: 0.7 },
  logout: {
    color: colors.danger,
    fontSize: 16,
    fontWeight: '600',
    textAlign: 'center',
    paddingVertical: 14,
  },
  section: {
    marginTop: space.lg,
    fontSize: 13,
    fontWeight: '700',
    color: colors.faint,
    letterSpacing: 0.6,
  },
  hint: { fontSize: 13, lineHeight: 18, color: colors.muted },
  meta: { color: colors.faint, fontSize: 13 },
});
