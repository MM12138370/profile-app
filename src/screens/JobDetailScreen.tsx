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
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { runAnalyzeJob } from '../ai';
import { useAuth } from '../auth/AuthContext';
import type { RootStackParamList } from '../navigation/types';
import { deleteJob, loadJob, saveJob } from '../storage';
import { colors, radius, space } from '../theme';
import { jobListTitle, jobMetaLine, type Job } from '../types';
import { BusyOverlay } from '../ui/BusyOverlay';
import { Button } from '../ui/Button';
import { useToast } from '../ui/Toast';

type Nav = NativeStackNavigationProp<RootStackParamList, 'JobDetail'>;
type R = RouteProp<RootStackParamList, 'JobDetail'>;

export function JobDetailScreen() {
  const { user } = useAuth();
  const toast = useToast();
  const navigation = useNavigation<Nav>();
  const { jobId } = useRoute<R>().params;
  const [job, setJob] = useState<Job | null>(null);
  const [busy, setBusy] = useState('');
  const [editing, setEditing] = useState(false);
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
      if (!user) {
        return;
      }
      if (!editing) {
        setJob(loadJob(user.hashid, jobId));
      }
    }, [user, jobId, editing]),
  );

  useLayoutEffect(() => {
    navigation.setOptions({
      headerRight: () =>
        job ? (
          <View style={styles.headerActions}>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={editing ? '完成' : '修改'}
              hitSlop={8}
              disabled={Boolean(busy)}
              onPress={() => (editing ? saveEdit() : startEdit())}
            >
              <Text style={styles.edit}>{editing ? '完成' : '修改'}</Text>
            </Pressable>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="删除"
              hitSlop={8}
              onPress={() => {
                Alert.alert('删除岗位', '该岗位的 JD、项目匹配和面试记录都会从本地删掉。', [
                  { text: '取消', style: 'cancel' },
                  {
                    text: '删除',
                    style: 'destructive',
                    onPress: () => {
                      if (user) {
                        deleteJob(user.hashid, jobId);
                        toast.show('删除成功');
                        navigation.goBack();
                      }
                    },
                  },
                ]);
              }}
            >
              <Text style={styles.delete}>删除</Text>
            </Pressable>
          </View>
        ) : null,
    });
  }, [busy, editing, job, jobId, navigation, saveEdit, startEdit, toast, user]);

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

  if (!job || !user) {
    return null;
  }

  const title = jobListTitle(job);
  const meta = jobMetaLine(job) || '还没有结构化';

  return (
    <SafeAreaView style={styles.safe} edges={['bottom']}>
      <BusyOverlay visible={Boolean(busy)} message={busy} />
      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
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

          <Text style={styles.section}>三项能力</Text>
          <Text style={styles.hint}>
            三项可分开点。结构化结果在独立页查看；面试问答会另开页面，用语音作答，结束后再决定是否写入面试助手；辅助项目匹配请填写你真实跟进过的项目。
          </Text>
          <View style={styles.actions}>
            <Button
              label={job.structured ? '查看结构化结果' : 'JD 结构化'}
              disabled={editing}
              onPress={() => void openStructured()}
            />
            <Button
              variant="ghost"
              label="面试问答"
              disabled={editing || !job.structured}
              onPress={() => navigation.navigate('InterviewSession', { jobId: job.id })}
            />
            <Button
              variant="ghost"
              label="辅助项目匹配"
              disabled={editing || !job.structured}
              onPress={() => navigation.navigate('ProjectMatch', { jobId: job.id })}
            />
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.bg },
  flex: { flex: 1 },
  content: { padding: space.lg, gap: space.md, paddingBottom: 56 },
  headerActions: { flexDirection: 'row', alignItems: 'center', gap: 16 },
  title: { fontSize: 28, fontWeight: '800', color: colors.ink },
  meta: { color: colors.muted, fontSize: 14 },
  section: { marginTop: 8, fontSize: 18, fontWeight: '700', color: colors.ink },
  hint: { color: colors.muted, fontSize: 13, lineHeight: 18 },
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
  actions: { gap: space.sm },
  edit: { color: colors.accent, fontWeight: '700' },
  delete: { color: colors.danger, fontWeight: '600' },
});
