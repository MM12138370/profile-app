import { useFocusEffect, useNavigation } from '@react-navigation/native';
import type { CompositeNavigationProp } from '@react-navigation/native';
import type { BottomTabNavigationProp } from '@react-navigation/bottom-tabs';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useCallback, useState } from 'react';
import { Alert, StyleSheet } from 'react-native';
import { ScrollView } from 'react-native-gesture-handler';

import { useAuth } from '../auth/AuthContext';
import type { MainTabParamList, RootStackParamList } from '../navigation/types';
import { deleteJob, listJobs } from '../storage';
import { jobListTitle, qaReadyCount, type Job } from '../types';
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
      setJobs(listJobs(user.hashid).filter((job) => job.structured));
    }
  }, [user]);

  useFocusEffect(
    useCallback(() => {
      reload();
    }, [reload]),
  );

  function onPickEmpty() {
    Alert.alert('还没有岗位', '去岗位列表添加', [
      { text: '取消', style: 'cancel' },
      { text: '去导入', onPress: () => navigation.navigate('JobsTab') },
    ]);
  }

  function onDeleteJob(jobId: string) {
    if (!user) {
      return;
    }
    deleteJob(user.hashid, jobId);
    setJobs((prev) => prev.filter((job) => job.id !== jobId));
    toast.show('删除成功');
  }

  return (
    <AppShell>
      {jobs.length === 0 ? (
        <GiantAction label="选择岗位模拟面试" onPress={onPickEmpty} />
      ) : (
        <ScrollView contentContainerStyle={styles.list}>
          {jobs.map((job) => (
            <SwipeableRow key={job.id} onDelete={() => onDeleteJob(job.id)}>
              <ListRow
                flush
                title={jobListTitle(job)}
                subtitle={interviewSubtitle(job)}
                onPress={() => {
                  if (qaReadyCount(job) === 0) {
                    Alert.alert('还没有面试问答', '请先在岗位里生成或手写问题，这里会沿用同一批题。', [
                      { text: '取消', style: 'cancel' },
                      { text: '去岗位', onPress: () => navigation.navigate('JobDetail', { jobId: job.id }) },
                    ]);
                    return;
                  }
                  navigation.navigate('InterviewSession', { jobId: job.id });
                }}
              />
            </SwipeableRow>
          ))}
        </ScrollView>
      )}
    </AppShell>
  );
}

function interviewSubtitle(job: Job): string {
  const count = qaReadyCount(job);
  const score = job.interviewResult?.score;
  const parts: string[] = [];
  if (count > 0) {
    parts.push(`已准备 ${count} 道题`);
  }
  if (score !== undefined) {
    parts.push(`上次 ${score} 分 · 匹配度 ${job.interviewResult?.matchScore}/10`);
  }
  return parts.join(' · ') || '还没有面试问答';
}

const styles = StyleSheet.create({
  list: {
    paddingTop: 4,
    paddingBottom: 48,
  },
});
