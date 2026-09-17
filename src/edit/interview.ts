import { runGenerateQa } from '../ai';
import {
  loadAiSettings,
  loadBank,
  loadComposedProfile,
  loadJob,
  resumeExists,
  saveJob,
} from '../storage';
import {
  emptyQaTurn,
  speechConfigured,
  type AiSettings,
  type InterviewStatus,
  type Job,
  type QaTurn,
} from '../types';
import { dropQaAudio, writeQaAudio } from './audio';

const liveGenerate = new Map<string, number>();

function requireJob(hashid: string, jobId: string): Job {
  const job = loadJob(hashid, jobId);
  if (!job) {
    throw new Error('岗位已不存在');
  }
  return job;
}

export function interviewStatus(job: Job): InterviewStatus {
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
  if (interviewStatus(job) !== 'idle') {
    throw new Error('请先结束当前面试');
  }
  if (!job.structured) {
    throw new Error('请先查看结构化结果');
  }
  const count = Math.min(20, Math.max(1, Math.round(input.count) || 5));
  const token = (liveGenerate.get(jobId) ?? 0) + 1;
  liveGenerate.set(jobId, token);
  onUpdate?.({ ...job, resumeId: input.resumeId });
  const session: QaTurn[] = [];
  try {
    const bank = job.bankId ? loadBank(hashid, job.bankId) : null;
    const profile =
      input.resumeId && resumeExists(hashid, input.resumeId)
        ? loadComposedProfile(hashid, input.resumeId)
        : null;
    const questions = await runGenerateQa({
      jd: job.structured,
      profile,
      avoid: bank?.items.map((item) => item.question) ?? [],
      count,
      focus: input.focus,
    });
    if (liveGenerate.get(jobId) !== token) {
      return requireJob(hashid, jobId);
    }
    const settings = await loadAiSettings();
    for (const question of questions) {
      if (liveGenerate.get(jobId) !== token) {
        dropQaAudio(session);
        return requireJob(hashid, jobId);
      }
      const turn = emptyQaTurn(question);
      session.push(speechConfigured(settings) ? await writeQaAudio(hashid, turn, settings) : turn);
    }
    const next = saveJob(hashid, {
      ...requireJob(hashid, jobId),
      resumeId: input.resumeId,
      session,
      sessionIndex: 0,
    });
    onUpdate?.(next);
    return next;
  } catch (error) {
    dropQaAudio(session);
    if (liveGenerate.get(jobId) === token) {
      onUpdate?.(requireJob(hashid, jobId));
    }
    throw error;
  } finally {
    if (liveGenerate.get(jobId) === token) {
      liveGenerate.delete(jobId);
    }
  }
}

export async function archiveSessionTurns(
  hashid: string,
  jobId: string,
  indexes: number[],
  settings: AiSettings,
  onUpdate?: (job: Job) => void,
): Promise<Job> {
  let job = requireJob(hashid, jobId);
  for (const index of indexes) {
    const turn = job.session[index];
    if (!turn?.question.trim()) {
      continue;
    }
    const nextTurn = await writeQaAudio(hashid, turn, settings);
    job = saveJob(hashid, {
      ...job,
      session: job.session.map((item, i) => (i === index ? nextTurn : item)),
    });
    onUpdate?.(job);
  }
  return job;
}
