import { useFocusEffect, useNavigation, useRoute, type RouteProp } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useCallback, useLayoutEffect, useState } from 'react';
import {
  Alert,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { runAnalyzeJob, runDistillJd } from '../ai';
import { useAuth } from '../auth/AuthContext';
import { JD_DIGEST_FIELDS } from '../jobText';
import type { RootStackParamList } from '../navigation/types';
import { loadJob, saveJob } from '../storage';
import { colors, radius, space } from '../theme';
import { normalizeStructuredJd, structuredJdOrNull, type Job, type StructuredJD } from '../types';
import { BusyOverlay } from '../ui/BusyOverlay';
import { Button } from '../ui/Button';
import { JobFields } from '../ui/JobFields';
import { useToast } from '../ui/Toast';

type Nav = NativeStackNavigationProp<RootStackParamList, 'JobStructured'>;
type R = RouteProp<RootStackParamList, 'JobStructured'>;

export function JobStructuredScreen() {
  const { user } = useAuth();
  const toast = useToast();
  const navigation = useNavigation<Nav>();
  const { jobId } = useRoute<R>().params;
  const [job, setJob] = useState<Job | null>(null);
  const [busy, setBusy] = useState('');
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState<StructuredJD>(normalizeStructuredJd({}));

  const persist = useCallback(
    (next: Job) => {
      if (!user) {
        return next;
      }
      const saved = saveJob(user.hashid, next);
      setJob(saved);
      return saved;
    },
    [user],
  );

  const saveEdit = useCallback(() => {
    if (!job) {
      return;
    }
    const structured = structuredJdOrNull(draft);
    const unchanged = JSON.stringify(structured) === JSON.stringify(job.structured);
    if (!unchanged) {
      persist({
        ...job,
        structured,
        jdDigest: structured ? job.jdDigest : null,
      });
      toast.show('保存成功');
    }
    setEditing(false);
    if (!structured) {
      Alert.alert('结构化结果已清空', '可回到岗位页重新做 JD 结构化。', [
        { text: '好', onPress: () => navigation.goBack() },
      ]);
    }
  }, [draft, job, navigation, persist, toast]);

  useFocusEffect(
    useCallback(() => {
      if (!user) {
        return;
      }
      const loaded = loadJob(user.hashid, jobId);
      if (!loaded.structured) {
        Alert.alert('还没有结构化结果', '请先对该岗位做 JD 结构化。', [
          { text: '好', onPress: () => navigation.goBack() },
        ]);
        return;
      }
      setJob(loaded);
      if (!editing) {
        setDraft(loaded.structured);
      }
    }, [user, jobId, navigation, editing]),
  );

  useLayoutEffect(() => {
    navigation.setOptions({
      headerRight: () =>
        job?.structured ? (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={editing ? '完成' : '修改'}
            hitSlop={8}
            disabled={Boolean(busy)}
            onPress={() => {
              if (editing) {
                saveEdit();
                return;
              }
              setDraft(job.structured ?? normalizeStructuredJd({}));
              setEditing(true);
            }}
          >
            <Text style={styles.edit}>{editing ? '完成' : '修改'}</Text>
          </Pressable>
        ) : null,
    });
  }, [busy, editing, job, navigation, saveEdit]);

  async function run(label: string, work: (current: Job) => Promise<Job>): Promise<Job | null> {
    if (!job || !user) {
      return null;
    }
    setBusy(label);
    try {
      return persist(await work(job));
    } catch (error) {
      Alert.alert('没做完', error instanceof Error ? error.message : '请稍后重试');
      return null;
    } finally {
      setBusy('');
    }
  }

  function restructure() {
    if (!job?.rawJD.trim()) {
      Alert.alert('没有岗位原文', '请先在岗位页填写或修改原始 JD。');
      return;
    }
    void run('正在结构化 JD…', async (current) => {
      const structured = await runAnalyzeJob({ text: current.rawJD });
      setDraft(structured);
      setEditing(false);
      return { ...current, structured, jdDigest: null };
    }).then((next) => {
      if (next?.structured) {
        toast.show('已重新结构化');
      }
    });
  }

  function distill() {
    const structured = job?.structured;
    if (!structured) {
      return;
    }
    void run('正在提炼重点…', async (current) => ({
      ...current,
      structured,
      jdDigest: await runDistillJd(structured),
    })).then((next) => {
      if (next?.jdDigest) {
        toast.show('已提炼重点');
      }
    });
  }

  if (!job?.structured) {
    return null;
  }

  const digest = job.jdDigest;

  return (
    <SafeAreaView style={styles.safe} edges={['bottom']}>
      <BusyOverlay visible={Boolean(busy)} message={busy} />
      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
          <Text style={styles.hint}>
            下面是从岗位原文拆出的字段。点「提炼精简」会压成「需要什么样的人才 / 岗位需要做什么 /
            公司能提供什么」，只根据已有内容，不编造。
          </Text>
          <View style={styles.card}>
            <Text style={styles.cardTitle}>字段拆解</Text>
            <JobFields
              value={editing ? draft : job.structured}
              editing={editing}
              onChange={setDraft}
            />
          </View>
          <Button variant="ghost" label="重新结构化" disabled={editing} onPress={restructure} />
          <Button label="提炼精简" disabled={editing} onPress={distill} />
          {digest ? (
            <View style={styles.digest}>
              {JD_DIGEST_FIELDS.map(({ key, label }) => (
                <View key={key} style={styles.card}>
                  <Text style={styles.cardTitle}>{label}</Text>
                  <Text style={[styles.body, !digest[key].trim() && styles.empty]}>
                    {digest[key].trim() || '岗位信息里没有写到'}
                  </Text>
                </View>
              ))}
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
  content: { padding: space.lg, gap: space.md, paddingBottom: 48 },
  hint: { color: colors.muted, fontSize: 13, lineHeight: 18 },
  card: {
    backgroundColor: colors.paper,
    borderRadius: radius.md,
    padding: space.md,
    gap: 8,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.line,
  },
  cardTitle: { fontWeight: '700', color: colors.ink, fontSize: 15 },
  body: { color: colors.ink, fontSize: 15, lineHeight: 22 },
  empty: { color: colors.faint },
  digest: { gap: space.md },
  edit: { color: colors.accent, fontWeight: '700' },
});
