import { useNavigation, useRoute, type RouteProp } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import {
  Alert,
  FlatList,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { runReview } from '../ai';
import { useAuth } from '../auth/AuthContext';
import type { RootStackParamList } from '../navigation/types';
import { loadJob, loadProfileForJob, saveJob } from '../storage';
import { colors, radius, space } from '../theme';
import { referenceAnswer, type InterviewResult, type Job, type QAItem } from '../types';
import { BusyOverlay } from '../ui/BusyOverlay';
import { Button } from '../ui/Button';

type Nav = NativeStackNavigationProp<RootStackParamList, 'InterviewSession'>;
type R = RouteProp<RootStackParamList, 'InterviewSession'>;

type Bubble = {
  id: string;
  role: 'interviewer' | 'user';
  text: string;
};

type Turn = {
  question: string;
  userAnswer: string;
  standardAnswer: string;
};

export function InterviewSessionScreen() {
  const { user } = useAuth();
  const navigation = useNavigation<Nav>();
  const { jobId } = useRoute<R>().params;
  const [job, setJob] = useState<Job | null>(null);
  const [bubbles, setBubbles] = useState<Bubble[]>([]);
  const [draft, setDraft] = useState('');
  const [busy, setBusy] = useState('');
  const [result, setResult] = useState<InterviewResult | null>(null);
  const [finishedAsking, setFinishedAsking] = useState(false);
  const history = useRef<Turn[]>([]);
  const itemsRef = useRef<QAItem[]>([]);
  const indexRef = useRef(0);
  const started = useRef(false);
  const reviewing = useRef(false);
  const listRef = useRef<FlatList<Bubble>>(null);

  const finish = useCallback(async () => {
    if (!user || !job?.structured || reviewing.current) {
      return;
    }
    if (history.current.length === 0) {
      Alert.alert('至少回答一题再结束');
      return;
    }
    reviewing.current = true;
    setBusy('正在复盘面试…');
    try {
      const questions = history.current.map((turn) => turn.question);
      const standardAnswers = history.current.map((turn) => turn.standardAnswer);
      const userAnswers = history.current.map((turn) => turn.userAnswer);
      const review = await runReview({
        jd: job.structured,
        profile: loadProfileForJob(user.hashid, job),
        questions,
        standardAnswers,
        userAnswers,
      });
      const interviewResult: InterviewResult = {
        questions,
        standardAnswers,
        userAnswers,
        ...review,
      };
      saveJob(user.hashid, { ...job, interviewResult });
      setResult(interviewResult);
    } catch (e) {
      reviewing.current = false;
      Alert.alert('复盘失败', e instanceof Error ? e.message : '请稍后重试');
    } finally {
      setBusy('');
    }
  }, [user, job]);

  useEffect(() => {
    if (!user || started.current) {
      return;
    }
    const loaded = loadJob(user.hashid, jobId);
    setJob(loaded);
    if (!loaded.structured) {
      Alert.alert('还不能面试', '请先对该岗位做 JD 结构化。', [
        { text: '好', onPress: () => navigation.goBack() },
      ]);
      return;
    }
    const items = loaded.interviewQA.filter((item) => item.question.trim());
    if (items.length === 0) {
      Alert.alert('还没有面试问答', '请先在岗位里生成或手写问题，面试助手会沿用同一批题。', [
        { text: '好', onPress: () => navigation.goBack() },
      ]);
      return;
    }
    started.current = true;
    itemsRef.current = items;
    indexRef.current = 0;
    setBubbles([{ id: 'q-0', role: 'interviewer', text: items[0].question }]);
  }, [user, jobId, navigation]);

  useLayoutEffect(() => {
    navigation.setOptions({
      headerRight: () =>
        result ? null : (
          <Pressable onPress={() => void finish()}>
            <Text style={styles.end}>结束面试</Text>
          </Pressable>
        ),
    });
  }, [navigation, finish, result]);

  function send() {
    const text = draft.trim();
    const items = itemsRef.current;
    const index = indexRef.current;
    const current = items[index];
    if (!text || !current || !job || finishedAsking) {
      return;
    }
    setDraft('');
    setBubbles((prev) => [...prev, { id: `a-${index}`, role: 'user', text }]);
    history.current = [
      ...history.current,
      {
        question: current.question,
        userAnswer: text,
        standardAnswer: referenceAnswer(current),
      },
    ];
    if (index + 1 >= items.length) {
      setFinishedAsking(true);
      void finish();
      return;
    }
    indexRef.current = index + 1;
    const next = items[index + 1];
    setBubbles((prev) => [...prev, { id: `q-${index + 1}`, role: 'interviewer', text: next.question }]);
  }

  if (result) {
    return (
      <SafeAreaView style={styles.safe} edges={['bottom']}>
        <View style={styles.review}>
          <Text style={styles.kicker}>面试复盘</Text>
          <Text style={styles.score}>{result.score} 分</Text>
          <Text style={styles.match}>对该岗位匹配度 {result.matchScore} / 10</Text>
          <Text style={styles.points}>{result.optimizationPoints}</Text>
          <Button label="返回" onPress={() => navigation.goBack()} />
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safe} edges={['bottom']}>
      <BusyOverlay visible={Boolean(busy)} message={busy} />
      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        keyboardVerticalOffset={88}
      >
        <FlatList
          ref={listRef}
          data={bubbles}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.list}
          onContentSizeChange={() => listRef.current?.scrollToEnd({ animated: true })}
          renderItem={({ item }) => (
            <View style={[styles.bubble, item.role === 'user' ? styles.user : styles.bot]}>
              <Text style={[styles.bubbleText, item.role === 'user' && styles.userText]}>{item.text}</Text>
            </View>
          )}
        />
        {finishedAsking ? null : (
          <View style={styles.composer}>
            <TextInput
              value={draft}
              onChangeText={setDraft}
              placeholder="说出你的回答"
              placeholderTextColor={colors.faint}
              style={styles.input}
              multiline
            />
            <Pressable style={styles.send} onPress={send}>
              <Text style={styles.sendText}>发送</Text>
            </Pressable>
          </View>
        )}
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.bg },
  flex: { flex: 1 },
  list: { padding: space.lg, gap: space.sm, paddingBottom: 24 },
  bubble: {
    maxWidth: '86%',
    borderRadius: radius.md,
    padding: space.md,
  },
  bot: {
    alignSelf: 'flex-start',
    backgroundColor: colors.interviewer,
  },
  user: {
    alignSelf: 'flex-end',
    backgroundColor: colors.accent,
  },
  bubbleText: {
    fontSize: 16,
    lineHeight: 22,
    color: colors.ink,
  },
  userText: { color: '#fff' },
  composer: {
    flexDirection: 'row',
    gap: space.sm,
    padding: space.md,
    alignItems: 'flex-end',
    backgroundColor: colors.paper,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.line,
  },
  input: {
    flex: 1,
    minHeight: 40,
    maxHeight: 120,
    fontSize: 16,
    color: colors.ink,
  },
  send: {
    backgroundColor: colors.accent,
    borderRadius: radius.pill,
    paddingHorizontal: 16,
    paddingVertical: 10,
  },
  sendText: { color: '#fff', fontWeight: '700' },
  end: { color: colors.accent, fontWeight: '700' },
  review: { flex: 1, padding: space.lg, gap: space.md, justifyContent: 'center' },
  kicker: { color: colors.accent, fontWeight: '700' },
  score: { fontSize: 48, fontWeight: '800', color: colors.ink },
  match: { fontSize: 18, color: colors.good, fontWeight: '700' },
  points: { fontSize: 16, lineHeight: 24, color: colors.ink },
});
