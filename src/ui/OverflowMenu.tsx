import { Ionicons } from '@expo/vector-icons';
import { Modal, Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { colors, radius, space } from '../theme';

export type OverflowMenuItem = {
  label: string;
  disabled?: boolean;
  onPress: () => void;
};

export function HeaderMoreButton({
  onPress,
  disabled,
}: {
  onPress: () => void;
  disabled?: boolean;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel="更多"
      hitSlop={8}
      disabled={disabled}
      onPress={onPress}
      style={({ pressed }) => [styles.moreBtn, pressed && styles.pressed]}
    >
      <Ionicons name="ellipsis-horizontal" size={22} color={colors.accent} />
    </Pressable>
  );
}

export function OverflowMenu({
  visible,
  onClose,
  items,
}: {
  visible: boolean;
  onClose: () => void;
  items: OverflowMenuItem[];
}) {
  const insets = useSafeAreaInsets();

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <View style={styles.root}>
        <Pressable style={styles.mask} onPress={onClose} />
        <View
          pointerEvents="box-none"
          style={[
            styles.anchor,
            { paddingTop: insets.top + 44, paddingRight: Math.max(insets.right, 8) },
          ]}
        >
          <View style={styles.menu}>
            {items.map((item, index) => (
              <Pressable
                key={item.label}
                accessibilityRole="button"
                disabled={item.disabled}
                onPress={() => {
                  onClose();
                  item.onPress();
                }}
                style={({ pressed }) => [
                  styles.item,
                  index > 0 && styles.itemBorder,
                  item.disabled && styles.disabled,
                  pressed && !item.disabled && styles.pressed,
                ]}
              >
                <Text style={[styles.label, item.disabled && styles.disabledLabel]}>{item.label}</Text>
              </Pressable>
            ))}
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  moreBtn: {
    width: 36,
    height: 36,
    alignItems: 'center',
    justifyContent: 'center',
  },
  root: {
    flex: 1,
  },
  mask: {
    ...StyleSheet.absoluteFill,
    backgroundColor: 'rgba(26,23,20,0.28)',
  },
  anchor: {
    flex: 1,
    alignItems: 'flex-end',
  },
  menu: {
    minWidth: 188,
    backgroundColor: colors.paper,
    borderRadius: radius.md,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.line,
    overflow: 'hidden',
  },
  item: {
    paddingHorizontal: space.lg,
    paddingVertical: 14,
  },
  itemBorder: {
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.line,
  },
  label: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.ink,
  },
  disabled: {
    opacity: 0.45,
  },
  disabledLabel: {
    color: colors.muted,
  },
  pressed: {
    opacity: 0.72,
  },
});
