import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import type { CompositeNavigationProp } from '@react-navigation/native';
import type { BottomTabNavigationProp } from '@react-navigation/bottom-tabs';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useCallback, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { useAuth } from '../auth/AuthContext';
import type { MainTabParamList, RootStackParamList } from '../navigation/types';
import { listJobs } from '../storage';
import { colors, radius, space } from '../theme';
import type { Job } from '../types';
import { Chip, ChipRow } from '../ui/Chips';
import { EmptyState } from '../ui/EmptyState';

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

  return (
    <SafeAreaView style={styles.safe} edges={['bottom']}>
      <ScrollView contentContainerStyle={styles.content}>
        <View style={styles.top}>
          <View style={styles.flex}>
            <Text style={styles.title}>求职中心</Text>
            <Text style={styles.sub}>粘贴 JD，再分别做结构化、面试问答和相关项目。结果写入该岗位的 job 文件。</Text>
          </View>
          <Pressable
            style={styles.add}
            onPress={() => navigation.navigate('JobNew')}
          >
            <Ionicons name="add" size={22} color="#fff" />
          </Pressable>
        </View>
        {jobs.length === 0 ? (
          <EmptyState title="还没有岗位" hint="点右上角加号，把一段 JD 粘进来。" />
        ) : (
          jobs.map((job) => (
            <Pressable
              key={job.id}
              style={styles.card}
              onPress={() => navigation.navigate('JobDetail', { jobId: job.id })}
            >
              <Text style={styles.jobTitle}>
                {job.structured?.jobTitle || '未结构化的 JD'}
              </Text>
              <Text style={styles.meta} numberOfLines={2}>
                {[job.structured?.location, job.structured?.yearsRequired]
                  .filter(Boolean)
                  .join(' · ') || job.rawJD.slice(0, 80)}
              </Text>
              <ChipRow>
                <Chip label="JD" active={Boolean(job.structured)} />
                <Chip label="问答" active={job.interviewQA.length > 0} />
                <Chip label="项目" active={job.relatedProjects.length > 0} />
                <Chip label="面试" active={Boolean(job.interviewResult?.score !== undefined)} />
              </ChipRow>
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
  top: { flexDirection: 'row', gap: space.md, alignItems: 'flex-start' },
  flex: { flex: 1, gap: 6 },
  title: { fontSize: 28, fontWeight: '800', color: colors.ink },
  sub: { color: colors.muted, fontSize: 14, lineHeight: 20 },
  add: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: colors.accent,
    alignItems: 'center',
    justifyContent: 'center',
  },
  card: {
    backgroundColor: colors.paper,
    borderRadius: radius.md,
    padding: space.md,
    gap: 8,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.line,
  },
  jobTitle: { fontSize: 18, fontWeight: '700', color: colors.ink },
  meta: { color: colors.muted, fontSize: 14, lineHeight: 20 },
});
