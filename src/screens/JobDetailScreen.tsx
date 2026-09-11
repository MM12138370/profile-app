import { useNavigation, useRoute, type RouteProp } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useCallback, useEffect, useLayoutEffect, useState } from 'react';
import { Alert, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { runGenerateProjects, runGenerateQa, runParseJd } from '../ai';
import { useAuth } from '../auth/AuthContext';
import type { RootStackParamList } from '../navigation/types';
import { deleteJob, loadJob, loadProfile, saveJob, saveProfile } from '../storage';
import { colors, radius, space } from '../theme';
import type { Job, QAItem } from '../types';
import { Button } from '../ui/Button';
import { BusyOverlay } from '../ui/BusyOverlay';
import { EmptyState } from '../ui/EmptyState';
import { SectionTree } from '../ui/SectionTree';

type Nav = NativeStackNavigationProp<RootStackParamList, 'JobDetail'>;
type R = RouteProp<RootStackParamList, 'JobDetail'>;

export function JobDetailScreen() {
  const { user } = useAuth();
  const navigation = useNavigation<Nav>();
  const { jobId } = useRoute<R>().params;
  const [job, setJob] = useState<Job | null>(null);
  const [busy, setBusy] = useState('');

  const persist = useCallback(
    (next: Job) => {
      if (!user) {
        return;
      }
      setJob(saveJob(user.hashid, next));
    },
    [user],
  );

  useEffect(() => {
    if (user) {
      setJob(loadJob(user.hashid, jobId));
    }
  }, [user, jobId]);

  useLayoutEffect(() => {
    navigation.setOptions({
      headerRight: () => (
        <Pressable
          onPress={() => {
            Alert.alert('删除岗位', '该岗位的 JD、问答和面试记录都会从本地删掉。', [
              { text: '取消', style: 'cancel' },
              {
                text: '删除',
                style: 'destructive',
                onPress: () => {
                  if (user) {
                    deleteJob(user.hashid, jobId);
                    navigation.goBack();
                  }
                },
              },
            ]);
          }}
        >
          <Text style={styles.delete}>删除</Text>
        </Pressable>
      ),
    });
  }, [navigation, user, jobId]);

  async function run(label: string, work: (current: Job) => Promise<Job>) {
    if (!job || !user) {
      return;
    }
    setBusy(label);
    try {
      const next = await work(job);
      persist(next);
    } catch (e) {
      Alert.alert('没做完', e instanceof Error ? e.message : '请稍后重试');
    } finally {
      setBusy('');
    }
  }

  if (!job || !user) {
    return null;
  }

  const structured = job.structured;

  return (
    <SafeAreaView style={styles.safe} edges={['bottom']}>
      <BusyOverlay visible={Boolean(busy)} message={busy} />
      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        <Text style={styles.title}>{structured?.jobTitle || '新岗位'}</Text>
        <Text style={styles.meta}>
          {[structured?.location, structured?.yearsRequired].filter(Boolean).join(' · ') || '还没有结构化'}
        </Text>

        <Text style={styles.section}>原始 JD</Text>
        <Text style={styles.body}>{job.rawJD}</Text>

        <Text style={styles.section}>三项能力</Text>
        <Text style={styles.hint}>问答和相关项目都基于结构化结果生成，可以分开点。</Text>
        <View style={styles.actions}>
          <Button
            label="JD 结构化"
            onPress={() =>
              void run('正在结构化 JD…', async (current) => ({
                ...current,
                structured: await runParseJd(current.rawJD),
              }))
            }
          />
          <Button
            variant="ghost"
            label="生成面试问答"
            disabled={!structured}
            onPress={() =>
              void run('正在生成面试问答…', async (current) => ({
                ...current,
                interviewQA: await runGenerateQa(current.structured!, loadProfile(user.hashid)),
              }))
            }
          />
          <Button
            variant="ghost"
            label="生成相关项目"
            disabled={!structured}
            onPress={() =>
              void run('正在生成相关项目…', async (current) => ({
                ...current,
                relatedProjects: await runGenerateProjects(
                  current.structured!,
                  loadProfile(user.hashid),
                ),
              }))
            }
          />
        </View>

        {structured ? (
          <View style={styles.card}>
            <Text style={styles.cardTitle}>结构化结果</Text>
            <Text style={styles.body}>{structured.jobDescription}</Text>
          </View>
        ) : null}

        <Text style={styles.section}>面试问答</Text>
        {job.interviewQA.length === 0 ? (
          <EmptyState title="还没有问答" hint="先结构化 JD，再生成。生成后可以改问题和答案。" />
        ) : (
          job.interviewQA.map((item, index) => (
            <QAEditor
              key={`${index}-${item.question.slice(0, 12)}`}
              item={item}
              index={index}
              onChange={(next) => {
                const interviewQA = job.interviewQA.map((qa, i) => (i === index ? next : qa));
                persist({ ...job, interviewQA });
              }}
              onDelete={() =>
                persist({
                  ...job,
                  interviewQA: job.interviewQA.filter((_, i) => i !== index),
                })
              }
            />
          ))
        )}
        <Button
          variant="ghost"
          label="手动加一条"
          onPress={() =>
            persist({
              ...job,
              interviewQA: [...job.interviewQA, { question: '', answer: '' }],
            })
          }
        />

        <Text style={styles.section}>相关项目</Text>
        <Text style={styles.hint}>结构与简历板块相同，审过之后可以插入简历。</Text>
        {job.relatedProjects.length === 0 ? (
          <EmptyState title="还没有相关项目" hint="会严格按简历已有经历整理，不会编造新项目。" />
        ) : (
          <>
            <SectionTree
              nodes={job.relatedProjects}
              onChange={(relatedProjects) => persist({ ...job, relatedProjects })}
            />
            <Button
              label="插入简历"
              onPress={() => {
                Alert.alert('插入简历', '这些板块会追加到当前简历末尾。', [
                  { text: '取消', style: 'cancel' },
                  {
                    text: '插入',
                    onPress: () => {
                      const profile = loadProfile(user.hashid);
                      saveProfile(user.hashid, {
                        ...profile,
                        sections: [...profile.sections, ...job.relatedProjects],
                      });
                      Alert.alert('已写入简历');
                    },
                  },
                ]);
              }}
            />
          </>
        )}

        {job.interviewResult?.score !== undefined ? (
          <View style={styles.result}>
            <Text style={styles.cardTitle}>最近一次面试</Text>
            <Text style={styles.score}>
              {job.interviewResult.score} 分 · 匹配度 {job.interviewResult.matchScore}/10
            </Text>
            <Text style={styles.body}>{job.interviewResult.optimizationPoints}</Text>
            <Button
              variant="ghost"
              label="再面一次"
              onPress={() => navigation.navigate('InterviewSession', { jobId: job.id })}
            />
          </View>
        ) : (
          <Button
            variant="ghost"
            label="去模拟面试"
            disabled={!structured}
            onPress={() => navigation.navigate('InterviewSession', { jobId: job.id })}
          />
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

function QAEditor({
  item,
  index,
  onChange,
  onDelete,
}: {
  item: QAItem;
  index: number;
  onChange: (item: QAItem) => void;
  onDelete: () => void;
}) {
  return (
    <View style={styles.card}>
      <View style={styles.qaHead}>
        <Text style={styles.cardTitle}>Q{index + 1}</Text>
        <Pressable onPress={onDelete}>
          <Text style={styles.delete}>删除</Text>
        </Pressable>
      </View>
      <TextInput
        value={item.question}
        onChangeText={(question) => onChange({ ...item, question })}
        placeholder="问题"
        placeholderTextColor={colors.faint}
        style={styles.input}
        multiline
      />
      <TextInput
        value={item.answer}
        onChangeText={(answer) => onChange({ ...item, answer })}
        placeholder="参考答案"
        placeholderTextColor={colors.faint}
        style={styles.input}
        multiline
      />
    </View>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.bg },
  content: { padding: space.lg, gap: space.md, paddingBottom: 56 },
  title: { fontSize: 28, fontWeight: '800', color: colors.ink },
  meta: { color: colors.muted, fontSize: 14 },
  section: { marginTop: 8, fontSize: 18, fontWeight: '700', color: colors.ink },
  hint: { color: colors.muted, fontSize: 13, lineHeight: 18 },
  body: { color: colors.ink, fontSize: 15, lineHeight: 22 },
  actions: { gap: space.sm },
  card: {
    backgroundColor: colors.paper,
    borderRadius: radius.md,
    padding: space.md,
    gap: 8,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.line,
  },
  cardTitle: { fontWeight: '700', color: colors.ink, fontSize: 15 },
  qaHead: { flexDirection: 'row', justifyContent: 'space-between' },
  input: {
    fontSize: 15,
    color: colors.ink,
    minHeight: 44,
    textAlignVertical: 'top',
  },
  delete: { color: colors.danger, fontWeight: '600' },
  result: {
    backgroundColor: colors.goodSoft,
    borderRadius: radius.md,
    padding: space.md,
    gap: 8,
  },
  score: { fontSize: 20, fontWeight: '800', color: colors.good },
});
