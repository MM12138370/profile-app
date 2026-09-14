import type { BottomTabNavigationProp } from '@react-navigation/bottom-tabs';
import type { CompositeNavigationProp } from '@react-navigation/native';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useCallback, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { ScrollView } from 'react-native-gesture-handler';

import { useAuth } from '../auth/AuthContext';
import type { MainTabParamList, RootStackParamList } from '../navigation/types';
import { deleteResume, listResumes, loadMaster } from '../storage';
import { colors, space } from '../theme';
import {
  masterHasContent,
  resumeLabel,
  type MasterTemplate,
  type Resume,
} from '../types';
import { AppShell } from '../ui/AppShell';
import { Button } from '../ui/Button';
import { GiantAction } from '../ui/GiantAction';
import { ListRow } from '../ui/ListRow';
import { MasterView } from '../ui/ResumeView';
import { SegmentedBar } from '../ui/SegmentedBar';
import { SwipeableRow } from '../ui/SwipeableRow';
import { useToast } from '../ui/Toast';

type Nav = CompositeNavigationProp<
  BottomTabNavigationProp<MainTabParamList, 'ProfileTab'>,
  NativeStackNavigationProp<RootStackParamList>
>;

type Segment = 'resumes' | 'templates';

const SEGMENTS: Array<{ key: Segment; label: string }> = [
  { key: 'resumes', label: '已导入简历' },
  { key: 'templates', label: '简历模板' },
];

export function ResumeCenterScreen() {
  const { user } = useAuth();
  const toast = useToast();
  const navigation = useNavigation<Nav>();
  const [segment, setSegment] = useState<Segment>('resumes');
  const [resumes, setResumes] = useState<Resume[]>([]);
  const [master, setMaster] = useState<MasterTemplate | null>(null);

  const reload = useCallback(() => {
    if (!user) {
      return;
    }
    setResumes(listResumes(user.hashid));
    setMaster(loadMaster(user.hashid));
  }, [user]);

  useFocusEffect(
    useCallback(() => {
      reload();
    }, [reload]),
  );

  const hasMaster = Boolean(master && masterHasContent(master));
  const showAdd = segment === 'resumes' && resumes.length > 0;

  function openCreate() {
    navigation.navigate('Profile', {});
  }

  function openMaster() {
    navigation.navigate('MasterTemplate');
  }

  function onDeleteResume(resumeId: string) {
    if (!user) {
      return;
    }
    deleteResume(user.hashid, resumeId);
    setResumes((prev) => prev.filter((item) => item.id !== resumeId));
    toast.show('删除成功');
  }

  return (
    <AppShell showAdd={showAdd} onAdd={openCreate}>
      <SegmentedBar options={SEGMENTS} value={segment} onChange={setSegment} />
      {segment === 'templates' ? (
        hasMaster && master ? (
          <View style={styles.template}>
            <ScrollView contentContainerStyle={styles.preview}>
              <Text style={styles.hint}>各子简历共用这份信息，点编辑即可改。</Text>
              <MasterView master={master} />
            </ScrollView>
            <View style={styles.footer}>
              <Button label="编辑" onPress={openMaster} />
            </View>
          </View>
        ) : (
          <GiantAction label="填写母模版" onPress={openMaster} />
        )
      ) : resumes.length > 0 ? (
        <ScrollView contentContainerStyle={styles.list}>
          {resumes.map((resume) => (
            <SwipeableRow key={resume.id} onDelete={() => onDeleteResume(resume.id)}>
              <ListRow
                flush
                title={resumeLabel(resume)}
                subtitle={
                  [resume.jobIntention, resume.intendedCities].filter((v) => v.trim()).join(' · ') ||
                  '面向岗位的子简历'
                }
                onPress={() => navigation.navigate('ResumePreview', { resumeId: resume.id })}
              />
            </SwipeableRow>
          ))}
        </ScrollView>
      ) : (
        <GiantAction label="导入简历" onPress={openCreate} />
      )}
    </AppShell>
  );
}

const styles = StyleSheet.create({
  list: {
    paddingTop: 4,
    paddingBottom: 48,
  },
  template: {
    flex: 1,
  },
  preview: {
    paddingHorizontal: space.lg,
    paddingTop: space.sm,
    paddingBottom: space.lg,
    gap: space.md,
  },
  hint: {
    fontSize: 14,
    lineHeight: 20,
    color: colors.muted,
  },
  footer: {
    paddingHorizontal: space.lg,
    paddingVertical: space.md,
  },
});
