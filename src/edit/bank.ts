import { deleteBank, loadBank, saveBank } from '../storage';
import { deleteFile } from '../storage/io';
import { emptyQaTurn, nextProficiency, type AiSettings, type Proficiency, type QaBank, type QaItem } from '../types';
import { writeQaAudio } from './audio';

function requireBank(hashid: string, bankId: string): QaBank {
  const bank = loadBank(hashid, bankId);
  if (!bank) {
    throw new Error('问答列表已不存在');
  }
  return bank;
}

export function persistBankItem(
  hashid: string,
  bankId: string,
  itemId: string,
  patch: Partial<Pick<QaItem, 'question' | 'answer' | 'audio' | 'audioText'>>,
): QaBank {
  const bank = requireBank(hashid, bankId);
  return saveBank(hashid, {
    ...bank,
    items: bank.items.map((item) => {
      if (item.id !== itemId) {
        return item;
      }
      const next = { ...item, ...patch };
      if (patch.question !== undefined && patch.question !== item.question && patch.audio === undefined && item.audio) {
        deleteFile(item.audio);
        next.audio = '';
        next.audioText = '';
      }
      return next;
    }),
  });
}

export function addBankItem(hashid: string, bankId: string, input: { question: string; answer: string }): QaBank {
  const bank = requireBank(hashid, bankId);
  const item: QaItem = {
    ...emptyQaTurn(input.question.trim()),
    answer: input.answer.trim(),
    proficiency: 3,
  };
  return saveBank(hashid, { ...bank, items: [item, ...bank.items] });
}

export function removeBankItem(hashid: string, bankId: string, itemId: string): QaBank {
  const bank = requireBank(hashid, bankId);
  const item = bank.items.find((entry) => entry.id === itemId);
  if (item?.audio) {
    deleteFile(item.audio);
  }
  const items = bank.items.filter((entry) => entry.id !== itemId);
  if (!items.length) {
    deleteBank(hashid, bankId);
    return { ...bank, items };
  }
  return saveBank(hashid, { ...bank, items });
}

export function cycleProficiency(hashid: string, bankId: string, itemId: string): QaBank {
  const bank = requireBank(hashid, bankId);
  return saveBank(hashid, {
    ...bank,
    items: bank.items.map((item) =>
      item.id === itemId ? { ...item, proficiency: nextProficiency(item.proficiency) } : item,
    ),
  });
}

export async function generateItemAudio(
  hashid: string,
  bankId: string,
  itemId: string,
  settings: AiSettings,
): Promise<QaBank> {
  const bank = requireBank(hashid, bankId);
  const item = bank.items.find((entry) => entry.id === itemId);
  if (!item) {
    throw new Error('问答已不存在');
  }
  const next = await writeQaAudio(hashid, item, settings);
  return persistBankItem(hashid, bankId, itemId, { audio: next.audio, audioText: next.audioText });
}

export function proficiencyColor(value: Proficiency): string {
  return value === 1 ? '#2F6B4F' : value === 2 ? '#9A6B12' : '#A33B2B';
}
