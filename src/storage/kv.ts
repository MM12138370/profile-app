import { Platform } from 'react-native';
import * as SecureStore from 'expo-secure-store';

const PREFIX = 'zhimian.kv:';

export async function kvGet(key: string): Promise<string | null> {
  if (Platform.OS === 'web') {
    return globalThis.localStorage?.getItem(PREFIX + key) ?? null;
  }
  return SecureStore.getItemAsync(key);
}

export async function kvSet(key: string, value: string): Promise<void> {
  if (Platform.OS === 'web') {
    globalThis.localStorage?.setItem(PREFIX + key, value);
    return;
  }
  await SecureStore.setItemAsync(key, value);
}

export async function kvRemove(key: string): Promise<void> {
  if (Platform.OS === 'web') {
    globalThis.localStorage?.removeItem(PREFIX + key);
    return;
  }
  await SecureStore.deleteItemAsync(key);
}
