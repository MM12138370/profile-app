import { runGenerateQa } from './ai';
import { synthesizeSpeech } from './ai/speech';
import {
  createBank,
  deleteBank,
  dropSessionAudio,
  jobExists,
  loadBank,
  loadComposedProfile,
  loadJob,
  prepareAudioRel,
  resumeExists,
  saveBank,
  saveJob,
} from './storage';
import { deleteFile, pathExists } from './storage/io';
import {
  emptyQaTurn,
  jobListTitle,
  nextProficiency,
  speechConfigured,
  type AiSettings,
  type InterviewStatus,
  type Job,
  type Proficiency,
  type QaBank,
  type QaItem,
  type QaTurn,
} from './types';

const liveGenerate = new Map<string, number>();

function requireJob(hashid: string, jobId: string): Job {
  const job = loadJob(hashid, jobId);
  if (!job) {
    throw new Error('岗位已不存在');
  }
  return job;
}

function requireBank(hashid: string, bankId: string): QaBank {
  const bank = loadBank(hashid, bankId);
  if (!bank) {
    throw new Error('问答列表已不存在');
  }
  return bank;
}

export function viewStatus(job: Job): InterviewStatus {
  if (liveGenerate.has(job.id)) {
    return 'generating';
  }
  return job.session.length > 0 ? 'active' : 'idle';
}

export async function generateInterview(
  hashid: string,
  jobId: string,
  input: { resumeId: string; count: number; focus: string },
  onUpdate?: (job: Job) => void,
): Promise<Job> {
  const job = requireJob(hashid, jobId);
  if (viewStatus(job) !== 'idle') {
    throw new Error('请先结束当前面试');
  }
  if (!job.structured) {
    throw new Error('请先查看结构化结果');
  }
  const count = Math.min(20, Math.max(1, Math.round(input.count) || 5));
  const token = (liveGenerate.get(jobId) ?? 0) + 1;
  liveGenerate.set(jobId, token);
  const generating = saveJob(hashid, {
    ...job,
    resumeId: input.resumeId,
    interviewStatus: 'generating',
  });
  onUpdate?.(generating);
  try {
    const bank = generating.bankId ? loadBank(hashid, generating.bankId) : null;
    const profile =
      input.resumeId && resumeExists(hashid, input.resumeId)
        ? loadComposedProfile(hashid, input.resumeId)
        : null;
    const questions = await runGenerateQa({
      jd: generating.structured!,
      profile,
      avoid: bank?.items.map((item) => item.question) ?? [],
      count,
      focus: input.focus,
    });
    if (liveGenerate.get(jobId) !== token) {
      return requireJob(hashid, jobId);
    }
    const next = saveJob(hashid, {
      ...requireJob(hashid, jobId),
      resumeId: input.resumeId,
      interviewStatus: 'active',
      sessionKind: 'fresh',
      session: questions.map((question) => emptyQaTurn(question)),
      sessionIndex: 0,
    });
    onUpdate?.(next);
    return next;
  } catch (error) {
    if (liveGenerate.get(jobId) === token) {
      const failed = saveJob(hashid, {
        ...requireJob(hashid, jobId),
        interviewStatus: 'idle',
        session: [],
        sessionIndex: 0,
        sessionKind: 'fresh',
      });
      onUpdate?.(failed);
    }
    throw error;
  } finally {
    if (liveGenerate.get(jobId) === token) {
      liveGenerate.delete(jobId);
    }
  }
}

export function startReview(hashid: string, jobId: string): Job {
  const job = requireJob(hashid, jobId);
  if (viewStatus(job) !== 'idle') {
    throw new Error('请先结束当前面试');
  }
  const bank = job.bankId ? loadBank(hashid, job.bankId) : null;
  if (!bank?.items.length) {
    throw new Error('还没有可复盘的问答');
  }
  return saveJob(hashid, {
    ...job,
    interviewStatus: 'active',
    sessionKind: 'review',
    session: shuffleByProficiency(bank.items).map((item) => ({
      id: item.id,
      question: item.question,
      audio: item.audio,
      audioText: item.audioText,
      answer: '',
    })),
    sessionIndex: 0,
  });
}

export function answerTurn(hashid: string, jobId: string, text: string): Job {
  const job = requireJob(hashid, jobId);
  const answer = text.trim();
  const index = job.sessionIndex;
  const current = job.session[index];
  if (!answer || !current) {
    return job;
  }
  return saveJob(hashid, {
    ...job,
    session: job.session.map((item, i) => (i === index ? { ...item, answer } : item)),
    sessionIndex: index + 1,
  });
}

export function commitSession(hashid: string, jobId: string, ids: string[]): Job {
  const job = requireJob(hashid, jobId);
  const picked = job.session.filter((item) => ids.includes(item.id));
  const keep = new Set(picked.map((item) => item.id));
  let bank = job.bankId ? loadBank(hashid, job.bankId) : null;
  if (job.sessionKind === 'review') {
    if (bank) {
      const answers = new Map(picked.map((item) => [item.id, item.answer.trim()]));
      bank = saveBank(hashid, {
        ...bank,
        title: jobExists(hashid, bank.jobId) ? jobListTitle(job) : bank.title,
        items: bank.items.map((item) => {
          const extra = answers.get(item.id);
          if (!extra) {
            return item;
          }
          return {
            ...item,
            answer: item.answer.trim() ? `${item.answer.trim()}\n\n${extra}` : extra,
          };
        }),
      });
    }
  } else if (picked.length) {
    if (!bank) {
      bank = createBank(hashid, job);
    }
    bank = saveBank(hashid, {
      ...bank,
      jobId: job.id,
      title: jobListTitle(job),
      items: [
        ...picked.map((item) => ({ ...item, proficiency: 3 as const })),
        ...bank.items,
      ],
    });
  }
  if (job.sessionKind === 'fresh') {
    dropSessionAudio(hashid, job, keep);
  }
  return saveJob(hashid, {
    ...job,
    bankId: bank?.id ?? job.bankId,
    interviewStatus: 'idle',
    sessionKind: 'fresh',
    session: [],
    sessionIndex: 0,
  });
}

export async function ensureTurnAudio(
  hashid: string,
  jobId: string,
  index: number,
  settings: AiSettings,
): Promise<Job> {
  const job = requireJob(hashid, jobId);
  const turn = job.session[index];
  if (!turn || !speechConfigured(settings) || !turn.question.trim()) {
    return job;
  }
  if (turn.audio && turn.audioText === turn.question && pathExists(turn.audio)) {
    return job;
  }
  const rel = prepareAudioRel(hashid, turn.id);
  await synthesizeSpeech(turn.question, settings.ttsVoice, settings, rel);
  const latest = requireJob(hashid, jobId);
  const current = latest.session[index];
  if (!current || current.id !== turn.id || current.question !== turn.question) {
    return latest;
  }
  return saveJob(hashid, {
    ...latest,
    session: latest.session.map((item, i) =>
      i === index ? { ...item, audio: rel, audioText: item.question } : item,
    ),
  });
}

export async function prefetchAudio(
  hashid: string,
  jobId: string,
  index: number,
  settings: AiSettings,
  onUpdate?: (job: Job) => void,
): Promise<void> {
  for (const i of [index, index + 1]) {
    const next = await ensureTurnAudio(hashid, jobId, i, settings);
    onUpdate?.(next);
  }
}

export function persistBankItem(
  hashid: string,
  bankId: string,
  itemId: string,
  patch: Partial<Pick<QaItem, 'question' | 'answer' | 'audio' | 'audioText' | 'proficiency'>>,
): QaBank {
  const bank = requireBank(hashid, bankId);
  return saveBank(hashid, {
    ...bank,
    items: bank.items.map((item) => (item.id === itemId ? { ...item, ...patch } : item)),
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

export async function regenerateItemAudio(
  hashid: string,
  bankId: string,
  itemId: string,
  settings: AiSettings,
): Promise<QaBank> {
  const bank = requireBank(hashid, bankId);
  const item = bank.items.find((entry) => entry.id === itemId);
  if (!item?.question.trim()) {
    throw new Error('请先填写问题');
  }
  const rel = prepareAudioRel(hashid, item.id);
  await synthesizeSpeech(item.question, settings.ttsVoice, settings, rel);
  return persistBankItem(hashid, bankId, itemId, { audio: rel, audioText: item.question });
}

export function proficiencyColor(value: Proficiency): string {
  return value === 1 ? '#2F6B4F' : value === 2 ? '#9A6B12' : '#A33B2B';
}

export function currentTurn(job: Job): QaTurn | undefined {
  return job.session[job.sessionIndex];
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
