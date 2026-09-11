import * as Crypto from 'expo-crypto';

import {
  emptyProfile,
  type AiSettings,
  type Job,
  type Profile,
  type UserRecord,
} from '../types';
import {
  datasPath,
  deleteFile,
  ensureDir,
  jobPath,
  jobsDirPath,
  listFileNames,
  nowIso,
  pathExists,
  profilePath,
  readJsonFile,
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
  if (!pathExists(profilePath(hashid))) {
    writeJsonFile(profilePath(hashid), emptyProfile());
  }
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

export function loadProfile(hashid: string): Profile {
  ensureUserWorkspace(hashid);
  const stored = readJsonFile<Partial<Profile>>(profilePath(hashid), emptyProfile());
  const base = emptyProfile();
  return {
    personalInfo: { ...base.personalInfo, ...stored.personalInfo },
    sections: Array.isArray(stored.sections) ? stored.sections : [],
  };
}

export function saveProfile(hashid: string, profile: Profile): void {
  writeJsonFile(profilePath(hashid), profile);
}

export function clearProfile(hashid: string): void {
  saveProfile(hashid, emptyProfile());
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
      jobs.push(readJsonFile<Job>(jobPath(hashid, id), emptyJob(id)));
    } catch {
      // skip unreadable job files
    }
  }
  return jobs.sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
}

export function loadJob(hashid: string, jobId: string): Job {
  return readJsonFile<Job>(jobPath(hashid, jobId), emptyJob(jobId));
}

export function saveJob(hashid: string, job: Job): Job {
  const next = { ...job, updatedAt: nowIso() };
  writeJsonFile(jobPath(hashid, job.id), next);
  return next;
}

export function createJob(hashid: string, rawJD: string): Job {
  const id = `job_${Date.now().toString(36)}`;
  const job: Job = {
    ...emptyJob(id),
    rawJD: rawJD.trim(),
    createdAt: nowIso(),
    updatedAt: nowIso(),
  };
  writeJsonFile(jobPath(hashid, id), job);
  return job;
}

export function deleteJob(hashid: string, jobId: string): void {
  deleteFile(jobPath(hashid, jobId));
}

export function emptyJob(id: string): Job {
  return {
    id,
    rawJD: '',
    structured: null,
    interviewQA: [],
    relatedProjects: [],
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
