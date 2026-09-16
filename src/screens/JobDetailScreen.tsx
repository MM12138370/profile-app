import { useFocusEffect, useNavigation, useRoute, type RouteProp } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useCallback, useLayoutEffect, useState } from 'react';
import {
  Alert,
  KeyboardAvoidingView,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { runAnalyzeJob } from '../ai';
import { useAuth } from '../auth/AuthContext';
import type { RootStackParamList } from '../navigation/types';
import { loadJob, saveJob } from '../storage';
import { colors, radius, space } from '../theme';
import { jobListTitle, jobMetaLine, type Job } from '../types';
import { BusyOverlay } from '../ui/BusyOverlay';
import { Button } from '../ui/Button';
import { HeaderMoreButton, OverflowMenu } from '../ui/OverflowMenu';
import { useToast } from '../ui/Toast';

type Nav = NativeStackNavigationProp<RootStackParamList, 'JobDetail'>;
type R = RouteProp<RootStackParamList, 'JobDetail'>;

export function JobDetailScreen() {
  const { user } = useAuth();
  const toast = useToast();
  const insets = useSafeAreaInsets();
  const navigation = useNavigation<Nav>();
  const { jobId } = useRoute<R>().params;
  const [job, setJob] = useState<Job | null>(null);
  const [busy, setBusy] = useState('');
  const [editing, setEditing] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [draftJd, setDraftJd] = useState('');

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

  const startEdit = useCallback(() => {
    if (!job) {
      return;
    }
    setDraftJd(job.rawJD);
    setEditing(true);
  }, [job]);

  const saveEdit = useCallback(() => {
    if (!job) {
      return;
    }
    const rawJD = draftJd.trim();
    if (rawJD !== job.rawJD) {
      persist({ ...job, rawJD });
      toast.show('保存成功');
    }
    setEditing(false);
  }, [draftJd, job, persist, toast]);

  useFocusEffect(
    useCallback(() => {
      if (!user || editing) {
        return;
      }
      setJob(loadJob(user.hashid, jobId));
    }, [user, jobId, editing]),
  );

  useLayoutEffect(() => {
    navigation.setOptions({
      headerRight: () =>
        !job ? null : editing ? (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="完成"
            hitSlop={8}
            disabled={Boolean(busy)}
            onPress={saveEdit}
          >
            <Text style={styles.done}>完成</Text>
          </Pressable>
        ) : (
          <HeaderMoreButton disabled={Boolean(busy)} onPress={() => setMenuOpen(true)} />
        ),
    });
  }, [busy, editing, job, navigation, saveEdit]);

  async function openStructured() {
    if (!job) {
      return;
    }
    if (job.structured) {
      navigation.navigate('JobStructured', { jobId: job.id });
      return;
    }
    setBusy('正在结构化 JD…');
    try {
      const next = persist({
        ...job,
        structured: await runAnalyzeJob({ text: job.rawJD }),
        jdDigest: null,
      });
      if (next.structured) {
        navigation.navigate('JobStructured', { jobId: next.id });
      }
    } catch (e) {
      Alert.alert('没做完', e instanceof Error ? e.message : '请稍后重试');
    } finally {
      setBusy('');
    }
  }

  function requireStructured(title: string, go: () => void) {
    if (!job?.structured) {
      Alert.alert(title, '请先查看结构化结果。');
      return;
    }
    go();
  }

  if (!job || !user) {
    return null;
  }

  const title = jobListTitle(job);
  const meta = jobMetaLine(job) || '还没有结构化';

  return (
    <View style={styles.safe}>
      <BusyOverlay visible={Boolean(busy)} message={busy} />
      <OverflowMenu
        visible={menuOpen}
        onClose={() => setMenuOpen(false)}
        items={[
          { label: '修改', onPress: startEdit },
          { label: '查看结构化结果', onPress: () => void openStructured() },
          {
            label: '辅助项目匹配',
            onPress: () => requireStructured('还不能匹配', () => navigation.navigate('ProjectMatch', { jobId: job.id })),
          },
        ]}
      />
      <KeyboardAvoidingView style={styles.flex} behavior="padding">
        <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
          <Text style={styles.title}>{title}</Text>
          <Text style={styles.meta}>{meta}</Text>

          <Text style={styles.section}>原始 JD</Text>
          {editing ? (
            <TextInput
              value={draftJd}
              onChangeText={setDraftJd}
              placeholder="把岗位相关内容贴在这里"
              placeholderTextColor={colors.faint}
              multiline
              style={styles.jdInput}
            />
          ) : (
            <Text style={styles.body}>{job.rawJD}</Text>
          )}
        </ScrollView>
      </KeyboardAvoidingView>
      <View style={[styles.bar, { paddingBottom: Math.max(insets.bottom, space.sm) }]}>
        <Button
          label="面试问答"
          disabled={editing}
          onPress={() =>
            requireStructured('还不能面试', () => navigation.navigate('InterviewSession', { jobId: job.id }))
          }
        />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.bg },
  flex: { flex: 1 },
  content: { padding: space.lg, gap: space.md },
  title: { fontSize: 28, fontWeight: '800', color: colors.ink },
  meta: { color: colors.muted, fontSize: 14 },
  section: { marginTop: 8, fontSize: 18, fontWeight: '700', color: colors.ink },
  body: { color: colors.ink, fontSize: 15, lineHeight: 22 },
  jdInput: {
    backgroundColor: colors.paper,
    borderRadius: radius.sm,
    paddingHorizontal: space.md,
    paddingVertical: 12,
    minHeight: 160,
    fontSize: 16,
    color: colors.ink,
    textAlignVertical: 'top',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.line,
  },
  bar: {
    backgroundColor: colors.paper,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.line,
    paddingHorizontal: space.lg,
    paddingTop: space.sm,
  },
  done: { color: colors.accent, fontWeight: '700' },
});
