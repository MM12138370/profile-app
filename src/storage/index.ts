import * as Crypto from 'expo-crypto';

import {
  composeProfile,
  emptyMaster,
  emptyResume,
  flattenSections,
  hydrateJdDigest,
  hydrateProjectAssist,
  hydrateQAItems,
  masterHasContent,
  normalizeStructuredJd,
  type AiSettings,
  type Job,
  type MasterTemplate,
  type Profile,
  type Resume,
  type StructuredJD,
  type UserRecord,
} from '../types';
import {
  datasPath,
  deleteFile,
  ensureDir,
  jobPath,
  jobsDirPath,
  listFileNames,
  masterPath,
  nowIso,
  pathExists,
  readJsonFile,
  resumePath,
  resumesDirPath,
  userDirPath,
  usersPath,
  writeJsonFile,
} from './io';
import { kvGet, kvRemove, kvSet } from './kv';

const SESSION_KEY = 'zhimian.session.username';
const AI_KEY = 'zhimian.ai.settings';

const defaultAiSettings = (): AiSettings => ({
  baseURL: 'https://api.openai.com/v1',
  apiKey: '',
  model: 'gpt-4o-mini',
});

export async function ensureStorage(): Promise<void> {
  ensureDir(datasPath());
  if (!pathExists(usersPath())) {
    writeJsonFile(usersPath(), []);
  }
}

export function listUsers(): UserRecord[] {
  return readJsonFile<UserRecord[]>(usersPath(), []);
}

export async function createHashId(username: string): Promise<string> {
  const digest = await Crypto.digestStringAsync(
    Crypto.CryptoDigestAlgorithm.SHA256,
    `${username}:${Date.now()}:${Math.random()}`,
  );
  return digest.slice(0, 16);
}

export async function loginOrRegister(
  username: string,
  nickname?: string,
): Promise<UserRecord> {
  await ensureStorage();
  const trimmed = username.trim();
  if (!trimmed) {
    throw new Error('请输入用户名');
  }
  const users = listUsers();
  const existing = users.find((u) => u.username === trimmed);
  if (existing) {
    ensureUserWorkspace(existing.hashid);
    await kvSet(SESSION_KEY, existing.username);
    return existing;
  }
  const nick = nickname?.trim();
  const hashid = await createHashId(trimmed);
  const record: UserRecord = nick
    ? { hashid, username: trimmed, nickname: nick }
    : { hashid, username: trimmed };
  writeJsonFile(usersPath(), [...users, record]);
  ensureUserWorkspace(hashid);
  await kvSet(SESSION_KEY, record.username);
  return record;
}

export function saveNickname(username: string, nickname: string): UserRecord {
  const users = listUsers();
  const index = users.findIndex((u) => u.username === username);
  if (index < 0) {
    throw new Error('用户不存在');
  }
  const nick = nickname.trim();
  const current = users[index];
  const record: UserRecord = nick
    ? { ...current, nickname: nick }
    : { hashid: current.hashid, username: current.username };
  users[index] = record;
  writeJsonFile(usersPath(), users);
  return record;
}

export function ensureUserWorkspace(hashid: string): void {
  ensureDir(userDirPath(hashid));
  ensureDir(jobsDirPath(hashid));
  ensureDir(resumesDirPath(hashid));
}

export async function restoreSession(): Promise<UserRecord | null> {
  await ensureStorage();
  const username = await kvGet(SESSION_KEY);
  if (!username) {
    return null;
  }
  const user = listUsers().find((u) => u.username === username);
  if (!user) {
    await kvRemove(SESSION_KEY);
    return null;
  }
  ensureUserWorkspace(user.hashid);
  return user;
}

export async function logout(): Promise<void> {
  await kvRemove(SESSION_KEY);
}

export function loadMaster(hashid: string): MasterTemplate {
  ensureUserWorkspace(hashid);
  if (!pathExists(masterPath(hashid))) {
    return emptyMaster();
  }
  return readJsonFile<MasterTemplate>(masterPath(hashid), emptyMaster());
}

export function saveMaster(hashid: string, master: MasterTemplate): void {
  if (!masterHasContent(master)) {
    deleteFile(masterPath(hashid));
    return;
  }
  writeJsonFile(masterPath(hashid), master);
}

function hydrateResume(resume: Resume): Resume {
  return {
    ...resume,
    sections: flattenSections(resume.sections),
  };
}

export function listResumes(hashid: string): Resume[] {
  ensureUserWorkspace(hashid);
  const dir = resumesDirPath(hashid);
  if (!pathExists(dir)) {
    return [];
  }
  const resumes: Resume[] = [];
  for (const name of listFileNames(dir)) {
    if (!name.endsWith('.json')) {
      continue;
    }
    const id = name.replace(/\.json$/, '');
    resumes.push(hydrateResume(readJsonFile<Resume>(resumePath(hashid, id), emptyResume(id))));
  }
  return resumes.sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
}

export function resumeExists(hashid: string, resumeId: string): boolean {
  return pathExists(resumePath(hashid, resumeId));
}

export function loadResume(hashid: string, resumeId: string): Resume {
  return hydrateResume(readJsonFile<Resume>(resumePath(hashid, resumeId), emptyResume(resumeId)));
}

export function saveResume(hashid: string, resume: Resume): Resume {
  const next = hydrateResume({ ...resume, updatedAt: nowIso() });
  writeJsonFile(resumePath(hashid, resume.id), next);
  return next;
}

export function createResume(
  hashid: string,
  draft: Omit<Resume, 'id' | 'createdAt' | 'updatedAt'>,
): Resume {
  const id = `resume_${Date.now().toString(36)}`;
  const now = nowIso();
  const resume = hydrateResume({
    ...draft,
    id,
    createdAt: now,
    updatedAt: now,
  });
  writeJsonFile(resumePath(hashid, id), resume);
  return resume;
}

export function persistResume(hashid: string, resume: Resume): Resume {
  if (!resume.id) {
    return createResume(hashid, {
      title: resume.title,
      jobIntention: resume.jobIntention,
      yearsOfWork: resume.yearsOfWork,
      intendedCities: resume.intendedCities,
      sections: resume.sections,
    });
  }
  return saveResume(hashid, resume);
}

export function deleteResume(hashid: string, resumeId: string): void {
  deleteFile(resumePath(hashid, resumeId));
  for (const job of listJobs(hashid)) {
    if (job.resumeId === resumeId) {
      saveJob(hashid, { ...job, resumeId: '' });
    }
  }
}

export function loadComposedProfile(hashid: string, resumeId: string): Profile {
  return composeProfile(loadMaster(hashid), loadResume(hashid, resumeId));
}

export function loadProfileForJob(hashid: string, job: Job): Profile {
  return job.resumeId && resumeExists(hashid, job.resumeId)
    ? loadComposedProfile(hashid, job.resumeId)
    : composeProfile(loadMaster(hashid), emptyResume(''));
}

export function listJobs(hashid: string): Job[] {
  ensureUserWorkspace(hashid);
  const dir = jobsDirPath(hashid);
  if (!pathExists(dir)) {
    return [];
  }
  const jobs: Job[] = [];
  for (const name of listFileNames(dir)) {
    if (!name.endsWith('.json')) {
      continue;
    }
    const id = name.replace(/\.json$/, '');
    try {
      jobs.push(hydrateJob(readJsonFile<Job>(jobPath(hashid, id), emptyJob(id))));
    } catch {
      // skip unreadable job files
    }
  }
  return jobs.sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
}

export function loadJob(hashid: string, jobId: string): Job {
  return hydrateJob(readJsonFile<Job>(jobPath(hashid, jobId), emptyJob(jobId)));
}

export function saveJob(hashid: string, job: Job): Job {
  const next = hydrateJob({ ...job, updatedAt: nowIso() });
  writeJsonFile(jobPath(hashid, job.id), next);
  return next;
}

export function createJob(
  hashid: string,
  input: { rawJD: string; structured?: StructuredJD | null },
): Job {
  const id = `job_${Date.now().toString(36)}`;
  const job = hydrateJob({
    ...emptyJob(id),
    rawJD: input.rawJD.trim(),
    structured: input.structured ?? null,
    createdAt: nowIso(),
    updatedAt: nowIso(),
  });
  writeJsonFile(jobPath(hashid, id), job);
  return job;
}

export function deleteJob(hashid: string, jobId: string): void {
  deleteFile(jobPath(hashid, jobId));
}

function hydrateJob(job: Job): Job {
  return {
    id: job.id,
    resumeId: String(job.resumeId ?? ''),
    remark: String(job.remark ?? '').trim(),
    rawJD: String(job.rawJD ?? ''),
    structured: job.structured ? normalizeStructuredJd(job.structured) : null,
    jdDigest: hydrateJdDigest(job.jdDigest),
    interviewQA: hydrateQAItems(job.interviewQA),
    projectAssist: hydrateProjectAssist(job.projectAssist),
    interviewResult: job.interviewResult ?? null,
    createdAt: job.createdAt,
    updatedAt: job.updatedAt,
  };
}

export function emptyJob(id: string): Job {
  return {
    id,
    resumeId: '',
    remark: '',
    rawJD: '',
    structured: null,
    jdDigest: null,
    interviewQA: [],
    projectAssist: null,
    interviewResult: null,
    createdAt: nowIso(),
    updatedAt: nowIso(),
  };
}

export async function loadAiSettings(): Promise<AiSettings> {
  const raw = await kvGet(AI_KEY);
  if (!raw) {
    return defaultAiSettings();
  }
  try {
    return { ...defaultAiSettings(), ...(JSON.parse(raw) as Partial<AiSettings>) };
  } catch {
    return defaultAiSettings();
  }
}

export async function saveAiSettings(settings: AiSettings): Promise<void> {
  await kvSet(AI_KEY, JSON.stringify(settings));
}
