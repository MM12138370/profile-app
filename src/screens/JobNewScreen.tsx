import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useState } from 'react';
import { Alert, KeyboardAvoidingView, Platform, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { useAuth } from '../auth/AuthContext';
import type { RootStackParamList } from '../navigation/types';
import { createJob } from '../storage';
import { colors, space } from '../theme';
import { Button } from '../ui/Button';
import { Field } from '../ui/Fields';

type Nav = NativeStackNavigationProp<RootStackParamList, 'JobNew'>;

export function JobNewScreen() {
  const { user } = useAuth();
  const navigation = useNavigation<Nav>();
  const [rawJD, setRawJD] = useState('');

  function onCreate() {
    if (!user) {
      return;
    }
    if (!rawJD.trim()) {
      Alert.alert('请粘贴链接或 JD');
      return;
    }
    const job = createJob(user.hashid, rawJD);
    navigation.replace('JobDetail', { jobId: job.id });
  }

  return (
    <SafeAreaView style={styles.safe} edges={['bottom']}>
      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <View style={styles.body}>
          <Field
            label="粘贴链接"
            value={rawJD}
            onChangeText={setRawJD}
            placeholder="先粘贴岗位链接；解析失败可改贴 JD 正文"
            multiline
            style={styles.area}
          />
        </View>
        <View style={styles.footer}>
          <Button label="导入" onPress={onCreate} />
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.bg },
  flex: { flex: 1 },
  body: { flex: 1, padding: space.lg },
  area: { flex: 1, minHeight: 280 },
  footer: { paddingHorizontal: space.lg, paddingVertical: space.md },
});
