import { Ionicons } from '@expo/vector-icons';
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
import { generateInterview, interviewStatus } from '../edit/interview';
import type { RootStackParamList } from '../navigation/types';
import { listResumes, loadJob, saveJob } from '../storage';
import { colors, radius, space } from '../theme';
import { jobListTitle, jobMetaLine, resumeLabel, type Job, type Resume } from '../types';
import { BusyOverlay } from '../ui/BusyOverlay';
import { Button } from '../ui/Button';
import { CenterSheet } from '../ui/CenterSheet';
import { Field } from '../ui/Fields';
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
  const [resumes, setResumes] = useState<Resume[]>([]);
  const [busy, setBusy] = useState('');
  const [editing, setEditing] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [draftJd, setDraftJd] = useState('');
  const [sheetOpen, setSheetOpen] = useState(false);
  const [resumeOpen, setResumeOpen] = useState(false);
  const [resumeId, setResumeId] = useState('');
  const [count, setCount] = useState('5');
  const [focus, setFocus] = useState('');

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
      const loaded = loadJob(user.hashid, jobId);
      if (!loaded) {
        Alert.alert('岗位已不存在', '', [{ text: '好', onPress: () => navigation.goBack() }]);
        return;
      }
      setJob(loaded);
      setResumes(listResumes(user.hashid));
    }, [user, jobId, editing, navigation]),
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

  function openGenerate() {
    requireStructured('还不能面试', () => {
      setResumeId('');
      setCount('5');
      setFocus('');
      setResumeOpen(false);
      setSheetOpen(true);
    });
  }

  async function confirmGenerate() {
    if (!user || !job) {
      return;
    }
    setSheetOpen(false);
    setBusy('正在生成面试与语音…');
    try {
      await generateInterview(
        user.hashid,
        job.id,
        { resumeId, count: Number(count), focus },
        setJob,
      );
    } catch (e) {
      Alert.alert('没生成', e instanceof Error ? e.message : '请稍后重试');
    } finally {
      setBusy('');
    }
  }

  if (!job || !user) {
    return null;
  }

  const title = jobListTitle(job);
  const meta = jobMetaLine(job) || '还没有结构化';
  const status = interviewStatus(job);
  const selectedResume = resumes.find((item) => item.id === resumeId);

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
            onPress: () =>
              requireStructured('还不能匹配', () => navigation.navigate('ProjectMatch', { jobId: job.id })),
          },
        ]}
      />
      <CenterSheet visible={sheetOpen} onClose={() => setSheetOpen(false)}>
        <Text style={styles.sheetTitle}>生成面试</Text>
        <Text style={styles.label}>简历</Text>
        <Pressable
          onPress={() => setResumeOpen((open) => !open)}
          style={styles.select}
        >
          <Text style={styles.selectText}>{selectedResume ? resumeLabel(selectedResume) : '不选'}</Text>
          <Ionicons name={resumeOpen ? 'chevron-up' : 'chevron-down'} size={16} color={colors.muted} />
        </Pressable>
        {resumeOpen ? (
          <ScrollView style={styles.resumeList} keyboardShouldPersistTaps="handled">
            <Pressable
              onPress={() => {
                setResumeId('');
                setResumeOpen(false);
              }}
              style={[styles.resumeRow, !resumeId && styles.resumeActive]}
            >
              <Text style={styles.resumeLabel}>不选</Text>
            </Pressable>
            {resumes.map((item) => (
              <Pressable
                key={item.id}
                onPress={() => {
                  setResumeId(item.id);
                  setResumeOpen(false);
                }}
                style={[styles.resumeRow, resumeId === item.id && styles.resumeActive]}
              >
                <Text style={styles.resumeLabel}>{resumeLabel(item)}</Text>
              </Pressable>
            ))}
          </ScrollView>
        ) : null}
        <Field
          label="问题个数"
          value={count}
          onChangeText={setCount}
          keyboardType="number-pad"
          placeholder="5"
        />
        <Field
          label="问题倾向"
          value={focus}
          onChangeText={setFocus}
          placeholder="可空，例如深挖项目落地"
        />
        <Button label="确认生成" onPress={() => void confirmGenerate()} />
      </CenterSheet>
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
        {status === 'active' ? (
          <View style={styles.row}>
            <Button
              label="进入面试"
              style={styles.half}
              disabled={editing}
              onPress={() => navigation.navigate('InterviewSession', { jobId: job.id })}
            />
            <Button
              variant="ghost"
              label="结束面试"
              style={styles.half}
              disabled={editing}
              onPress={() => navigation.navigate('InterviewSave', { jobId: job.id })}
            />
          </View>
        ) : (
          <Button
            label={status === 'generating' ? '生成中' : '生成面试'}
            disabled={editing || status === 'generating'}
            onPress={openGenerate}
          />
        )}
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
  row: { flexDirection: 'row', gap: space.sm },
  half: { flex: 1 },
  done: { color: colors.accent, fontWeight: '700' },
  sheetTitle: { fontSize: 17, fontWeight: '700', color: colors.ink },
  label: { fontSize: 13, color: colors.muted, fontWeight: '600' },
  select: {
    backgroundColor: colors.paper,
    borderRadius: radius.sm,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.line,
    paddingHorizontal: space.md,
    paddingVertical: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  selectText: { fontSize: 16, color: colors.ink },
  resumeList: { maxHeight: 180 },
  resumeRow: {
    paddingVertical: 10,
    paddingHorizontal: space.sm,
    borderRadius: radius.sm,
  },
  resumeActive: { backgroundColor: colors.accentSoft },
  resumeLabel: { fontSize: 16, color: colors.ink, fontWeight: '600' },
});
