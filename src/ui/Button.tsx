import { useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  Text,
  type GestureResponderEvent,
  type PressableProps,
  type StyleProp,
  type ViewStyle,
} from 'react-native';

import { colors, radius, space } from '../theme';

type Variant = 'primary' | 'ghost' | 'danger';

type Props = Omit<PressableProps, 'onPress'> & {
  label: string;
  variant?: Variant;
  loading?: boolean;
  style?: StyleProp<ViewStyle>;
  debounceMs?: number;
  onPress?: (event: GestureResponderEvent) => void | Promise<void>;
};

export function Button({
  label,
  variant = 'primary',
  loading,
  disabled,
  style,
  debounceMs = 700,
  onPress,
  ...rest
}: Props) {
  const lock = useRef(false);
  const mounted = useRef(true);
  const [busy, setBusy] = useState(false);
  const isPrimary = variant === 'primary';
  const isDanger = variant === 'danger';
  const blocked = disabled || loading || busy;

  useEffect(() => {
    return () => {
      mounted.current = false;
    };
  }, []);

  async function handlePress(event: GestureResponderEvent) {
    if (blocked || lock.current || !onPress) {
      return;
    }
    lock.current = true;
    setBusy(true);
    try {
      await onPress(event);
    } finally {
      setTimeout(() => {
        lock.current = false;
        if (mounted.current) {
          setBusy(false);
        }
      }, debounceMs);
    }
  }

  return (
    <Pressable
      accessibilityRole="button"
      disabled={blocked}
      onPress={(event) => void handlePress(event)}
      style={({ pressed }) => [
        styles.base,
        isPrimary && styles.primary,
        variant === 'ghost' && styles.ghost,
        isDanger && styles.danger,
        blocked && styles.disabled,
        pressed && styles.pressed,
        style,
      ]}
      {...rest}
    >
      {loading ? (
        <ActivityIndicator color={isPrimary || isDanger ? '#fff' : colors.accent} />
      ) : (
        <Text
          style={[
            styles.label,
            isPrimary && styles.primaryLabel,
            variant === 'ghost' && styles.ghostLabel,
            isDanger && styles.dangerLabel,
          ]}
        >
          {label}
        </Text>
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  base: {
    minHeight: 40,
    borderRadius: radius.sm,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: space.md,
  },
  primary: {
    backgroundColor: colors.accent,
  },
  ghost: {
    backgroundColor: colors.accentSoft,
  },
  danger: {
    backgroundColor: colors.danger,
  },
  disabled: {
    opacity: 0.5,
  },
  pressed: {
    opacity: 0.82,
  },
  label: {
    fontSize: 15,
    fontWeight: '600',
  },
  primaryLabel: {
    color: '#fff',
  },
  ghostLabel: {
    color: colors.accent,
  },
  dangerLabel: {
    color: '#fff',
  },
});
