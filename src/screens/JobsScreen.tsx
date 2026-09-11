import { useFocusEffect, useNavigation } from '@react-navigation/native';
import type { CompositeNavigationProp } from '@react-navigation/native';
import type { BottomTabNavigationProp } from '@react-navigation/bottom-tabs';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useCallback, useState } from 'react';
import { ScrollView, StyleSheet } from 'react-native';

import { useAuth } from '../auth/AuthContext';
import type { MainTabParamList, RootStackParamList } from '../navigation/types';
import { listJobs } from '../storage';
import type { Job } from '../types';
import { AppShell } from '../ui/AppShell';
import { GiantAction } from '../ui/GiantAction';
import { ListRow } from '../ui/ListRow';

type Nav = CompositeNavigationProp<
  BottomTabNavigationProp<MainTabParamList, 'JobsTab'>,
  NativeStackNavigationProp<RootStackParamList>
>;

export function JobsScreen() {
  const { user } = useAuth();
  const navigation = useNavigation<Nav>();
  const [jobs, setJobs] = useState<Job[]>([]);

  useFocusEffect(
    useCallback(() => {
      if (user) {
        setJobs(listJobs(user.hashid));
      }
    }, [user]),
  );

  function openImport() {
    navigation.navigate('JobNew');
  }

  return (
    <AppShell showAdd={jobs.length > 0} onAdd={openImport}>
      {jobs.length === 0 ? (
        <GiantAction label="导入岗位" onPress={openImport} />
      ) : (
        <ScrollView contentContainerStyle={styles.list}>
          {jobs.map((job) => (
            <ListRow
              key={job.id}
              title={job.structured?.jobTitle || '未结构化的 JD'}
              subtitle={
                [job.structured?.location, job.structured?.yearsRequired]
                  .filter(Boolean)
                  .join(' · ') || job.rawJD.slice(0, 80)
              }
              onPress={() => navigation.navigate('JobDetail', { jobId: job.id })}
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
