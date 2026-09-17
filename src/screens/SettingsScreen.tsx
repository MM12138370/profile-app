import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useEffect, useState } from 'react';
import { Alert, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { useAuth } from '../auth/AuthContext';
import type { RootStackParamList } from '../navigation/types';
import { exportUserArchive, importArchiveIntoUser, parseArchive, pickArchiveBytes } from '../storage';
import { colors, radius, space } from '../theme';
import { BusyOverlay } from '../ui/BusyOverlay';
import { Button } from '../ui/Button';
import { Field } from '../ui/Fields';
import { useToast } from '../ui/Toast';

export function SettingsScreen() {
  const { user, updateNickname, logout } = useAuth();
  const toast = useToast();
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const [nickname, setNickname] = useState(user?.nickname ?? '');
  const [busy, setBusy] = useState('');

  useEffect(() => {
    setNickname(user?.nickname ?? '');
  }, [user?.nickname]);

  async function saveNick() {
    await updateNickname(nickname);
    toast.show('保存成功');
  }

  async function onExport() {
    if (!user || busy) {
      return;
    }
    setBusy('正在打包存档');
    await yieldUi();
    try {
      await exportUserArchive(user);
      toast.show('已导出');
    } catch (error) {
      Alert.alert('没导出', error instanceof Error ? error.message : '请稍后重试');
    } finally {
      setBusy('');
    }
  }

  async function onImport() {
    if (!user || busy) {
      return;
    }
    try {
      const bytes = await pickArchiveBytes();
      if (!bytes) {
        return;
      }
      const pack = parseArchive(bytes);
      const from = pack.manifest.user.username;
      const same = from === user.username;
      Alert.alert(
        '导入存档',
        same
          ? '将用该存档替换当前账号的全部数据，无法撤销。'
          : `来自账号 ${from} 的存档将写入当前账号，覆盖简历、岗位、面试问答和语音，无法撤销。`,
        [
          { text: '取消', style: 'cancel' },
          {
            text: '导入',
            style: 'destructive',
            onPress: () => {
              void applyImport(bytes);
            },
          },
        ],
      );
    } catch (error) {
      Alert.alert('没导入', error instanceof Error ? error.message : '请选择 .zm 存档');
    }
  }

  async function applyImport(bytes: Uint8Array) {
    if (!user) {
      return;
    }
    setBusy('正在读入存档');
    await yieldUi();
    try {
      importArchiveIntoUser(user.hashid, bytes);
      toast.show('已导入');
    } catch (error) {
      Alert.alert('没导入', error instanceof Error ? error.message : '请稍后重试');
    } finally {
      setBusy('');
    }
  }

  return (
    <SafeAreaView style={styles.safe} edges={['bottom']}>
      <BusyOverlay visible={Boolean(busy)} message={busy} />
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

        <Pressable
          onPress={() => void onExport()}
          style={({ pressed }) => [styles.card, pressed && styles.pressed]}
        >
          <View style={styles.cardText}>
            <Text style={styles.cardTitle}>导出存档</Text>
            <Text style={styles.cardHint}>把当前账号的简历、岗位、面试问答和语音打成 .zm 文件。</Text>
          </View>
          <Text style={styles.chevron}>›</Text>
        </Pressable>

        <Pressable
          onPress={() => void onImport()}
          style={({ pressed }) => [styles.card, pressed && styles.pressed]}
        >
          <View style={styles.cardText}>
            <Text style={styles.cardTitle}>导入存档</Text>
            <Text style={styles.cardHint}>读入 .zm 文件，覆盖当前账号的本机数据。</Text>
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

function yieldUi(): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, 50));
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
