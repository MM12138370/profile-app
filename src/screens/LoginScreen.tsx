import { useMemo, useState } from 'react';
import {
  KeyboardAvoidingView,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { useAuth } from '../auth/AuthContext';
import { listUsers } from '../storage';
import { colors, radius, space } from '../theme';
import { Button } from '../ui/Button';
import { Field } from '../ui/Fields';

export function LoginScreen() {
  const { login } = useAuth();
  const [username, setUsername] = useState('');
  const [nickname, setNickname] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const known = useMemo(() => listUsers().map((u) => u.username), []);

  const trimmed = username.trim();
  const exists = known.includes(trimmed);

  async function onEnter() {
    setError('');
    setBusy(true);
    try {
      await login(username, exists ? undefined : nickname);
    } catch (e) {
      setError(e instanceof Error ? e.message : '登录失败');
    } finally {
      setBusy(false);
    }
  }

  return (
    <SafeAreaView style={styles.safe}>
      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <View style={styles.hero}>
          <Text style={styles.title}>职面助手</Text>
          <Text style={styles.lead}>把简历改清楚，对照岗位看匹配。</Text>
        </View>
        <View style={styles.card}>
          <Field
            label="账号"
            value={username}
            onChangeText={setUsername}
            autoCapitalize="none"
            autoCorrect={false}
            placeholder="用户名"
            returnKeyType={exists ? 'done' : 'next'}
            onSubmitEditing={() => {
              if (exists) {
                void onEnter();
              }
            }}
          />
          {!exists && trimmed ? (
            <Field
              label="昵称"
              value={nickname}
              onChangeText={setNickname}
              placeholder="怎么称呼你（可选）"
              returnKeyType="done"
              onSubmitEditing={() => void onEnter()}
            />
          ) : null}
          {trimmed ? (
            <Text style={styles.hint}>{exists ? '进入已有档案' : '将创建新档案'}</Text>
          ) : null}
          {error ? <Text style={styles.error}>{error}</Text> : null}
          <Button label={exists ? '进入' : '注册'} loading={busy} onPress={() => void onEnter()} />
        </View>
        {known.length > 0 ? (
          <View style={styles.known}>
            <Text style={styles.knownLabel}>本机已有</Text>
            <View style={styles.knownRow}>
              {known.map((name) => (
                <Pressable
                  key={name}
                  onPress={() => {
                    setUsername(name);
                    setNickname('');
                  }}
                  style={styles.pill}
                >
                  <Text style={styles.pillText}>{name}</Text>
                </Pressable>
              ))}
            </View>
          </View>
        ) : null}
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: colors.bg,
  },
  flex: {
    flex: 1,
    padding: space.lg,
    justifyContent: 'center',
    gap: space.lg,
  },
  hero: {
    gap: space.sm,
  },
  title: {
    fontSize: 36,
    fontWeight: '800',
    color: colors.ink,
  },
  lead: {
    fontSize: 16,
    lineHeight: 24,
    color: colors.muted,
  },
  card: {
    backgroundColor: colors.paper,
    borderRadius: radius.lg,
    padding: space.lg,
    gap: space.md,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.line,
  },
  hint: {
    color: colors.muted,
    fontSize: 13,
  },
  error: {
    color: colors.danger,
    fontSize: 13,
  },
  known: {
    gap: space.sm,
  },
  knownLabel: {
    color: colors.faint,
    fontSize: 12,
    fontWeight: '700',
  },
  knownRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: space.xs,
  },
  pill: {
    backgroundColor: colors.chip,
    borderRadius: radius.pill,
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  pillText: {
    color: colors.ink,
    fontWeight: '600',
  },
});
