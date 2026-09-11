import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useCallback, useEffect, useMemo, useRef } from 'react';
import { Animated, AppState, Pressable, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { useAuth } from '../auth/AuthContext';
import type { RootStackParamList } from '../navigation/types';
import { colors, space, type } from '../theme';
import { userLabel } from '../types';
import { pickWelcomeQuote } from '../welcomeQuote';

type Nav = NativeStackNavigationProp<RootStackParamList, 'Welcome'>;

export function WelcomeScreen() {
  const { user } = useAuth();
  const navigation = useNavigation<Nav>();
  const going = useRef(false);
  const opacity = useRef(new Animated.Value(0)).current;
  const quote = useMemo(() => pickWelcomeQuote(), []);
  const name = user ? userLabel(user) : '';

  const enter = useCallback(() => {
    if (going.current) {
      return;
    }
    going.current = true;
    navigation.replace('Main');
  }, [navigation]);

  useEffect(() => {
    Animated.timing(opacity, {
      toValue: 1,
      duration: 700,
      useNativeDriver: true,
    }).start();

    let timer: ReturnType<typeof setTimeout> | null = setTimeout(enter, 2600);
    const sub = AppState.addEventListener('change', (state) => {
      if (state !== 'active') {
        if (timer) {
          clearTimeout(timer);
          timer = null;
        }
        return;
      }
      if (!going.current && !timer) {
        timer = setTimeout(enter, 1200);
      }
    });

    return () => {
      if (timer) {
        clearTimeout(timer);
      }
      sub.remove();
    };
  }, [enter, opacity]);

  return (
    <SafeAreaView style={styles.safe}>
      <Pressable style={styles.flex} onPress={enter}>
        <Animated.View style={[styles.center, { opacity }]}>
          <Text style={styles.hello}>{name}，欢迎您！</Text>
          <View style={styles.gap} />
          <Text style={styles.quote}>{quote}</Text>
        </Animated.View>
      </Pressable>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: colors.bg,
  },
  flex: {
    flex: 1,
  },
  center: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 48,
    marginTop: -36,
  },
  hello: {
    ...type.welcome,
    textAlign: 'center',
  },
  gap: {
    height: space.lg,
  },
  quote: {
    ...type.quote,
    textAlign: 'center',
    maxWidth: 280,
  },
});
