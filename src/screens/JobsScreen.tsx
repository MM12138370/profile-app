import { useFocusEffect, useNavigation } from '@react-navigation/native';
import type { CompositeNavigationProp } from '@react-navigation/native';
import type { BottomTabNavigationProp } from '@react-navigation/bottom-tabs';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useCallback, useState } from 'react';
import { StyleSheet, Text, TextInput, View } from 'react-native';
import { ScrollView } from 'react-native-gesture-handler';

import { useAuth } from '../auth/AuthContext';
import type { MainTabParamList, RootStackParamList } from '../navigation/types';
import { deleteJob, listJobs, saveJob } from '../storage';
import { colors, radius, space } from '../theme';
import { jobListTitle, jobMetaLine, type Job } from '../types';
import { AppShell } from '../ui/AppShell';
import { Button } from '../ui/Button';
import { CenterSheet } from '../ui/CenterSheet';
import { GiantAction } from '../ui/GiantAction';
import { ListRow } from '../ui/ListRow';
import { SwipeableRow } from '../ui/SwipeableRow';
import { useToast } from '../ui/Toast';

type Nav = CompositeNavigationProp<
  BottomTabNavigationProp<MainTabParamList, 'JobsTab'>,
  NativeStackNavigationProp<RootStackParamList>
>;

export function JobsScreen() {
  const { user } = useAuth();
  const toast = useToast();
  const navigation = useNavigation<Nav>();
  const [jobs, setJobs] = useState<Job[]>([]);
  const [editing, setEditing] = useState<Job | null>(null);
  const [remark, setRemark] = useState('');

  const reload = useCallback(() => {
    if (user) {
      setJobs(listJobs(user.hashid));
    }
  }, [user]);

  useFocusEffect(
    useCallback(() => {
      reload();
    }, [reload]),
  );

  function openImport() {
    navigation.navigate('JobNew');
  }

  function onDeleteJob(jobId: string) {
    if (!user) {
      return;
    }
    deleteJob(user.hashid, jobId);
    setJobs((prev) => prev.filter((job) => job.id !== jobId));
    toast.show('删除成功');
  }

  function openRemark(job: Job) {
    setRemark(job.remark);
    setEditing(job);
  }

  function saveRemark() {
    if (!user || !editing) {
      return;
    }
    const next = saveJob(user.hashid, { ...editing, remark: remark.trim() });
    setJobs((prev) => prev.map((job) => (job.id === next.id ? next : job)));
    setEditing(null);
    toast.show('保存成功');
  }

  return (
    <AppShell showAdd={jobs.length > 0} onAdd={openImport}>
      {jobs.length === 0 ? (
        <GiantAction label="添加岗位" onPress={openImport} />
      ) : (
        <ScrollView contentContainerStyle={styles.list}>
          {jobs.map((job) => (
            <SwipeableRow
              key={job.id}
              onDelete={() => onDeleteJob(job.id)}
              onNote={() => openRemark(job)}
            >
              <ListRow
                flush
                title={jobListTitle(job)}
                subtitle={jobSubtitle(job)}
                onPress={() => navigation.navigate('JobDetail', { jobId: job.id })}
              />
            </SwipeableRow>
          ))}
        </ScrollView>
      )}

      <CenterSheet visible={Boolean(editing)} onClose={() => setEditing(null)}>
        <Text style={styles.sheetTitle}>备注名称</Text>
        <TextInput
          value={remark}
          onChangeText={setRemark}
          placeholder="给这条岗位起个备注"
          placeholderTextColor={colors.faint}
          autoFocus
          style={styles.input}
        />
        <View style={styles.sheetActions}>
          <Button variant="ghost" label="取消" style={styles.half} onPress={() => setEditing(null)} />
          <Button label="保存" style={styles.half} onPress={saveRemark} />
        </View>
      </CenterSheet>
    </AppShell>
  );
}

function jobSubtitle(job: Job): string {
  return jobMetaLine(job) || job.rawJD.slice(0, 80);
}

const styles = StyleSheet.create({
  list: {
    paddingTop: 4,
    paddingBottom: 48,
  },
  sheetTitle: {
    fontSize: 17,
    fontWeight: '700',
    color: colors.ink,
  },
  input: {
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.line,
    borderRadius: radius.sm,
    paddingHorizontal: space.md,
    paddingVertical: 12,
    fontSize: 16,
    color: colors.ink,
  },
  sheetActions: {
    flexDirection: 'row',
    gap: space.sm,
  },
  half: { flex: 1 },
});
