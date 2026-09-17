import { useFocusEffect, useNavigation } from '@react-navigation/native';
import type { CompositeNavigationProp } from '@react-navigation/native';
import type { BottomTabNavigationProp } from '@react-navigation/bottom-tabs';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useCallback, useState } from 'react';
import { Alert, StyleSheet } from 'react-native';
import { ScrollView } from 'react-native-gesture-handler';

import { useAuth } from '../auth/AuthContext';
import type { MainTabParamList, RootStackParamList } from '../navigation/types';
import { deleteBank, listBanks, loadJob } from '../storage';
import { jobListTitle, type QaBank } from '../types';
import { AppShell } from '../ui/AppShell';
import { GiantAction } from '../ui/GiantAction';
import { ListRow } from '../ui/ListRow';
import { SwipeableRow } from '../ui/SwipeableRow';
import { useToast } from '../ui/Toast';

type Nav = CompositeNavigationProp<
  BottomTabNavigationProp<MainTabParamList, 'InterviewTab'>,
  NativeStackNavigationProp<RootStackParamList>
>;

export function InterviewPickScreen() {
  const { user } = useAuth();
  const toast = useToast();
  const navigation = useNavigation<Nav>();
  const [banks, setBanks] = useState<QaBank[]>([]);

  const reload = useCallback(() => {
    if (user) {
      setBanks(listBanks(user.hashid));
    }
  }, [user]);

  useFocusEffect(
    useCallback(() => {
      reload();
    }, [reload]),
  );

  function onDelete(bank: QaBank) {
    if (!user) {
      return;
    }
    Alert.alert('删除问答', '确定删除该岗位已保存的问答列表？', [
      { text: '取消', style: 'cancel' },
      {
        text: '删除',
        style: 'destructive',
        onPress: () => {
          deleteBank(user.hashid, bank.id);
          setBanks((prev) => prev.filter((item) => item.id !== bank.id));
          toast.show('已删除问答');
        },
      },
    ]);
  }

  return (
    <AppShell>
      {banks.length === 0 ? (
        <GiantAction label="去岗位开始面试问答" onPress={() => navigation.navigate('JobsTab')} />
      ) : (
        <ScrollView contentContainerStyle={styles.list}>
          {banks.map((bank) => (
            <SwipeableRow key={bank.id} onDelete={() => onDelete(bank)}>
              <ListRow
                flush
                title={bankTitle(user?.hashid ?? '', bank)}
                subtitle={`${bank.items.length} 题`}
                onPress={() => navigation.navigate('InterviewBank', { bankId: bank.id })}
              />
            </SwipeableRow>
          ))}
        </ScrollView>
      )}
    </AppShell>
  );
}

function bankTitle(hashid: string, bank: QaBank): string {
  const job = bank.jobId ? loadJob(hashid, bank.jobId) : null;
  return job ? jobListTitle(job) : bank.title;
}

const styles = StyleSheet.create({
  list: {
    paddingTop: 4,
    paddingBottom: 48,
  },
});
