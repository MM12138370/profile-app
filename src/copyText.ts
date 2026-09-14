import { Share } from 'react-native';

export async function copyText(text: string): Promise<'copied' | 'shared'> {
  const value = text.trim();
  if (!value) {
    throw new Error('没有可复制的内容');
  }
  const clipboard = typeof navigator !== 'undefined' ? navigator.clipboard : undefined;
  if (clipboard?.writeText) {
    await clipboard.writeText(value);
    return 'copied';
  }
  await Share.share({ message: value });
  return 'shared';
}
