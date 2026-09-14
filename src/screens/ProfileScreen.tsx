import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect, useNavigation, useRoute, type RouteProp } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
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
import { RESUME_FIELDS } from '../resumeFields';
import { loadMaster, loadResume, persistResume } from '../storage';
import { colors, radius, space } from '../theme';
import {
  emptyResume,
  masterHasContent,
  type MasterTemplate,
  type Resume,
} from '../types';
import { Button } from '../ui/Button';
import { Field } from '../ui/Fields';
import { SavePromptOverlay, useLeaveSavePrompt } from '../ui/LeaveSave';
import { SectionTree } from '../ui/SectionTree';
import { useToast } from '../ui/Toast';

type Nav = NativeStackNavigationProp<RootStackParamList, 'Profile'>;
type R = RouteProp<RootStackParamList, 'Profile'>;

export function ProfileScreen() {
  const { user } = useAuth();
  const toast = useToast();
  const navigation = useNavigation<Nav>();
  const resumeId = useRoute<R>().params?.resumeId;
  const [resume, setResume] = useState<Resume | null>(null);
  const [master, setMaster] = useState<MasterTemplate | null>(null);
  const resumeRef = useRef<Resume | null>(null);
  const initialRef = useRef('');

  useEffect(() => {
    if (!user) {
      return;
    }
    const loaded = resumeId ? loadResume(user.hashid, resumeId) : emptyResume('');
    resumeRef.current = loaded;
    initialRef.current = JSON.stringify(loaded);
    setResume(loaded);
    setMaster(loadMaster(user.hashid));
  }, [resumeId, user]);

  useFocusEffect(
    useCallback(() => {
      if (user) {
        setMaster(loadMaster(user.hashid));
      }
    }, [user]),
  );

  const dirty = resume != null && JSON.stringify(resume) !== initialRef.current;

  const persist = () => {
    if (!user || !resumeRef.current) {
      return;
    }
    const saved = persistResume(user.hashid, resumeRef.current);
    resumeRef.current = saved;
    initialRef.current = JSON.stringify(saved);
    setResume(saved);
    toast.show('保存成功');
  };

  const { promptVisible, requestLeave, confirmSave, confirmDiscard, closePrompt, saveAndLeave } =
    useLeaveSavePrompt({ dirty, persist });

  useLayoutEffect(() => {
    navigation.setOptions({
      title: resumeId ? '编辑简历' : '新建简历',
      gestureEnabled: false,
      headerBackVisible: false,
      headerLeft: () => (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="返回"
          hitSlop={12}
          onPress={requestLeave}
          style={styles.backBtn}
        >
          <Ionicons name="chevron-back" size={28} color={colors.accent} />
        </Pressable>
      ),
    });
  }, [navigation, requestLeave, resumeId]);

  function apply(next: Resume) {
    resumeRef.current = next;
    setResume(next);
  }

  if (!resume || !user || !master) {
    return null;
  }

  return (
    <SafeAreaView style={styles.safe} edges={['bottom']}>
      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
          <Pressable
            onPress={() => navigation.navigate('MasterTemplate')}
            style={({ pressed }) => [styles.master, pressed && styles.pressed]}
          >
            <Text style={styles.masterKicker}>母模版 · 各简历共用</Text>
            <Text style={styles.masterTitle}>
              {masterHasContent(master)
                ? [master.name, master.age, master.phone].filter((v) => v.trim()).join(' · ') ||
                  '已填写'
                : '尚未填写'}
            </Text>
            <Text style={styles.masterHint}>点此编辑姓名、教育经历、电话、邮箱</Text>
          </Pressable>

          <Text style={styles.section}>这份简历</Text>
          <View style={styles.block}>
            <Field
              label="简历名称"
              value={resume.title}
              placeholder="例如：字节跳动 · iOS"
              onChangeText={(title) => apply({ ...resume, title })}
            />
            {RESUME_FIELDS.map((field) => (
              <Field
                key={field.key}
                label={field.label}
                value={resume[field.key]}
                placeholder={field.placeholder}
                onChangeText={(value) => apply({ ...resume, [field.key]: value })}
              />
            ))}
          </View>

          <Text style={styles.section}>简历板块</Text>
          <SectionTree
            nodes={resume.sections}
            onChange={(sections) => apply({ ...resume, sections })}
          />
        </ScrollView>
        <View style={styles.footer}>
          <Button label="保存" onPress={saveAndLeave} />
        </View>
      </KeyboardAvoidingView>
      <SavePromptOverlay
        visible={promptVisible}
        onSave={confirmSave}
        onDiscard={confirmDiscard}
        onContinue={closePrompt}
      />
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
  master: {
    backgroundColor: colors.paper,
    borderRadius: radius.md,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.line,
    padding: space.md,
    gap: 4,
  },
  pressed: { opacity: 0.82 },
  masterKicker: {
    fontSize: 12,
    fontWeight: '700',
    color: colors.accent,
  },
  masterTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: colors.ink,
  },
  masterHint: {
    fontSize: 13,
    color: colors.muted,
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
  footer: {
    paddingHorizontal: space.lg,
    paddingVertical: space.md,
  },
});
