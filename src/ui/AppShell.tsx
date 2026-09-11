import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { type ReactNode } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import type { RootStackParamList } from '../navigation/types';
import { colors, space } from '../theme';

type Props = {
  children: ReactNode;
  showAdd?: boolean;
  onAdd?: () => void;
};

export function AppShell({ children, showAdd, onAdd }: Props) {
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <View style={styles.bar}>
        <View style={styles.side}>
          {showAdd ? (
            <Pressable
              accessibilityLabel="添加"
              hitSlop={10}
              onPress={onAdd}
              style={({ pressed }) => [styles.iconBtn, pressed && styles.pressed]}
            >
              <Ionicons name="add" size={26} color={colors.ink} />
            </Pressable>
          ) : null}
        </View>
        <View style={[styles.side, styles.right]}>
          <Pressable
            accessibilityLabel="设置"
            hitSlop={10}
            onPress={() => navigation.navigate('Settings')}
            style={({ pressed }) => [styles.iconBtn, pressed && styles.pressed]}
          >
            <Ionicons name="settings-outline" size={22} color={colors.ink} />
          </Pressable>
        </View>
      </View>
      <View style={styles.body}>{children}</View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: colors.bg,
  },
  bar: {
    minHeight: 44,
    paddingHorizontal: space.lg,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  side: {
    width: 44,
    height: 44,
    justifyContent: 'center',
  },
  right: {
    alignItems: 'flex-end',
  },
  iconBtn: {
    width: 44,
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
  },
  pressed: {
    opacity: 0.55,
  },
  body: {
    flex: 1,
  },
});
