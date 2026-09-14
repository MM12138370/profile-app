import { useRef, type ReactNode } from 'react';
import { Platform, StyleSheet, Text, View } from 'react-native';
import { RectButton, Swipeable } from 'react-native-gesture-handler';

import { colors, radius, space } from '../theme';

export function SwipeableRow({
  children,
  onDelete,
  onNote,
}: {
  children: ReactNode;
  onDelete: () => void;
  onNote?: () => void;
}) {
  const swipeRef = useRef<Swipeable>(null);
  const lock = useRef(false);

  function close() {
    swipeRef.current?.close();
  }

  function remove() {
    if (lock.current) {
      return;
    }
    lock.current = true;
    close();
    onDelete();
  }

  function note() {
    close();
    onNote?.();
  }

  const actions = <Actions onDelete={remove} onNote={onNote ? note : undefined} />;

  return (
    <View style={styles.outer}>
      <Swipeable
        ref={swipeRef}
        friction={2}
        leftThreshold={36}
        rightThreshold={36}
        overshootLeft={false}
        overshootRight={false}
        useNativeAnimations={Platform.OS !== 'web'}
        childrenContainerStyle={styles.front}
        renderRightActions={() => actions}
        renderLeftActions={() => actions}
      >
        {children}
      </Swipeable>
    </View>
  );
}

function Actions({
  onDelete,
  onNote,
}: {
  onDelete: () => void;
  onNote?: () => void;
}) {
  return (
    <View style={styles.actions}>
      {onNote ? (
        <RectButton
          accessibilityRole="button"
          accessibilityLabel="备注"
          style={styles.note}
          onPress={onNote}
        >
          <Text style={styles.noteText}>备注</Text>
        </RectButton>
      ) : null}
      <RectButton
        accessibilityRole="button"
        accessibilityLabel="删除"
        style={styles.delete}
        onPress={onDelete}
      >
        <Text style={styles.deleteText}>删除</Text>
      </RectButton>
    </View>
  );
}

const styles = StyleSheet.create({
  outer: {
    marginHorizontal: space.lg,
    marginBottom: space.sm,
    borderRadius: radius.md,
    overflow: 'hidden',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.line,
    backgroundColor: colors.paper,
  },
  front: {
    backgroundColor: colors.paper,
  },
  actions: {
    flexDirection: 'row',
    alignSelf: 'stretch',
  },
  note: {
    width: 80,
    alignSelf: 'stretch',
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: colors.accent,
  },
  noteText: {
    color: '#fff',
    fontSize: 15,
    fontWeight: '700',
  },
  delete: {
    width: 80,
    alignSelf: 'stretch',
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: colors.danger,
  },
  deleteText: {
    color: '#fff',
    fontSize: 15,
    fontWeight: '700',
  },
});
