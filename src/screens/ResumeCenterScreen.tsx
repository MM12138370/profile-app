import type { BottomTabNavigationProp } from '@react-navigation/bottom-tabs';
import type { CompositeNavigationProp } from '@react-navigation/native';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useCallback, useState } from 'react';
import { Alert, ScrollView, StyleSheet } from 'react-native';

import { useAuth } from '../auth/AuthContext';
import type { MainTabParamList, RootStackParamList } from '../navigation/types';
import { loadProfile } from '../storage';
import { profileHasContent, type Profile } from '../types';
import { AppShell } from '../ui/AppShell';
import { GiantAction } from '../ui/GiantAction';
import { ListRow } from '../ui/ListRow';
import { SegmentedBar } from '../ui/SegmentedBar';

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
    navigation.navigate('Profile');
  }

  function onAdd() {
    if (segment === 'resumes') {
      openEditor();
      return;
    }
    Alert.alert('模板', '模板导入下一期接入。');
  }

  return (
    <AppShell showAdd={showAdd} onAdd={onAdd}>
      <SegmentedBar options={SEGMENTS} value={segment} onChange={setSegment} />
      {segment === 'templates' ? (
        <GiantAction label="导入模板" onPress={onAdd} />
      ) : hasResume && profile ? (
        <ScrollView contentContainerStyle={styles.list}>
          <ListRow
            title={profile.personalInfo.name.trim() || '未命名简历'}
            subtitle={profile.personalInfo.jobIntention.trim() || '本地简历'}
            onPress={openEditor}
          />
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
