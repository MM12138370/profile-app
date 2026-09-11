import { useFocusEffect, useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useCallback, useLayoutEffect, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { useAuth } from '../auth/AuthContext';
import type { RootStackParamList } from '../navigation/types';
import { loadProfile } from '../storage';
import { colors, space } from '../theme';
import { profileHasContent, type Profile } from '../types';
import { ResumeView } from '../ui/ResumeView';

type Nav = NativeStackNavigationProp<RootStackParamList, 'ResumePreview'>;

export function ResumePreviewScreen() {
  const { user } = useAuth();
  const navigation = useNavigation<Nav>();
  const [profile, setProfile] = useState<Profile | null>(null);

  useFocusEffect(
    useCallback(() => {
      if (!user) {
        return;
      }
      const loaded = loadProfile(user.hashid);
      if (!profileHasContent(loaded)) {
        navigation.goBack();
        return;
      }
      setProfile(loaded);
    }, [navigation, user]),
  );

  useLayoutEffect(() => {
    navigation.setOptions({
      headerRight: () => (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="编辑"
          hitSlop={10}
          onPress={() => navigation.navigate('Profile', { intent: 'edit' })}
        >
          <Text style={styles.edit}>编辑</Text>
        </Pressable>
      ),
    });
  }, [navigation]);

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
