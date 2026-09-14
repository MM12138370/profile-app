import { useFocusEffect, useNavigation, useRoute, type RouteProp } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useCallback, useLayoutEffect, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { useAuth } from '../auth/AuthContext';
import type { RootStackParamList } from '../navigation/types';
import { loadComposedProfile, loadResume, resumeExists } from '../storage';
import { colors, space } from '../theme';
import { resumeLabel, type Profile, type Resume } from '../types';
import { ResumeView } from '../ui/ResumeView';

type Nav = NativeStackNavigationProp<RootStackParamList, 'ResumePreview'>;
type R = RouteProp<RootStackParamList, 'ResumePreview'>;

export function ResumePreviewScreen() {
  const { user } = useAuth();
  const navigation = useNavigation<Nav>();
  const { resumeId } = useRoute<R>().params;
  const [profile, setProfile] = useState<Profile | null>(null);
  const [resume, setResume] = useState<Resume | null>(null);

  useFocusEffect(
    useCallback(() => {
      if (!user) {
        return;
      }
      if (!resumeExists(user.hashid, resumeId)) {
        navigation.goBack();
        return;
      }
      setResume(loadResume(user.hashid, resumeId));
      setProfile(loadComposedProfile(user.hashid, resumeId));
    }, [navigation, resumeId, user]),
  );

  useLayoutEffect(() => {
    navigation.setOptions({
      title: resume ? resumeLabel(resume) : '简历预览',
      headerRight: () => (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="编辑"
          hitSlop={10}
          onPress={() => navigation.navigate('Profile', { resumeId })}
        >
          <Text style={styles.edit}>编辑</Text>
        </Pressable>
      ),
    });
  }, [navigation, resume, resumeId]);

  if (!profile) {
    return null;
  }

  return (
    <SafeAreaView style={styles.safe} edges={['bottom']}>
      <ScrollView contentContainerStyle={styles.content}>
        <ResumeView profile={profile} />
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.bg },
  content: {
    padding: space.lg,
    paddingBottom: 48,
  },
  edit: {
    color: colors.accent,
    fontSize: 16,
    fontWeight: '600',
  },
});
