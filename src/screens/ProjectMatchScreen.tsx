import { useFocusEffect, useNavigation, useRoute, type RouteProp } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useCallback, useRef, useState } from 'react';
import {
  Alert,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { runMatchProject } from '../ai';
import { useAuth } from '../auth/AuthContext';
import { copyText } from '../copyText';
import type { RootStackParamList } from '../navigation/types';
import { loadJob, saveJob } from '../storage';
import { colors, radius, space } from '../theme';
import type { Job } from '../types';
import { BusyOverlay } from '../ui/BusyOverlay';
import { Button } from '../ui/Button';
import { Field } from '../ui/Fields';
import { useToast } from '../ui/Toast';

type Nav = NativeStackNavigationProp<RootStackParamList, 'ProjectMatch'>;
type R = RouteProp<RootStackParamList, 'ProjectMatch'>;

export function ProjectMatchScreen() {
  const { user } = useAuth();
  const toast = useToast();
  const navigation = useNavigation<Nav>();
  const { jobId } = useRoute<R>().params;
  const [job, setJob] = useState<Job | null>(null);
  const [original, setOriginal] = useState('');
  const [points, setPoints] = useState('');
  const [optimized, setOptimized] = useState('');
  const [busy, setBusy] = useState(false);
  const latest = useRef({ original: '', points: '', optimized: '' });
  const jobRef = useRef<Job | null>(null);
  const hashidRef = useRef('');

  const persistDraft = useCallback((next: { original: string; points: string; optimized: string }) => {
    const current = jobRef.current;
    const hashid = hashidRef.current;
    if (!current || !hashid) {
      return;
    }
    const projectAssist =
      next.original.trim() || next.points.trim() || next.optimized.trim()
        ? {
            original: next.original,
            points: next.points,
            optimized: next.optimized,
          }
        : null;
    const saved = saveJob(hashid, { ...current, projectAssist });
    jobRef.current = saved;
  }, []);

  useFocusEffect(
    useCallback(() => {
      if (!user) {
        return;
      }
      const loaded = loadJob(user.hashid, jobId);
      if (!loaded.structured) {
        Alert.alert('还不能匹配', '请先对该岗位做 JD 结构化。', [
          { text: '好', onPress: () => navigation.goBack() },
        ]);
        return;
      }
      hashidRef.current = user.hashid;
      jobRef.current = loaded;
      setJob(loaded);
      const draft = loaded.projectAssist;
      const next = {
        original: draft?.original ?? '',
        points: draft?.points ?? '',
        optimized: draft?.optimized ?? '',
      };
      setOriginal(next.original);
      setPoints(next.points);
      setOptimized(next.optimized);
      latest.current = next;
      return () => persistDraft(latest.current);
    }, [user, jobId, navigation, persistDraft]),
  );

  function onOriginal(value: string) {
    setOriginal(value);
    latest.current = { ...latest.current, original: value };
  }

  async function generate() {
    if (!job?.structured) {
      return;
    }
    const text = original.trim();
    if (!text) {
      Alert.alert('请先填写项目', '写你真实产出或跟进过的项目，不会编造新经历。');
      return;
    }
    setBusy(true);
    try {
      const result = await runMatchProject(job.structured, text);
      const next = { original, points: result.points, optimized: result.optimized };
      setPoints(result.points);
      setOptimized(result.optimized);
      latest.current = next;
      persistDraft(next);
      toast.show('已生成优化内容');
    } catch (error) {
      Alert.alert('没做完', error instanceof Error ? error.message : '请稍后重试');
    } finally {
      setBusy(false);
    }
  }

  async function copyOptimized() {
    try {
      const mode = await copyText(optimized);
      toast.show(mode === 'copied' ? '已复制，可粘贴到简历' : '已打开分享，可选择拷贝');
    } catch (error) {
      Alert.alert('没复制成', error instanceof Error ? error.message : '请稍后重试');
    }
  }

  return (
    <SafeAreaView style={styles.safe} edges={['bottom']}>
      <BusyOverlay visible={busy} message="正在按岗位优化项目表述…" />
      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
          <Text style={styles.hint}>
            填写你真实做过或跟进的项目。AI 只提炼原文重点，并改写成更贴当前岗位的表述，不会编新项目。
          </Text>
          <Field
            label="我的项目"
            value={original}
            onChangeText={onOriginal}
            placeholder="项目背景、你负责的部分、用过的技术、推进结果"
            multiline
            style={styles.area}
          />
          <Button label="一键生成优化内容" loading={busy} disabled={busy} onPress={() => void generate()} />
          {points.trim() ? (
            <View style={styles.card}>
              <Text style={styles.cardTitle}>提炼重点</Text>
              <Text style={styles.body}>{points}</Text>
            </View>
          ) : null}
          {optimized.trim() ? (
            <View style={styles.card}>
              <Text style={styles.cardTitle}>优化后的项目内容</Text>
              <Text selectable style={styles.body}>
                {optimized}
              </Text>
              <Button variant="ghost" label="一键复制使用" onPress={() => void copyOptimized()} />
            </View>
          ) : null}
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.bg },
  flex: { flex: 1 },
  content: {
    padding: space.lg,
    gap: space.md,
    paddingBottom: 48,
  },
  hint: {
    color: colors.muted,
    fontSize: 13,
    lineHeight: 18,
  },
  area: {
    minHeight: 180,
  },
  card: {
    backgroundColor: colors.paper,
    borderRadius: radius.md,
    padding: space.md,
    gap: 8,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.line,
  },
  cardTitle: {
    fontWeight: '700',
    color: colors.ink,
    fontSize: 15,
  },
  body: {
    color: colors.ink,
    fontSize: 15,
    lineHeight: 22,
  },
});
