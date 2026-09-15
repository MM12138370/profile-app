import { useFocusEffect, useNavigation } from '@react-navigation/native';
import type { CompositeNavigationProp } from '@react-navigation/native';
import type { BottomTabNavigationProp } from '@react-navigation/bottom-tabs';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useCallback, useState } from 'react';
import { StyleSheet } from 'react-native';
import { ScrollView } from 'react-native-gesture-handler';

import { useAuth } from '../auth/AuthContext';
import type { MainTabParamList, RootStackParamList } from '../navigation/types';
import { listJobs, saveJob } from '../storage';
import { hasSavedInterview, jobListTitle, type Job } from '../types';
import { AppShell } from '../ui/AppShell';
import { GiantAction } from '../ui/GiantAction';
import { ListRow } from '../ui/ListRow';
import { SwipeableRow } from '../ui/SwipeableRow';
import { useToast } from '../ui/Toast';

type Nav = CompositeNavigationProp<
  BottomTabNavigationProp<MainTabParamList, 'InterviewTab'>,
  NativeStackNavigationProp<RootStackParamList>
>;

export function InterviewPickScreen() {
  const { user } = useAuth();
  const toast = useToast();
  const navigation = useNavigation<Nav>();
  const [jobs, setJobs] = useState<Job[]>([]);

  const reload = useCallback(() => {
    if (user) {
      setJobs(listJobs(user.hashid).filter(hasSavedInterview));
    }
  }, [user]);

  useFocusEffect(
    useCallback(() => {
      reload();
    }, [reload]),
  );

  function onClear(job: Job) {
    if (!user) {
      return;
    }
    saveJob(user.hashid, { ...job, interviewResult: null });
    setJobs((prev) => prev.filter((item) => item.id !== job.id));
    toast.show('已从面试助手移除');
  }

  return (
    <AppShell>
      {jobs.length === 0 ? (
        <GiantAction
          label="去岗位开始面试问答"
          onPress={() => navigation.navigate('JobsTab')}
        />
      ) : (
        <ScrollView contentContainerStyle={styles.list}>
          {jobs.map((job) => (
            <SwipeableRow key={job.id} onDelete={() => onClear(job)}>
              <ListRow
                flush
                title={jobListTitle(job)}
                subtitle={interviewSubtitle(job)}
                onPress={() => navigation.navigate('InterviewReview', { jobId: job.id })}
              />
            </SwipeableRow>
          ))}
        </ScrollView>
      )}
    </AppShell>
  );
}

function interviewSubtitle(job: Job): string {
  const result = job.interviewResult;
  if (!result) {
    return '还没有保存的面试';
  }
  const parts: string[] = [];
  if (result.score !== undefined) {
    parts.push(`${result.score} 分`);
  }
  if (result.matchScore !== undefined) {
    parts.push(`匹配度 ${result.matchScore}/10`);
  }
  if (result.questions.length) {
    parts.push(`${result.questions.length} 题`);
  }
  if (result.savedAt) {
    const date = new Date(result.savedAt);
    if (!Number.isNaN(date.getTime())) {
      parts.push(`${date.getMonth() + 1}/${date.getDate()}`);
    }
  }
  return parts.join(' · ');
}

const styles = StyleSheet.create({
  list: {
    paddingTop: 4,
    paddingBottom: 48,
  },
});
