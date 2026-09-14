import { createContext, useCallback, useContext, useRef, useState, type ReactNode } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { colors, radius, space } from '../theme';

type ToastApi = {
  show: (message: string) => void;
};

const ToastContext = createContext<ToastApi>({ show: () => undefined });

export function ToastHost({ children }: { children: ReactNode }) {
  const insets = useSafeAreaInsets();
  const [message, setMessage] = useState<string | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const show = useCallback((text: string) => {
    if (timer.current) {
      clearTimeout(timer.current);
    }
    setMessage(text);
    timer.current = setTimeout(() => setMessage(null), 1600);
  }, []);

  return (
    <ToastContext.Provider value={{ show }}>
      {children}
      {message ? (
        <View pointerEvents="none" style={[styles.wrap, { bottom: insets.bottom + 72 }]}>
          <View style={styles.bubble}>
            <Text style={styles.text}>{message}</Text>
          </View>
        </View>
      ) : null}
    </ToastContext.Provider>
  );
}

export function useToast() {
  return useContext(ToastContext);
}

const styles = StyleSheet.create({
  wrap: {
    ...StyleSheet.absoluteFill,
    top: undefined,
    alignItems: 'center',
    zIndex: 80,
    elevation: 80,
  },
  bubble: {
    backgroundColor: colors.ink,
    borderRadius: radius.pill,
    paddingHorizontal: space.lg,
    paddingVertical: 10,
    maxWidth: '80%',
  },
  text: {
    color: '#fff',
    fontSize: 15,
    fontWeight: '600',
  },
});
