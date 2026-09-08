import { useFocusEffect, useNavigation } from '@react-navigation/native';
import type { CompositeNavigationProp } from '@react-navigation/native';
import type { BottomTabNavigationProp } from '@react-navigation/bottom-tabs';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useCallback, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { useAuth } from '../auth/AuthContext';
import type { MainTabParamList, RootStackParamList } from '../navigation/types';
import { listJobs } from '../storage';
import { colors, radius, space } from '../theme';
import type { Job } from '../types';
import { EmptyState } from '../ui/EmptyState';

type Nav = CompositeNavigationProp<
  BottomTabNavigationProp<MainTabParamList, 'InterviewTab'>,
  NativeStackNavigationProp<RootStackParamList>
>;

export function InterviewPickScreen() {
  const { user } = useAuth();
  const navigation = useNavigation<Nav>();
  const [jobs, setJobs] = useState<Job[]>([]);

  useFocusEffect(
    useCallback(() => {
      if (user) {
        setJobs(listJobs(user.hashid).filter((job) => job.structured));
      }
    }, [user]),
  );

  return (
    <SafeAreaView style={styles.safe} edges={['bottom']}>
      <ScrollView contentContainerStyle={styles.content}>
        <Text style={styles.title}>面试助手</Text>
        <Text style={styles.sub}>
          选一个已经结构化过的岗位，按真实简历模拟面试官。结束后会把问题、参考答案、你的回答交给复盘工作流。
        </Text>
        {jobs.length === 0 ? (
          <EmptyState title="还没有可面试的岗位" hint="先去求职中心粘贴 JD 并完成结构化。" />
        ) : (
          jobs.map((job) => (
            <Pressable
              key={job.id}
              style={styles.card}
              onPress={() => navigation.navigate('InterviewSession', { jobId: job.id })}
            >
              <Text style={styles.job}>{job.structured?.jobTitle}</Text>
              <Text style={styles.meta}>
                {job.interviewResult?.score !== undefined
                  ? `上次 ${job.interviewResult.score} 分 · 匹配度 ${job.interviewResult.matchScore}/10`
                  : '还没有面试记录'}
              </Text>
            </Pressable>
          ))
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.bg },
  content: { padding: space.lg, gap: space.md, paddingBottom: 48 },
  title: { fontSize: 28, fontWeight: '800', color: colors.ink },
  sub: { color: colors.muted, fontSize: 14, lineHeight: 20 },
  card: {
    backgroundColor: colors.paper,
    borderRadius: radius.md,
    padding: space.md,
    gap: 6,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.line,
  },
  job: { fontSize: 18, fontWeight: '700', color: colors.ink },
  meta: { color: colors.muted, fontSize: 14 },
});
