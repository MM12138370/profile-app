import { Ionicons } from '@expo/vector-icons';
import type { CompositeNavigationProp } from '@react-navigation/native';
import type { BottomTabNavigationProp } from '@react-navigation/bottom-tabs';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import { Fragment, useCallback, useRef, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { useAuth } from '../auth/AuthContext';
import type { MainTabParamList, RootStackParamList } from '../navigation/types';
import { loadProfile, saveProfile } from '../storage';
import { colors, space } from '../theme';
import type { PersonalInfo, Profile } from '../types';
import { Chip, ChipRow } from '../ui/Chips';
import { Field } from '../ui/Fields';
import { SectionTree } from '../ui/SectionTree';

type Nav = CompositeNavigationProp<
  BottomTabNavigationProp<MainTabParamList, 'ProfileTab'>,
  NativeStackNavigationProp<RootStackParamList>
>;

const GENDERS = ['男', '女', '不愿透露'];

const INFO_FIELDS: Array<{ key: keyof PersonalInfo; label: string; placeholder: string; multiline?: boolean }> =
  [
    { key: 'name', label: '姓名', placeholder: '真实姓名' },
    { key: 'birthDate', label: '出生年月', placeholder: '1998-07' },
    { key: 'phone', label: '手机号', placeholder: '11 位手机号' },
    { key: 'email', label: '邮箱', placeholder: 'name@example.com' },
    { key: 'education', label: '学历信息', placeholder: '本科 / 硕士…' },
    { key: 'jobIntention', label: '求职意向', placeholder: 'iOS 开发' },
    { key: 'educationExperience', label: '教育经历', placeholder: '学校 · 专业 · 时间', multiline: true },
    { key: 'yearsOfWork', label: '工作年限', placeholder: '3 年' },
    { key: 'intendedCities', label: '意向城市', placeholder: '上海、杭州' },
  ];

export function ProfileScreen() {
  const { user } = useAuth();
  const navigation = useNavigation<Nav>();
  const [profile, setProfile] = useState<Profile | null>(null);
  const [savedAt, setSavedAt] = useState<string>('');
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const profileRef = useRef<Profile | null>(null);

  const persist = useCallback(
    (next: Profile) => {
      if (!user) {
        return;
      }
      profileRef.current = next;
      setProfile(next);
      if (timer.current) {
        clearTimeout(timer.current);
      }
      timer.current = setTimeout(() => {
        saveProfile(user.hashid, next);
        setSavedAt('已自动保存');
      }, 400);
    },
    [user],
  );

  useFocusEffect(
    useCallback(() => {
      if (user) {
        const loaded = loadProfile(user.hashid);
        profileRef.current = loaded;
        setProfile(loaded);
      }
      return () => {
        if (timer.current) {
          clearTimeout(timer.current);
          timer.current = null;
        }
        if (user && profileRef.current) {
          saveProfile(user.hashid, profileRef.current);
        }
      };
    }, [user]),
  );

  if (!profile || !user) {
    return null;
  }

  const info = profile.personalInfo;

  return (
    <SafeAreaView style={styles.safe} edges={['bottom']}>
      <ScrollView
        contentContainerStyle={styles.content}
        keyboardShouldPersistTaps="handled"
      >
        <View style={styles.top}>
          <Text style={styles.hello}>你好，{info.name || user.username}</Text>
          <Pressable onPress={() => navigation.navigate('Settings')} hitSlop={8}>
            <Ionicons name="settings-outline" size={22} color={colors.accent} />
          </Pressable>
        </View>
        <Text style={styles.sub}>个人信息与板块都会写进本地 profile.json。板块可以嵌套，方便和工作经历、项目经历、技能对齐。</Text>
        {savedAt ? <Text style={styles.saved}>{savedAt}</Text> : null}

        <Text style={styles.section}>个人信息</Text>
        <View style={styles.block}>
          {INFO_FIELDS.map((field) => (
            <Fragment key={field.key}>
              <Field
                label={field.label}
                value={info[field.key]}
                placeholder={field.placeholder}
                multiline={field.multiline}
                onChangeText={(value) =>
                  persist({
                    ...profile,
                    personalInfo: { ...info, [field.key]: value },
                  })
                }
              />
              {field.key === 'name' ? (
                <View style={styles.gender}>
                  <Text style={styles.genderLabel}>性别</Text>
                  <ChipRow>
                    {GENDERS.map((g) => (
                      <Chip
                        key={g}
                        label={g}
                        active={info.gender === g}
                        onPress={() =>
                          persist({
                            ...profile,
                            personalInfo: { ...info, gender: g },
                          })
                        }
                      />
                    ))}
                  </ChipRow>
                </View>
              ) : null}
            </Fragment>
          ))}
        </View>

        <Text style={styles.section}>简历板块</Text>
        <Text style={styles.sub}>条目是标题 + 内容；分组是同构子数组。从求职中心导入的相关项目会追加到这里。</Text>
        <SectionTree
          nodes={profile.sections}
          onChange={(sections) => persist({ ...profile, sections })}
        />
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.bg },
  content: {
    padding: space.lg,
    gap: space.md,
    paddingBottom: 48,
  },
  top: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: space.md,
  },
  hello: {
    flex: 1,
    fontSize: 28,
    fontWeight: '800',
    color: colors.ink,
  },
  sub: {
    color: colors.muted,
    fontSize: 14,
    lineHeight: 20,
  },
  saved: {
    color: colors.good,
    fontSize: 12,
    fontWeight: '600',
  },
  section: {
    marginTop: space.sm,
    fontSize: 18,
    fontWeight: '700',
    color: colors.ink,
  },
  block: {
    gap: space.md,
  },
  gender: {
    gap: 8,
  },
  genderLabel: {
    fontSize: 13,
    color: colors.muted,
    fontWeight: '600',
  },
});
