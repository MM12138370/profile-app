import { Ionicons } from '@expo/vector-icons';
import { useNavigation, useRoute, type RouteProp } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useCallback, useEffect, useState } from 'react';
import { Alert, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { runDedupeQa } from '../ai';
import { useAuth } from '../auth/AuthContext';
import { commitSession, viewStatus } from '../interview';
import type { RootStackParamList } from '../navigation/types';
import { loadBank, loadJob } from '../storage';
import { colors, radius, space } from '../theme';
import type { Job } from '../types';
import { BusyOverlay } from '../ui/BusyOverlay';
import { Button } from '../ui/Button';
import { useToast } from '../ui/Toast';

type Nav = NativeStackNavigationProp<RootStackParamList, 'InterviewSave'>;
type R = RouteProp<RootStackParamList, 'InterviewSave'>;

export function InterviewSaveScreen() {
  const { user } = useAuth();
  const toast = useToast();
  const insets = useSafeAreaInsets();
  const navigation = useNavigation<Nav>();
  const { jobId } = useRoute<R>().params;
  const [job, setJob] = useState<Job | null>(null);
  const [picked, setPicked] = useState<Set<string>>(new Set());
  const [busy, setBusy] = useState('');

  const boot = useCallback(() => {
    if (!user) {
      return;
    }
    const loaded = loadJob(user.hashid, jobId);
    if (!loaded || viewStatus(loaded) !== 'active') {
      Alert.alert('没有可保存的面试', '', [{ text: '好', onPress: () => navigation.goBack() }]);
      return;
    }
    setJob(loaded);
    setPicked(new Set(loaded.session.map((item) => item.id)));
  }, [jobId, navigation, user]);

  useEffect(() => {
    boot();
  }, [boot]);

  function toggle(id: string) {
    setPicked((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  }

  async function smartPick() {
    if (!user || !job) {
      return;
    }
    setBusy('正在智能勾选…');
    try {
      const bank = job.bankId ? loadBank(user.hashid, job.bankId) : null;
      const ids = await runDedupeQa(
        job.session.map((item) => ({ id: item.id, question: item.question })),
        bank?.items.map((item) => item.question) ?? [],
      );
      setPicked(new Set(ids));
      toast.show('已按语义去重勾选');
    } catch (e) {
      Alert.alert('没勾选成', e instanceof Error ? e.message : '请稍后重试');
    } finally {
      setBusy('');
    }
  }

  function save() {
    if (!user || !job) {
      return;
    }
    commitSession(user.hashid, job.id, [...picked]);
    toast.show('已保存');
    navigation.goBack();
  }

  if (!job) {
    return null;
  }

  return (
    <View style={styles.safe}>
      <BusyOverlay visible={Boolean(busy)} message={busy} />
      <ScrollView
        contentContainerStyle={[styles.list, { paddingBottom: 88 + Math.max(insets.bottom, space.sm) }]}
      >
        {job.session.map((item, index) => {
          const on = picked.has(item.id);
          return (
            <Pressable
              key={item.id}
              onPress={() => toggle(item.id)}
              style={({ pressed }) => [styles.card, pressed && styles.pressed]}
            >
              <Ionicons
                name={on ? 'checkbox' : 'square-outline'}
                size={22}
                color={on ? colors.accent : colors.faint}
              />
              <View style={styles.body}>
                <Text style={styles.q}>
                  {index + 1}. {item.question}
                </Text>
                <Text style={styles.a} numberOfLines={4}>
                  {item.answer.trim() || '（未作答）'}
                </Text>
              </View>
            </Pressable>
          );
        })}
      </ScrollView>
      <View style={[styles.bar, { paddingBottom: Math.max(insets.bottom, space.sm) }]}>
        <Button variant="ghost" label="智能勾选" style={styles.half} onPress={() => void smartPick()} />
        <Button label="保存" style={styles.half} onPress={save} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.bg },
  list: { padding: space.lg, gap: space.sm },
  card: {
    flexDirection: 'row',
    gap: space.sm,
    alignItems: 'flex-start',
    backgroundColor: colors.paper,
    borderRadius: radius.md,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.line,
    padding: space.md,
  },
  pressed: { opacity: 0.82 },
  body: { flex: 1, gap: 6 },
  q: { fontSize: 16, fontWeight: '700', color: colors.ink, lineHeight: 22 },
  a: { fontSize: 14, color: colors.muted, lineHeight: 20 },
  bar: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    flexDirection: 'row',
    gap: space.sm,
    paddingHorizontal: space.lg,
    paddingTop: space.sm,
    backgroundColor: colors.paper,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.line,
  },
  half: { flex: 1 },
});
