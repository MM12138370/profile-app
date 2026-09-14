import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { Fragment, useEffect, useLayoutEffect, useRef, useState } from 'react';
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
import { GENDERS, MASTER_FIELDS } from '../resumeFields';
import { loadMaster, saveMaster } from '../storage';
import { colors, space } from '../theme';
import { emptyMaster, type MasterTemplate } from '../types';
import { Button } from '../ui/Button';
import { Chip, ChipRow } from '../ui/Chips';
import { Field } from '../ui/Fields';
import { SavePromptOverlay, useLeaveSavePrompt } from '../ui/LeaveSave';
import { useToast } from '../ui/Toast';

type Nav = NativeStackNavigationProp<RootStackParamList, 'MasterTemplate'>;

export function MasterTemplateScreen() {
  const { user } = useAuth();
  const toast = useToast();
  const navigation = useNavigation<Nav>();
  const [master, setMaster] = useState<MasterTemplate | null>(null);
  const masterRef = useRef<MasterTemplate | null>(null);
  const initialRef = useRef('');

  useEffect(() => {
    if (!user) {
      return;
    }
    const loaded = loadMaster(user.hashid);
    masterRef.current = loaded;
    initialRef.current = JSON.stringify(loaded);
    setMaster(loaded);
  }, [user]);

  const dirty = master != null && JSON.stringify(master) !== initialRef.current;

  const persist = () => {
    if (user && masterRef.current) {
      saveMaster(user.hashid, masterRef.current);
      toast.show('保存成功');
    }
  };

  const { promptVisible, requestLeave, confirmSave, confirmDiscard, closePrompt, saveAndLeave } =
    useLeaveSavePrompt({ dirty, persist });

  useLayoutEffect(() => {
    navigation.setOptions({
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
  }, [navigation, requestLeave]);

  function apply(next: MasterTemplate) {
    masterRef.current = next;
    setMaster(next);
  }

  if (!master || !user) {
    return null;
  }

  return (
    <SafeAreaView style={styles.safe} edges={['bottom']}>
      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
          <Text style={styles.hint}>
            姓名、教育经历、联系方式等写在这里。各份子简历会直接用这份信息，不用重复填。
          </Text>
          <View style={styles.block}>
            {MASTER_FIELDS.map((field) => (
              <Fragment key={field.key}>
                <Field
                  label={field.label}
                  value={master[field.key]}
                  placeholder={field.placeholder}
                  multiline={field.multiline}
                  onChangeText={(value) => apply({ ...master, [field.key]: value })}
                />
                {field.key === 'name' ? (
                  <View style={styles.gender}>
                    <Text style={styles.genderLabel}>性别</Text>
                    <ChipRow>
                      {GENDERS.map((g) => (
                        <Chip
                          key={g}
                          label={g}
                          active={master.gender === g}
                          onPress={() => apply({ ...master, gender: g })}
                        />
                      ))}
                    </ChipRow>
                  </View>
                ) : null}
              </Fragment>
            ))}
          </View>
          <Button
            variant="ghost"
            label="清空母模版"
            onPress={() => apply(emptyMaster())}
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
  hint: {
    fontSize: 14,
    lineHeight: 20,
    color: colors.muted,
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
});
