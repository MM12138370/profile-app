import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import * as ImagePicker from 'expo-image-picker';
import { useLayoutEffect, useState } from 'react';
import {
  Alert,
  Image,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { runAnalyzeJob } from '../ai';
import { useAuth } from '../auth/AuthContext';
import { formatJobText } from '../jobText';
import type { RootStackParamList } from '../navigation/types';
import { createJob } from '../storage';
import { colors, radius, space } from '../theme';
import type { StructuredJD } from '../types';
import { BusyOverlay } from '../ui/BusyOverlay';
import { Button } from '../ui/Button';
import { Field } from '../ui/Fields';
import { JobFields } from '../ui/JobFields';
import { useToast } from '../ui/Toast';

type Nav = NativeStackNavigationProp<RootStackParamList, 'JobNew'>;
type Mode = 'choose' | 'image' | 'manual';

type PickedImage = {
  uri: string;
  base64: string;
  mimeType: string;
};

const MAX_IMAGES = 4;

export function JobNewScreen() {
  const { user } = useAuth();
  const toast = useToast();
  const navigation = useNavigation<Nav>();
  const [mode, setMode] = useState<Mode>('choose');
  const [images, setImages] = useState<PickedImage[]>([]);
  const [manualText, setManualText] = useState('');
  const [analysis, setAnalysis] = useState<StructuredJD | null>(null);
  const [editing, setEditing] = useState(false);
  const [busy, setBusy] = useState(false);
  const [saving, setSaving] = useState(false);

  useLayoutEffect(() => {
    navigation.setOptions({
      title: mode === 'choose' ? '添加岗位' : mode === 'image' ? '图片识别' : '手动输入',
      headerLeft: () => (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="返回"
          hitSlop={10}
          onPress={() => {
            if (mode === 'choose') {
              navigation.goBack();
              return;
            }
            setMode('choose');
          }}
        >
          <Ionicons name="chevron-back" size={28} color={colors.accent} />
        </Pressable>
      ),
    });
  }, [mode, navigation]);

  async function pickImages() {
    if (images.length >= MAX_IMAGES) {
      toast.show(`最多添加 ${MAX_IMAGES} 张图片`);
      return;
    }
    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permission.granted) {
      Alert.alert('需要相册权限', '请允许访问照片以识别岗位截图');
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      allowsMultipleSelection: true,
      selectionLimit: MAX_IMAGES - images.length,
      quality: 0.55,
      base64: true,
    });
    if (result.canceled) {
      return;
    }
    const next: PickedImage[] = [];
    for (const asset of result.assets) {
      const base64 = asset.base64 ?? (await readUriAsBase64(asset.uri));
      if (!base64) {
        continue;
      }
      next.push({
        uri: asset.uri,
        base64,
        mimeType: asset.mimeType || guessMime(asset.uri),
      });
    }
    if (next.length === 0) {
      Alert.alert('没读到图片', '请换一张再试');
      return;
    }
    setImages((prev) => [...prev, ...next].slice(0, MAX_IMAGES));
    setAnalysis(null);
    setEditing(false);
  }

  async function onUpload() {
    if (busy) {
      return;
    }
    if (mode === 'image' && images.length === 0) {
      Alert.alert('请先添加图片');
      return;
    }
    if (mode === 'manual' && !manualText.trim()) {
      Alert.alert('请先填写岗位信息');
      return;
    }
    setBusy(true);
    toast.show('上传成功，正在加载');
    try {
      const structured = await runAnalyzeJob(
        mode === 'image'
          ? {
              images: images.map((item) => ({
                mimeType: item.mimeType,
                base64: item.base64,
              })),
            }
          : { text: manualText.trim() },
      );
      setAnalysis(structured);
      setEditing(false);
    } catch (error) {
      Alert.alert('没做完', error instanceof Error ? error.message : '请稍后重试');
    } finally {
      setBusy(false);
    }
  }

  function onConfirm() {
    if (!user || !analysis || saving) {
      return;
    }
    setSaving(true);
    try {
      const rawJD = (mode === 'manual' ? manualText : formatJobText(analysis)).trim();
      const job = createJob(user.hashid, { rawJD, structured: analysis });
      toast.show('保存成功');
      navigation.replace('JobDetail', { jobId: job.id });
    } catch (error) {
      setSaving(false);
      Alert.alert('没保存', error instanceof Error ? error.message : '请稍后重试');
    }
  }

  return (
    <SafeAreaView style={styles.safe} edges={['bottom']}>
      <BusyOverlay visible={busy} message="正在分析岗位信息…" />
      {mode === 'choose' ? (
        <View style={styles.choose}>
          <MethodButton
            icon="image-outline"
            label="图片识别"
            onPress={() => setMode('image')}
          />
          <MethodButton
            icon="create-outline"
            label="手动输入"
            onPress={() => setMode('manual')}
          />
        </View>
      ) : (
        <KeyboardAvoidingView
          style={styles.flex}
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        >
          <ScrollView
            contentContainerStyle={styles.body}
            keyboardShouldPersistTaps="handled"
          >
            {mode === 'image' ? (
              <View style={styles.block}>
                {images.length > 0 ? (
                  <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                    <View style={styles.thumbs}>
                      {images.map((item, index) => (
                        <View key={`${item.uri}-${index}`} style={styles.thumbWrap}>
                          <Image source={{ uri: item.uri }} style={styles.thumb} />
                          <Pressable
                            accessibilityLabel="去掉这张图"
                            onPress={() => {
                              setImages((prev) => prev.filter((_, i) => i !== index));
                              setAnalysis(null);
                            }}
                            style={styles.thumbRemove}
                          >
                            <Ionicons name="close" size={14} color="#fff" />
                          </Pressable>
                        </View>
                      ))}
                    </View>
                  </ScrollView>
                ) : null}
                <Button variant="ghost" label="添加图片" onPress={() => void pickImages()} />
              </View>
            ) : (
              <Field
                label="岗位信息"
                value={manualText}
                onChangeText={(value) => {
                  setManualText(value);
                  setAnalysis(null);
                  setEditing(false);
                }}
                placeholder="把岗位相关内容都贴在这里"
                multiline
                style={styles.area}
              />
            )}

            <Button
              label="上传岗位信息"
              loading={busy}
              disabled={busy}
              onPress={() => void onUpload()}
            />

            {analysis ? (
              <View style={styles.result}>
                <JobFields value={analysis} editing={editing} onChange={setAnalysis} />
                <View style={styles.resultActions}>
                  <Button
                    variant="ghost"
                    label="修改"
                    style={styles.half}
                    onPress={() => setEditing(true)}
                  />
                  <Button
                    label="确认"
                    loading={saving}
                    disabled={saving}
                    style={styles.half}
                    onPress={onConfirm}
                  />
                </View>
              </View>
            ) : null}
          </ScrollView>
        </KeyboardAvoidingView>
      )}
    </SafeAreaView>
  );
}

function MethodButton({
  icon,
  label,
  onPress,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  onPress: () => void;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      onPress={onPress}
      style={({ pressed }) => [styles.method, pressed && styles.pressed]}
    >
      <Ionicons name={icon} size={28} color={colors.accent} />
      <Text style={styles.methodLabel}>{label}</Text>
    </Pressable>
  );
}

function guessMime(uri: string): string {
  const lower = uri.toLowerCase();
  if (lower.includes('.png')) {
    return 'image/png';
  }
  if (lower.includes('.webp')) {
    return 'image/webp';
  }
  return 'image/jpeg';
}

async function readUriAsBase64(uri: string): Promise<string | null> {
  try {
    const response = await fetch(uri);
    const blob = await response.blob();
    return await new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onloadend = () => {
        const result = String(reader.result ?? '');
        const comma = result.indexOf(',');
        resolve(comma >= 0 ? result.slice(comma + 1) : result);
      };
      reader.onerror = () => reject(new Error('图片读取失败'));
      reader.readAsDataURL(blob);
    });
  } catch {
    return null;
  }
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.bg },
  flex: { flex: 1 },
  choose: {
    flex: 1,
    justifyContent: 'center',
    paddingHorizontal: space.lg,
    gap: space.md,
  },
  method: {
    backgroundColor: colors.paper,
    borderRadius: radius.md,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.line,
    minHeight: 88,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  methodLabel: {
    fontSize: 17,
    fontWeight: '700',
    color: colors.ink,
  },
  pressed: { opacity: 0.82 },
  body: {
    padding: space.lg,
    gap: space.md,
    paddingBottom: 48,
  },
  block: { gap: space.md },
  thumbs: { flexDirection: 'row', gap: space.sm },
  thumbWrap: { position: 'relative' },
  thumb: {
    width: 92,
    height: 92,
    borderRadius: radius.sm,
    backgroundColor: colors.chip,
  },
  thumbRemove: {
    position: 'absolute',
    top: 4,
    right: 4,
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: colors.ink,
    alignItems: 'center',
    justifyContent: 'center',
  },
  area: { minHeight: 320 },
  result: { gap: space.md },
  resultActions: { flexDirection: 'row', gap: space.sm },
  half: { flex: 1 },
});
