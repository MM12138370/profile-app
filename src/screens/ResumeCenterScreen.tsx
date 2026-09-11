import type { BottomTabNavigationProp } from '@react-navigation/bottom-tabs';
import type { CompositeNavigationProp } from '@react-navigation/native';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useCallback, useState } from 'react';
import { Alert, StyleSheet } from 'react-native';
import { ScrollView } from 'react-native-gesture-handler';

import { useAuth } from '../auth/AuthContext';
import type { MainTabParamList, RootStackParamList } from '../navigation/types';
import { clearProfile, loadProfile } from '../storage';
import { profileHasContent, type Profile } from '../types';
import { AppShell } from '../ui/AppShell';
import { GiantAction } from '../ui/GiantAction';
import { ListRow } from '../ui/ListRow';
import { SegmentedBar } from '../ui/SegmentedBar';
import { SwipeableRow } from '../ui/SwipeableRow';

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
  const navigation = useNavigation<Nav>();
  const [segment, setSegment] = useState<Segment>('resumes');
  const [profile, setProfile] = useState<Profile | null>(null);

  useFocusEffect(
    useCallback(() => {
      if (user) {
        setProfile(loadProfile(user.hashid));
      }
    }, [user]),
  );

  const hasResume = Boolean(profile && profileHasContent(profile));
  const showAdd = segment === 'resumes' ? hasResume : false;

  function openEditor() {
    navigation.navigate('Profile', { intent: 'create' });
  }

  function openPreview() {
    navigation.navigate('ResumePreview');
  }

  function onAdd() {
    if (segment === 'resumes') {
      openEditor();
      return;
    }
    Alert.alert('模板', '模板导入下一期接入。');
  }

  function onDeleteResume() {
    if (!user) {
      return;
    }
    Alert.alert('删除简历', '这份本地简历会从本机清掉，无法恢复。', [
      { text: '取消', style: 'cancel' },
      {
        text: '删除',
        style: 'destructive',
        onPress: () => {
          clearProfile(user.hashid);
          setProfile(loadProfile(user.hashid));
        },
      },
    ]);
  }

  return (
    <AppShell showAdd={showAdd} onAdd={onAdd}>
      <SegmentedBar options={SEGMENTS} value={segment} onChange={setSegment} />
      {segment === 'templates' ? (
        <GiantAction label="导入模板" onPress={onAdd} />
      ) : hasResume && profile ? (
        <ScrollView contentContainerStyle={styles.list}>
          <SwipeableRow onDelete={onDeleteResume}>
            <ListRow
              flush
              title={profile.personalInfo.name.trim() || '未命名简历'}
              subtitle={profile.personalInfo.jobIntention.trim() || '本地简历'}
              onPress={openPreview}
            />
          </SwipeableRow>
        </ScrollView>
      ) : (
        <GiantAction label="导入简历" onPress={openEditor} />
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
