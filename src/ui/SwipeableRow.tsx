import { useRef, type ReactNode } from 'react';
import { Platform, StyleSheet, Text, View } from 'react-native';
import { RectButton, Swipeable } from 'react-native-gesture-handler';

import { colors, radius, space } from '../theme';

export function SwipeableRow({
  children,
  onDelete,
}: {
  children: ReactNode;
  onDelete: () => void;
}) {
  const swipeRef = useRef<Swipeable>(null);

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
        renderRightActions={() => (
          <DeleteAction
            onPress={() => {
              swipeRef.current?.close();
              onDelete();
            }}
          />
        )}
        renderLeftActions={() => (
          <DeleteAction
            onPress={() => {
              swipeRef.current?.close();
              onDelete();
            }}
          />
        )}
      >
        {children}
      </Swipeable>
    </View>
  );
}

function DeleteAction({ onPress }: { onPress: () => void }) {
  return (
    <RectButton
      accessibilityRole="button"
      accessibilityLabel="删除"
      style={styles.delete}
      onPress={onPress}
    >
      <Text style={styles.deleteText}>删除</Text>
    </RectButton>
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
  delete: {
    width: 88,
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
