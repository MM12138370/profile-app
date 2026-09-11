import { useFocusEffect, useNavigation } from '@react-navigation/native';
import type { CompositeNavigationProp } from '@react-navigation/native';
import type { BottomTabNavigationProp } from '@react-navigation/bottom-tabs';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useCallback, useState } from 'react';
import { Alert, ScrollView, StyleSheet } from 'react-native';

import { useAuth } from '../auth/AuthContext';
import type { MainTabParamList, RootStackParamList } from '../navigation/types';
import { listJobs } from '../storage';
import type { Job } from '../types';
import { AppShell } from '../ui/AppShell';
import { GiantAction } from '../ui/GiantAction';
import { ListRow } from '../ui/ListRow';

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

  function onPickEmpty() {
    Alert.alert('还没有岗位', '去岗位列表导入', [
      { text: '取消', style: 'cancel' },
      { text: '去导入', onPress: () => navigation.navigate('JobsTab') },
    ]);
  }

  return (
    <AppShell>
      {jobs.length === 0 ? (
        <GiantAction label="选择岗位模拟面试" onPress={onPickEmpty} />
      ) : (
        <ScrollView contentContainerStyle={styles.list}>
          {jobs.map((job) => (
            <ListRow
              key={job.id}
              title={job.structured?.jobTitle || '岗位'}
              subtitle={
                job.interviewResult?.score !== undefined
                  ? `上次 ${job.interviewResult.score} 分 · 匹配度 ${job.interviewResult.matchScore}/10`
                  : '还没有面试记录'
              }
              onPress={() => navigation.navigate('InterviewSession', { jobId: job.id })}
            />
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
