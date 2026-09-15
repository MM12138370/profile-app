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

import { QA_QUESTION_COUNT, runAnalyzeJob, runGenerateQa, runPolishQa } from '../ai';
import { useAuth } from '../auth/AuthContext';
import type { RootStackParamList } from '../navigation/types';
import { deleteJob, listJobs, listResumes, loadComposedProfile, loadJob, saveJob } from '../storage';
import { colors, radius, space } from '../theme';
import {
  collectReusableQuestions,
  emptyQAItem,
  jobListTitle,
  jobMetaLine,
  mergeGeneratedQuestions,
  polishableQA,
  qaQuestionKey,
  questionsAnswered,
  type Job,
  type QAItem,
  type Resume,
} from '../types';
import { BusyOverlay } from '../ui/BusyOverlay';
import { Button } from '../ui/Button';
import { EmptyState } from '../ui/EmptyState';
import { QACard } from '../ui/QACard';
import { QuestionPicker } from '../ui/QuestionPicker';
import { ResumePicker } from '../ui/ResumePicker';
import { useToast } from '../ui/Toast';

type Nav = NativeStackNavigationProp<RootStackParamList, 'JobDetail'>;
type R = RouteProp<RootStackParamList, 'JobDetail'>;

export function JobDetailScreen() {
  const { user } = useAuth();
  const toast = useToast();
  const navigation = useNavigation<Nav>();
  const { jobId } = useRoute<R>().params;
  const [job, setJob] = useState<Job | null>(null);
  const [resumes, setResumes] = useState<Resume[]>([]);
  const [reusable, setReusable] = useState<{ jobTitle: string; question: string }[]>([]);
  const [busy, setBusy] = useState('');
  const [editing, setEditing] = useState(false);
  const [draftJd, setDraftJd] = useState('');
  const [pickingResume, setPickingResume] = useState(false);
  const [pickingQuestions, setPickingQuestions] = useState(false);
  const [focusQAId, setFocusQAId] = useState<string | null>(null);

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
      setResumes(listResumes(user.hashid));
      setReusable(collectReusableQuestions(listJobs(user.hashid), jobId));
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
                Alert.alert('删除岗位', '该岗位的 JD、问答和面试记录都会从本地删掉。', [
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

  async function run(label: string, work: (current: Job) => Promise<Job>): Promise<Job | null> {
    if (!job || !user) {
      return null;
    }
    setBusy(label);
    try {
      return persist(await work(job));
    } catch (e) {
      Alert.alert('没做完', e instanceof Error ? e.message : '请稍后重试');
      return null;
    } finally {
      setBusy('');
    }
  }

  function requireResumes(then: () => void) {
    if (resumes.length === 0) {
      Alert.alert('还没有简历', '请先在简历中心创建一份子简历。', [
        { text: '取消', style: 'cancel' },
        { text: '去创建', onPress: () => navigation.navigate('Profile', {}) },
      ]);
      return;
    }
    then();
  }

  function generateQa(resume: Resume) {
    if (!user) {
      return;
    }
    const hashid = user.hashid;
    void run('正在生成面试问答…', async (current) => {
      const profile = loadComposedProfile(hashid, resume.id);
      const manuals = current.interviewQA
        .filter((item) => item.source === 'manual' && item.question.trim())
        .map((item) => item.question);
      const aiCount = Math.max(0, QA_QUESTION_COUNT - manuals.length);
      const questions =
        aiCount > 0 ? await runGenerateQa(current.structured!, profile, manuals, aiCount) : [];
      return {
        ...current,
        resumeId: resume.id,
        interviewQA: mergeGeneratedQuestions(current.interviewQA, questions, QA_QUESTION_COUNT),
      };
    });
  }

  function addManual() {
    if (!job) {
      return;
    }
    const item = emptyQAItem();
    persist({
      ...job,
      interviewQA: [...job.interviewQA, item],
    });
    setFocusQAId(item.id);
  }

  function importQuestions(questions: string[]) {
    if (!job) {
      return;
    }
    const taken = new Set(job.interviewQA.map((item) => qaQuestionKey(item.question)).filter(Boolean));
    const extra = questions
      .map((question) => question.trim())
      .filter((question) => question && !taken.has(qaQuestionKey(question)))
      .map((question) => emptyQAItem({ question, source: 'manual' }));
    if (extra.length === 0) {
      toast.show('这些题已经在本岗位里了');
      setPickingQuestions(false);
      return;
    }
    persist({ ...job, interviewQA: [...job.interviewQA, ...extra] });
    toast.show(`已加入 ${extra.length} 题`);
    setPickingQuestions(false);
  }

  function updateQA(index: number, next: QAItem) {
    if (!job) {
      return;
    }
    persist({
      ...job,
      interviewQA: job.interviewQA.map((qa, i) => (i === index ? next : qa)),
    });
  }

  function removeQA(index: number) {
    if (!job) {
      return;
    }
    persist({
      ...job,
      interviewQA: job.interviewQA.filter((_, i) => i !== index),
    });
  }

  function polishAll() {
    if (!job?.structured) {
      return;
    }
    if (!questionsAnswered(job.interviewQA)) {
      Alert.alert('先答完', '请先把 AI 生成的题目都写上自己的回答，再一起润色。');
      return;
    }
    void run('正在润色回答…', async (current) => {
      const ready = polishableQA(current.interviewQA).filter((item) => item.answer.trim());
      const polished = await runPolishQa(
        current.structured!,
        ready.map((item) => ({ question: item.question, answer: item.answer })),
      );
      const byId = new Map(ready.map((item, index) => [item.id, polished[index]]));
      return {
        ...current,
        interviewQA: current.interviewQA.map((item) => {
          const next = byId.get(item.id);
          if (!next) {
            return item;
          }
          return {
            ...item,
            polishedAnswer: next.polishedAnswer,
            polishTips: next.polishTips,
          };
        }),
      };
    });
  }

  async function openStructured() {
    if (!job) {
      return;
    }
    if (job.structured) {
      navigation.navigate('JobStructured', { jobId: job.id });
      return;
    }
    const next = await run('正在结构化 JD…', async (current) => ({
      ...current,
      structured: await runAnalyzeJob({ text: current.rawJD }),
      jdDigest: null,
    }));
    if (next?.structured) {
      navigation.navigate('JobStructured', { jobId: next.id });
    }
  }

  if (!job || !user) {
    return null;
  }

  const title = jobListTitle(job);
  const meta = jobMetaLine(job) || '还没有结构化';
  const canPolish = questionsAnswered(job.interviewQA);

  return (
    <SafeAreaView style={styles.safe} edges={['bottom']}>
      <BusyOverlay visible={Boolean(busy)} message={busy} />
      <ResumePicker
        visible={pickingResume}
        resumes={resumes}
        selectedId={job.resumeId}
        title="选择简历"
        hint="面试问答会按这份简历出题，只用简历里有的事实。生成后请自己作答，再一键润色。"
        onClose={() => setPickingResume(false)}
        onSelect={(resume) => {
          setPickingResume(false);
          generateQa(resume);
        }}
      />
      <QuestionPicker
        visible={pickingQuestions}
        items={reusable}
        onClose={() => setPickingQuestions(false)}
        onConfirm={importQuestions}
      />
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
            三项可分开点。结构化结果在独立页查看，并可提炼重点；生成问答会穿插手写题；辅助项目匹配请填写你真实跟进过的项目。
          </Text>
          <View style={styles.actions}>
            <Button
              label={job.structured ? '查看结构化结果' : 'JD 结构化'}
              disabled={editing}
              onPress={() => void openStructured()}
            />
            <Button
              variant="ghost"
              label="生成面试问答"
              disabled={editing || !job.structured}
              onPress={() => requireResumes(() => setPickingResume(true))}
            />
            <Button
              variant="ghost"
              label="辅助项目匹配"
              disabled={editing || !job.structured}
              onPress={() => navigation.navigate('ProjectMatch', { jobId: job.id })}
            />
          </View>

          <Text style={styles.section}>面试问答</Text>
          <Text style={styles.hint}>
            每次生成固定 {QA_QUESTION_COUNT} 道题，一次性作答。手动加题只需写下问题，面试时再作答；也可从其他岗位选用已手写过的题。点「生成面试问答」时，手写题会占用名额并随机穿插进
            AI 题目里；AI 题可在这里作答并润色。
          </Text>
          {job.interviewQA.length === 0 ? (
            <EmptyState title="还没有问答" hint="先结构化 JD，再选择一份简历生成，或手动加题。" />
          ) : (
            job.interviewQA.map((item, index) => (
              <QACard
                key={item.id}
                item={item}
                index={index}
                autoFocus={item.id === focusQAId}
                onChange={(next) => updateQA(index, next)}
                onDelete={() => removeQA(index)}
              />
            ))
          )}
          <Button variant="ghost" label="手动加一条" onPress={addManual} />
          <Button variant="ghost" label="从其他岗位选用" onPress={() => setPickingQuestions(true)} />
          {polishableQA(job.interviewQA).length > 0 ? (
            <Button label="润色全部回答" disabled={!canPolish || editing} onPress={polishAll} />
          ) : null}

          {job.interviewResult?.score !== undefined ? (
            <View style={styles.result}>
              <Text style={styles.cardTitle}>最近一次面试</Text>
              <Text style={styles.score}>
                {job.interviewResult.score} 分 · 匹配度 {job.interviewResult.matchScore}/10
              </Text>
              <Text style={styles.body}>{job.interviewResult.optimizationPoints}</Text>
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
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.line,
    paddingHorizontal: space.md,
    paddingVertical: 12,
    minHeight: 160,
    fontSize: 16,
    color: colors.ink,
    textAlignVertical: 'top',
  },
  actions: { gap: space.sm },
  cardTitle: { fontWeight: '700', color: colors.ink, fontSize: 15 },
  edit: { color: colors.accent, fontWeight: '700' },
  delete: { color: colors.danger, fontWeight: '600' },
  result: {
    backgroundColor: colors.goodSoft,
    borderRadius: radius.md,
    padding: space.md,
    gap: 8,
  },
  score: { fontSize: 20, fontWeight: '800', color: colors.good },
});
