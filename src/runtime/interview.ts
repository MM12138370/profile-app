import { createBank, dropSessionAudio, loadBank, loadJob, saveBank, saveJob } from '../storage';
import { jobListTitle, type Job } from '../types';

function requireJob(hashid: string, jobId: string): Job {
  const job = loadJob(hashid, jobId);
  if (!job) {
    throw new Error('岗位已不存在');
  }
  return job;
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
  let bank = job.bankId ? loadBank(hashid, job.bankId) : null;
  if (picked.length) {
    if (!bank) {
      bank = createBank(hashid, job);
    }
    bank = saveBank(hashid, {
      ...bank,
      jobId: job.id,
      title: jobListTitle(job),
      items: [...picked.map((item) => ({ ...item, proficiency: 3 as const })), ...bank.items],
    });
  }
  dropSessionAudio(hashid, job, new Set(picked.map((item) => item.id)));
  return saveJob(hashid, {
    ...job,
    bankId: bank?.id ?? job.bankId,
    session: [],
    sessionIndex: 0,
  });
}
