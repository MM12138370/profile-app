import { type ReactNode } from 'react';
import { Modal, Pressable, StyleSheet } from 'react-native';

import { colors, radius, space } from '../theme';

export function CenterSheet({
  visible,
  onClose,
  children,
}: {
  visible: boolean;
  onClose: () => void;
  children: ReactNode;
}) {
  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <Pressable style={styles.mask} onPress={onClose}>
        <Pressable style={styles.sheet} onPress={(event) => event.stopPropagation()}>
          {children}
        </Pressable>
      </Pressable>
    </Modal>
  );
}

const styles = StyleSheet.create({
  mask: {
    flex: 1,
    backgroundColor: 'rgba(26,23,20,0.28)',
    justifyContent: 'center',
    padding: space.lg,
  },
  sheet: {
    backgroundColor: colors.paper,
    borderRadius: radius.lg,
    padding: space.lg,
    gap: space.md,
    maxHeight: '80%',
  },
});
