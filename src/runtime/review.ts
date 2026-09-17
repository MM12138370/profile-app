import { archivedAudioUri, loadBank } from '../storage';
import type { Proficiency, QaItem, QaTurn } from '../types';

export function startReview(
  hashid: string,
  bankId: string,
  itemIds: string[],
): { session: QaTurn[]; sessionIndex: number } {
  const bank = loadBank(hashid, bankId);
  if (!bank) {
    throw new Error('问答列表已不存在');
  }
  const selected = shuffleByProficiency(
    bank.items.filter((item) => itemIds.includes(item.id) && archivedAudioUri(item)),
  );
  if (!selected.length) {
    throw new Error('请勾选已保存语音的问题');
  }
  return {
    session: selected.map((item) => ({
      id: item.id,
      question: item.question,
      audio: item.audio,
      audioText: item.audioText,
      answer: '',
    })),
    sessionIndex: 0,
  };
}

function shuffleByProficiency(items: QaItem[]): QaItem[] {
  const buckets: Record<Proficiency, QaItem[]> = { 1: [], 2: [], 3: [] };
  for (const item of items) {
    buckets[item.proficiency].push(item);
  }
  return ([3, 2, 1] as const).flatMap((level) => shuffle(buckets[level]));
}

function shuffle<T>(items: T[]): T[] {
  const next = [...items];
  for (let i = next.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [next[i], next[j]] = [next[j], next[i]];
  }
  return next;
}
