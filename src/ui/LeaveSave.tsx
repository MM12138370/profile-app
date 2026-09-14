import {
  useNavigation,
  type NavigationAction,
  type NavigationProp,
  type ParamListBase,
} from '@react-navigation/native';
import { useCallback, useEffect, useRef, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { colors, radius, space } from '../theme';
import { Button } from './Button';

export function useLeaveSavePrompt({
  dirty,
  persist,
}: {
  dirty: boolean;
  persist: () => void;
}) {
  const navigation = useNavigation<NavigationProp<ParamListBase>>();
  const dirtyRef = useRef(dirty);
  const persistRef = useRef(persist);
  dirtyRef.current = dirty;
  persistRef.current = persist;

  const allowLeave = useRef(false);
  const pending = useRef<NavigationAction | null>(null);
  const [visible, setVisible] = useState(false);

  const finish = useCallback(
    (action: NavigationAction | null) => {
      allowLeave.current = true;
      setVisible(false);
      pending.current = null;
      if (action) {
        navigation.dispatch(action);
      } else {
        navigation.goBack();
      }
    },
    [navigation],
  );

  const requestLeave = useCallback(() => {
    if (!dirtyRef.current) {
      finish(null);
      return;
    }
    pending.current = null;
    setVisible(true);
  }, [finish]);

  useEffect(() => {
    const sub = navigation.addListener('beforeRemove', (e) => {
      if (allowLeave.current || !dirtyRef.current) {
        return;
      }
      e.preventDefault();
      pending.current = e.data.action;
      setVisible(true);
    });
    return sub;
  }, [navigation]);

  const confirmSave = useCallback(() => {
    persistRef.current();
    finish(pending.current);
  }, [finish]);

  const confirmDiscard = useCallback(() => {
    finish(pending.current);
  }, [finish]);

  const closePrompt = useCallback(() => {
    pending.current = null;
    setVisible(false);
  }, []);

  const saveAndLeave = useCallback(() => {
    persistRef.current();
    finish(null);
  }, [finish]);

  return {
    promptVisible: visible,
    requestLeave,
    confirmSave,
    confirmDiscard,
    closePrompt,
    saveAndLeave,
  };
}

export function SavePromptOverlay({
  visible,
  onSave,
  onDiscard,
  onContinue,
}: {
  visible: boolean;
  onSave: () => void;
  onDiscard: () => void;
  onContinue: () => void;
}) {
  if (!visible) {
    return null;
  }
  return (
    <View style={styles.overlay} pointerEvents="box-none">
      <Pressable style={styles.mask} onPress={onContinue} />
      <View style={styles.dialog}>
        <Text style={styles.title}>保存修改？</Text>
        <Text style={styles.body}>不保存则丢掉这次填写。</Text>
        <Button label="保存" onPress={onSave} />
        <Button variant="danger" label="不保存" onPress={onDiscard} />
        <Button variant="ghost" label="继续编辑" onPress={onContinue} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  overlay: {
    ...StyleSheet.absoluteFill,
    zIndex: 50,
    elevation: 50,
    alignItems: 'center',
    justifyContent: 'center',
    padding: space.lg,
  },
  mask: {
    ...StyleSheet.absoluteFill,
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
  title: {
    fontSize: 18,
    fontWeight: '700',
    color: colors.ink,
  },
  body: {
    fontSize: 14,
    lineHeight: 20,
    color: colors.muted,
    marginBottom: space.xs,
  },
});
