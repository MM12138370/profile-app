import { useFocusEffect, useNavigation, useRoute, type RouteProp } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useCallback, useState } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { useAuth } from '../auth/AuthContext';
import type { RootStackParamList } from '../navigation/types';
import { loadJob } from '../storage';
import { colors, radius, space } from '../theme';
import { jobListTitle, type Job } from '../types';
import { Button } from '../ui/Button';
import { EmptyState } from '../ui/EmptyState';

type Nav = NativeStackNavigationProp<RootStackParamList, 'InterviewReview'>;
type R = RouteProp<RootStackParamList, 'InterviewReview'>;

export function InterviewReviewScreen() {
  const { user } = useAuth();
  const navigation = useNavigation<Nav>();
  const { jobId } = useRoute<R>().params;
  const [job, setJob] = useState<Job | null>(null);

  useFocusEffect(
    useCallback(() => {
      if (user) {
        setJob(loadJob(user.hashid, jobId));
      }
    }, [jobId, user]),
  );

  const result = job?.interviewResult;
  if (!job) {
    return null;
  }

  return (
    <SafeAreaView style={styles.safe} edges={['bottom']}>
      <ScrollView contentContainerStyle={styles.content}>
        <Text style={styles.title}>{jobListTitle(job)}</Text>
        {result?.score !== undefined ? <Text style={styles.score}>{result.score} 分</Text> : null}
        {result?.matchScore !== undefined ? (
          <Text style={styles.match}>对该岗位匹配度 {result.matchScore} / 10</Text>
        ) : null}
        {result?.optimizationPoints ? <Text style={styles.points}>{result.optimizationPoints}</Text> : null}

        <Text style={styles.section}>问答记录</Text>
        {!result?.questions.length ? (
          <EmptyState title="没有保存的问答" hint="去岗位页重新开始面试问答。" />
        ) : (
          result.questions.map((question, index) => (
            <View key={`${index}-${question.slice(0, 12)}`} style={styles.card}>
              <Text style={styles.qLabel}>Q{index + 1}</Text>
              <Text style={styles.question}>{question}</Text>
              <Text style={styles.aLabel}>我的回答</Text>
              <Text style={styles.answer}>{result.userAnswers[index]?.trim() || '（未作答）'}</Text>
            </View>
          ))
        )}
        <Button
          label="再面一次"
          onPress={() => navigation.replace('InterviewSession', { jobId: job.id })}
        />
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.bg },
  content: { padding: space.lg, gap: space.md, paddingBottom: 56 },
  title: { fontSize: 24, fontWeight: '800', color: colors.ink },
  score: { fontSize: 40, fontWeight: '800', color: colors.ink },
  match: { fontSize: 16, color: colors.good, fontWeight: '700' },
  points: { fontSize: 15, lineHeight: 22, color: colors.ink },
  section: { marginTop: 8, fontSize: 18, fontWeight: '700', color: colors.ink },
  card: {
    backgroundColor: colors.paper,
    borderRadius: radius.md,
    padding: space.md,
    gap: 8,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.line,
  },
  qLabel: { fontWeight: '700', color: colors.accent, fontSize: 13 },
  question: { fontSize: 16, lineHeight: 22, color: colors.ink, fontWeight: '600' },
  aLabel: { fontWeight: '700', color: colors.muted, fontSize: 13, marginTop: 4 },
  answer: { fontSize: 15, lineHeight: 22, color: colors.ink },
});
