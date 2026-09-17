import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect, useNavigation, useRoute, type RouteProp } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useAudioPlayer } from 'expo-audio';
import { useCallback, useLayoutEffect, useState } from 'react';
import { Alert, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useAuth } from '../auth/AuthContext';
import {
  addBankItem,
  cycleProficiency,
  persistBankItem,
  proficiencyColor,
  regenerateItemAudio,
  removeBankItem,
  startReview,
} from '../interview';
import type { RootStackParamList } from '../navigation/types';
import { audioPlayUri, jobExists, loadAiSettings, loadBank, loadJob } from '../storage';
import { colors, radius, space } from '../theme';
import { audioMatches, jobListTitle, jobMetaLine, type Job, type QaBank, type QaItem } from '../types';
import { BusyOverlay } from '../ui/BusyOverlay';
import { Button } from '../ui/Button';
import { CenterSheet } from '../ui/CenterSheet';
import { Field } from '../ui/Fields';
import { SwipeableRow } from '../ui/SwipeableRow';
import { useToast } from '../ui/Toast';

type Nav = NativeStackNavigationProp<RootStackParamList, 'InterviewBank'>;
type R = RouteProp<RootStackParamList, 'InterviewBank'>;

export function InterviewBankScreen() {
  const { user } = useAuth();
  const toast = useToast();
  const insets = useSafeAreaInsets();
  const navigation = useNavigation<Nav>();
  const player = useAudioPlayer(null, { keepAudioSessionActive: true });
  const { bankId } = useRoute<R>().params;
  const [bank, setBank] = useState<QaBank | null>(null);
  const [job, setJob] = useState<Job | null>(null);
  const [busy, setBusy] = useState('');
  const [editing, setEditing] = useState<QaItem | null>(null);
  const [adding, setAdding] = useState(false);
  const [question, setQuestion] = useState('');
  const [answer, setAnswer] = useState('');

  const reload = useCallback(() => {
    if (!user) {
      return;
    }
    const loaded = loadBank(user.hashid, bankId);
    if (!loaded) {
      Alert.alert('问答列表已不存在', '', [{ text: '好', onPress: () => navigation.goBack() }]);
      return;
    }
    setBank(loaded);
    setJob(loaded.jobId ? loadJob(user.hashid, loaded.jobId) : null);
  }, [bankId, navigation, user]);

  useFocusEffect(
    useCallback(() => {
      reload();
    }, [reload]),
  );

  useLayoutEffect(() => {
    navigation.setOptions({
      headerRight: () => (
        <Pressable
          accessibilityLabel="添加问答"
          hitSlop={8}
          onPress={() => {
            setQuestion('');
            setAnswer('');
            setAdding(true);
          }}
        >
          <Ionicons name="add" size={26} color={colors.accent} />
        </Pressable>
      ),
    });
  }, [navigation]);

  function openJob() {
    if (!bank) {
      return;
    }
    if (!user || !jobExists(user.hashid, bank.jobId)) {
      Alert.alert('岗位已不存在');
      return;
    }
    navigation.navigate('JobDetail', { jobId: bank.jobId });
  }

  function openItem(item: QaItem) {
    setEditing(item);
    setQuestion(item.question);
    setAnswer(item.answer);
  }

  function saveItem() {
    if (!user || !editing) {
      return;
    }
    setBank(persistBankItem(user.hashid, bankId, editing.id, { question: question.trim(), answer }));
    setEditing(null);
    toast.show('已保存');
  }

  function addItem() {
    if (!user) {
      return;
    }
    const q = question.trim();
    if (!q) {
      Alert.alert('请填写问题');
      return;
    }
    const next = addBankItem(user.hashid, bankId, { question: q, answer });
    setBank(next);
    setAdding(false);
    toast.show('已添加');
  }

  function onDelete(item: QaItem) {
    if (!user) {
      return;
    }
    const next = removeBankItem(user.hashid, bankId, item.id);
    if (!next.items.length) {
      toast.show('已删除');
      navigation.goBack();
      return;
    }
    setBank(next);
    toast.show('已删除');
  }

  function onCycle(item: QaItem) {
    if (!user) {
      return;
    }
    setBank(cycleProficiency(user.hashid, bankId, item.id));
  }

  async function playItem(item: QaItem) {
    const uri = item.audio ? audioPlayUri(item.audio) : null;
    if (!uri || !audioMatches(item)) {
      Alert.alert('需要重新生成语音', '当前没有可用的问题语音，或语音与问题不一致。');
      return;
    }
    try {
      player.replace({ uri });
      player.play();
    } catch (e) {
      toast.show(e instanceof Error ? e.message : '播放失败');
    }
  }

  async function regen() {
    if (!user || !editing) {
      return;
    }
    setBusy('正在生成语音…');
    try {
      persistBankItem(user.hashid, bankId, editing.id, { question: question.trim(), answer });
      const settings = await loadAiSettings();
      const next = await regenerateItemAudio(user.hashid, bankId, editing.id, settings);
      setBank(next);
      const item = next.items.find((entry) => entry.id === editing.id);
      if (item) {
        setEditing(item);
        setQuestion(item.question);
        setAnswer(item.answer);
      }
      toast.show('语音已更新');
    } catch (e) {
      Alert.alert('没生成', e instanceof Error ? e.message : '请稍后重试');
    } finally {
      setBusy('');
    }
  }

  function review() {
    if (!user || !bank) {
      return;
    }
    if (!jobExists(user.hashid, bank.jobId)) {
      Alert.alert('岗位已不存在');
      return;
    }
    try {
      startReview(user.hashid, bank.jobId);
      navigation.navigate('InterviewSession', { jobId: bank.jobId });
    } catch (e) {
      Alert.alert('还不能复盘', e instanceof Error ? e.message : '请稍后重试');
    }
  }

  if (!bank) {
    return null;
  }

  const title = job ? jobListTitle(job) : bank.title;
  const meta = job ? jobMetaLine(job) : '岗位已不存在';
  const editingMismatch = editing ? !audioMatches({ ...editing, question }) : false;

  return (
    <View style={styles.safe}>
      <BusyOverlay visible={Boolean(busy)} message={busy} />
      <Pressable onPress={openJob} style={({ pressed }) => [styles.job, pressed && styles.pressed]}>
        <Text style={styles.title}>{title}</Text>
        <Text style={styles.meta}>{meta || '查看岗位'}</Text>
        {job?.rawJD ? (
          <Text style={styles.snippet} numberOfLines={4}>
            {job.rawJD}
          </Text>
        ) : null}
      </Pressable>
      <ScrollView contentContainerStyle={[styles.list, { paddingBottom: 88 + Math.max(insets.bottom, space.sm) }]}>
        {bank.items.map((item) => (
          <SwipeableRow key={item.id} onDelete={() => onDelete(item)}>
            <View style={styles.row}>
              <Pressable style={styles.rowMain} onPress={() => openItem(item)}>
                <Text style={styles.q} numberOfLines={2}>
                  {item.question || '未填写问题'}
                </Text>
                <Text style={styles.a} numberOfLines={1}>
                  {item.answer.trim() || '还没有答案'}
                </Text>
              </Pressable>
              <Pressable
                onPress={() => onCycle(item)}
                style={[styles.dot, { backgroundColor: proficiencyColor(item.proficiency) }]}
              >
                <Text style={styles.dotText}>
                  {item.proficiency === 1 ? '熟' : item.proficiency === 2 ? '待' : '生'}
                </Text>
              </Pressable>
            </View>
          </SwipeableRow>
        ))}
      </ScrollView>
      <View style={[styles.bar, { paddingBottom: Math.max(insets.bottom, space.sm) }]}>
        <Button label="模拟复盘" onPress={review} />
      </View>

      <CenterSheet visible={Boolean(editing)} onClose={() => setEditing(null)}>
        <Text style={styles.sheetTitle}>问答</Text>
        <Field label="问题" value={question} onChangeText={setQuestion} multiline />
        {editingMismatch ? <Text style={styles.warn}>问题与语音不一致，请重新生成语音。</Text> : null}
        <View style={styles.sheetActions}>
          <Button
            variant="ghost"
            label="播放"
            style={styles.half}
            onPress={() => {
              if (editing) {
                void playItem({ ...editing, question, answer });
              }
            }}
          />
          <Button variant="ghost" label="生成语音" style={styles.half} onPress={() => void regen()} />
        </View>
        <Field label="答案" value={answer} onChangeText={setAnswer} multiline />
        <Button label="保存" onPress={saveItem} />
      </CenterSheet>

      <CenterSheet visible={adding} onClose={() => setAdding(false)}>
        <Text style={styles.sheetTitle}>添加问答</Text>
        <Field label="问题" value={question} onChangeText={setQuestion} multiline />
        <Field label="答案" value={answer} onChangeText={setAnswer} multiline />
        <Button label="添加" onPress={addItem} />
      </CenterSheet>
    </View>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.bg },
  job: {
    marginHorizontal: space.lg,
    marginTop: space.sm,
    marginBottom: space.sm,
    backgroundColor: colors.paper,
    borderRadius: radius.md,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.line,
    padding: space.md,
    gap: 6,
  },
  title: { fontSize: 20, fontWeight: '800', color: colors.ink },
  meta: { color: colors.muted, fontSize: 13 },
  snippet: { color: colors.ink, fontSize: 14, lineHeight: 20 },
  list: { paddingTop: 4, paddingBottom: 48 },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: space.md,
    paddingVertical: 12,
    gap: space.sm,
    backgroundColor: colors.paper,
  },
  rowMain: { flex: 1, gap: 4 },
  q: { fontSize: 16, fontWeight: '700', color: colors.ink },
  a: { fontSize: 13, color: colors.muted },
  dot: {
    minWidth: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 8,
  },
  dotText: { color: '#fff', fontWeight: '800', fontSize: 13 },
  bar: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    paddingHorizontal: space.lg,
    paddingTop: space.sm,
    backgroundColor: colors.paper,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.line,
  },
  pressed: { opacity: 0.82 },
  sheetTitle: { fontSize: 17, fontWeight: '700', color: colors.ink },
  warn: { color: colors.danger, fontSize: 13, lineHeight: 18 },
  sheetActions: { flexDirection: 'row', gap: space.sm },
  half: { flex: 1 },
});
