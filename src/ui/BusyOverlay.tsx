import { ActivityIndicator, Modal, StyleSheet, Text, View } from 'react-native';

import { colors, radius, space } from '../theme';

export function BusyOverlay({ visible, message }: { visible: boolean; message: string }) {
  return (
    <Modal visible={visible} transparent animationType="fade">
      <View style={styles.mask}>
        <View style={styles.box}>
          <ActivityIndicator color={colors.accent} size="large" />
          <Text style={styles.text}>{message}</Text>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  mask: {
    flex: 1,
    backgroundColor: 'rgba(26,23,20,0.28)',
    alignItems: 'center',
    justifyContent: 'center',
    padding: space.lg,
  },
  box: {
    backgroundColor: colors.paper,
    borderRadius: radius.lg,
    padding: space.lg,
    minWidth: 220,
    alignItems: 'center',
    gap: space.md,
  },
  text: {
    color: colors.ink,
    fontSize: 15,
    textAlign: 'center',
  },
});
