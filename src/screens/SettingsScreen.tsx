import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useEffect, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { useAuth } from '../auth/AuthContext';
import type { RootStackParamList } from '../navigation/types';
import { colors, radius, space } from '../theme';
import { Button } from '../ui/Button';
import { Field } from '../ui/Fields';
import { useToast } from '../ui/Toast';

export function SettingsScreen() {
  const { user, updateNickname, logout } = useAuth();
  const toast = useToast();
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const [nickname, setNickname] = useState(user?.nickname ?? '');

  useEffect(() => {
    setNickname(user?.nickname ?? '');
  }, [user?.nickname]);

  async function saveNick() {
    await updateNickname(nickname);
    toast.show('保存成功');
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

        <Pressable
          onPress={() => navigation.navigate('AiConnect')}
          style={({ pressed }) => [styles.card, pressed && styles.pressed]}
        >
          <View style={styles.cardText}>
            <Text style={styles.cardTitle}>连接大模型</Text>
            <Text style={styles.cardHint}>对话、文字转语音、语音转文字。可接豆包 / 火山方舟。</Text>
          </View>
          <Text style={styles.chevron}>›</Text>
        </Pressable>

        <View style={styles.gap} />
        <Pressable onPress={() => void logout()} style={({ pressed }) => [pressed && styles.pressed]}>
          <Text style={styles.logout}>退出登录</Text>
        </Pressable>
        <Text style={styles.meta}>当前账号 {user?.username}</Text>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.bg },
  content: { padding: space.lg, gap: space.md },
  gap: { height: 8 },
  card: {
    marginTop: space.sm,
    backgroundColor: colors.paper,
    borderRadius: radius.md,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.line,
    paddingHorizontal: space.md,
    paddingVertical: 16,
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.sm,
  },
  cardText: { flex: 1, gap: 4 },
  cardTitle: { fontSize: 16, fontWeight: '700', color: colors.ink },
  cardHint: { fontSize: 13, lineHeight: 18, color: colors.muted },
  chevron: { fontSize: 22, color: colors.faint, fontWeight: '300' },
  pressed: { opacity: 0.7 },
  logout: {
    color: colors.danger,
    fontSize: 16,
    fontWeight: '600',
    textAlign: 'center',
    paddingVertical: 14,
  },
  meta: { color: colors.faint, fontSize: 13 },
});
