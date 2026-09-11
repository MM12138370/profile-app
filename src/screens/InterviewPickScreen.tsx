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
import type { Job } from '../types';
import { AppShell } from '../ui/AppShell';
import { GiantAction } from '../ui/GiantAction';
import { ListRow } from '../ui/ListRow';
import { SwipeableRow } from '../ui/SwipeableRow';

type Nav = CompositeNavigationProp<
  BottomTabNavigationProp<MainTabParamList, 'InterviewTab'>,
  NativeStackNavigationProp<RootStackParamList>
>;

export function InterviewPickScreen() {
  const { user } = useAuth();
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
    Alert.alert('还没有岗位', '去岗位列表导入', [
      { text: '取消', style: 'cancel' },
      { text: '去导入', onPress: () => navigation.navigate('JobsTab') },
    ]);
  }

  function onDeleteJob(jobId: string) {
    if (!user) {
      return;
    }
    Alert.alert('删除岗位', '该岗位的 JD、问答和面试记录都会从本地删掉。', [
      { text: '取消', style: 'cancel' },
      {
        text: '删除',
        style: 'destructive',
        onPress: () => {
          deleteJob(user.hashid, jobId);
          reload();
        },
      },
    ]);
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
                title={job.structured?.jobTitle || '岗位'}
                subtitle={
                  job.interviewResult?.score !== undefined
                    ? `上次 ${job.interviewResult.score} 分 · 匹配度 ${job.interviewResult.matchScore}/10`
                    : '还没有面试记录'
                }
                onPress={() => navigation.navigate('InterviewSession', { jobId: job.id })}
              />
            </SwipeableRow>
          ))}
        </ScrollView>
      )}
    </AppShell>
  );
}

const styles = StyleSheet.create({
  list: {
    paddingTop: 4,
    paddingBottom: 48,
  },
});
