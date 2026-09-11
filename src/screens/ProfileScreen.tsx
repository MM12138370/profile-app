import { Ionicons } from '@expo/vector-icons';
import {
  useNavigation,
  useRoute,
  type NavigationAction,
  type RouteProp,
} from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { Fragment, useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import {
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { useAuth } from '../auth/AuthContext';
import type { RootStackParamList } from '../navigation/types';
import { rememberDiscardDraft, rememberKeepDraft, shouldStartEmpty } from '../resumeDraft';
import { GENDERS, INFO_FIELDS } from '../resumeFields';
import { loadProfile, saveProfile } from '../storage';
import { colors, radius, space } from '../theme';
import { emptyProfile, type PersonalInfo, type Profile } from '../types';
import { Button } from '../ui/Button';
import { Chip, ChipRow } from '../ui/Chips';
import { Field } from '../ui/Fields';
import { SectionTree } from '../ui/SectionTree';

type Nav = NativeStackNavigationProp<RootStackParamList, 'Profile'>;
type R = RouteProp<RootStackParamList, 'Profile'>;

export function ProfileScreen() {
  const { user } = useAuth();
  const navigation = useNavigation<Nav>();
  const intent = useRoute<R>().params?.intent ?? 'create';
  const [profile, setProfile] = useState<Profile | null>(null);
  const [promptVisible, setPromptVisible] = useState(false);
  const profileRef = useRef<Profile | null>(null);
  const allowLeave = useRef(false);
  const pendingAction = useRef<NavigationAction | null>(null);

  const apply = useCallback((next: Profile) => {
    profileRef.current = next;
    setProfile(next);
  }, []);

  const openPrompt = useCallback((action?: NavigationAction) => {
    pendingAction.current = action ?? null;
    setPromptVisible(true);
  }, []);

  useEffect(() => {
    if (!user) {
      return;
    }
    const loaded =
      intent === 'create' && shouldStartEmpty() ? emptyProfile() : loadProfile(user.hashid);
    profileRef.current = loaded;
    allowLeave.current = false;
    setPromptVisible(false);
    setProfile(loaded);
  }, [intent, user]);

  useLayoutEffect(() => {
    navigation.setOptions({
      gestureEnabled: false,
      headerBackVisible: false,
      headerLeft: () => (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="返回"
          hitSlop={12}
          onPress={() => openPrompt()}
          style={styles.backBtn}
        >
          <Ionicons name="chevron-back" size={28} color={colors.accent} />
        </Pressable>
      ),
    });
  }, [navigation, openPrompt]);

  useEffect(() => {
    const sub = navigation.addListener('beforeRemove', (e) => {
      if (allowLeave.current) {
        return;
      }
      e.preventDefault();
      openPrompt(e.data.action);
    });
    return sub;
  }, [navigation, openPrompt]);

  function closePrompt() {
    pendingAction.current = null;
    setPromptVisible(false);
  }

  function persistCurrent() {
    if (user && profileRef.current) {
      saveProfile(user.hashid, profileRef.current);
    }
    rememberKeepDraft();
  }

  function leave(save: boolean) {
    if (save) {
      persistCurrent();
    } else {
      rememberDiscardDraft();
    }
    allowLeave.current = true;
    const action = pendingAction.current;
    closePrompt();
    if (action) {
      navigation.dispatch(action);
    } else {
      navigation.goBack();
    }
  }

  function patchInfo(patch: Partial<PersonalInfo>) {
    if (!profile) {
      return;
    }
    apply({
      ...profile,
      personalInfo: { ...profile.personalInfo, ...patch },
    });
  }

  function onSave() {
    persistCurrent();
    allowLeave.current = true;
    navigation.goBack();
  }

  if (!profile || !user) {
    return null;
  }

  const info = profile.personalInfo;

  return (
    <SafeAreaView style={styles.safe} edges={['bottom']}>
      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <ScrollView
          contentContainerStyle={styles.content}
          keyboardShouldPersistTaps="handled"
        >
          <Text style={styles.section}>个人信息</Text>
          <View style={styles.block}>
            {INFO_FIELDS.map((field) => (
              <Fragment key={field.key}>
                <Field
                  label={field.label}
                  value={info[field.key]}
                  placeholder={field.placeholder}
                  multiline={field.multiline}
                  onChangeText={(value) => patchInfo({ [field.key]: value })}
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
                          onPress={() => patchInfo({ gender: g })}
                        />
                      ))}
                    </ChipRow>
                  </View>
                ) : null}
              </Fragment>
            ))}
          </View>

          <Text style={styles.section}>简历板块</Text>
          <SectionTree
            nodes={profile.sections}
            onChange={(sections) => apply({ ...profile, sections })}
          />
        </ScrollView>
        <View style={styles.footer}>
          <Button label="保存" onPress={onSave} />
        </View>
      </KeyboardAvoidingView>

      {promptVisible ? (
        <View style={styles.overlay} pointerEvents="box-none">
          <Pressable style={styles.mask} onPress={closePrompt} />
          <View style={styles.dialog}>
            <Text style={styles.dialogTitle}>保存草稿？</Text>
            <Text style={styles.dialogBody}>
              保存后，下次点加号会看到这次的内容。不保存只丢掉这次填写，已保存的简历还在。
            </Text>
            <Button label="保存草稿" onPress={() => leave(true)} />
            <Button variant="danger" label="不保存" onPress={() => leave(false)} />
            <Button variant="ghost" label="继续编辑" onPress={closePrompt} />
          </View>
        </View>
      ) : null}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.bg },
  flex: { flex: 1 },
  backBtn: {
    marginLeft: Platform.OS === 'ios' ? 0 : -4,
    paddingRight: 8,
    justifyContent: 'center',
  },
  content: {
    padding: space.lg,
    gap: space.md,
    paddingBottom: space.lg,
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
  footer: {
    paddingHorizontal: space.lg,
    paddingVertical: space.md,
  },
  overlay: {
    ...StyleSheet.absoluteFillObject,
    zIndex: 50,
    elevation: 50,
    alignItems: 'center',
    justifyContent: 'center',
    padding: space.lg,
  },
  mask: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(26, 23, 20, 0.45)',
  },
  dialog: {
    width: '100%',
    maxWidth: 320,
    backgroundColor: colors.paper,
    borderRadius: radius.lg,
    padding: space.lg,
    gap: space.sm,
    zIndex: 51,
    elevation: 51,
  },
  dialogTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: colors.ink,
  },
  dialogBody: {
    fontSize: 14,
    lineHeight: 20,
    color: colors.muted,
    marginBottom: space.xs,
  },
});
