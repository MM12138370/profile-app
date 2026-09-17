import * as Crypto from 'expo-crypto';

import {
  composeProfile,
  emptyMaster,
  emptyResume,
  readSections,
  hydrateJdDigest,
  hydrateProjectAssist,
  hydrateQaItems,
  hydrateQaTurns,
  jobListTitle,
  masterHasContent,
  newId,
  normalizeStructuredJd,
  type AiSettings,
  type Job,
  type MasterTemplate,
  type Profile,
  type QaBank,
  type QaTurn,
  type Resume,
  type StructuredJD,
  type UserRecord,
} from '../types';
import {
  audioDirPath,
  audioPath,
  audioPlayUri,
  bankPath,
  banksDirPath,
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
  baseURL: 'https://ark.cn-beijing.volces.com/api/v3',
  apiKey: '',
  model: '',
  speechApiKey: '',
  ttsResourceId: 'seed-tts-2.0',
  sttResourceId: 'volc.bigasr.auc_turbo',
  ttsVoice: 'zh_male_m191_uranus_bigtts',
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
  ensureDir(banksDirPath(hashid));
  ensureDir(audioDirPath(hashid));
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
    sections: readSections(resume.sections),
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
    const job = loadJob(hashid, id);
    if (job) {
      jobs.push(job);
    }
  }
  return jobs.sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
}

export function jobExists(hashid: string, jobId: string): boolean {
  return pathExists(jobPath(hashid, jobId));
}

export function loadJob(hashid: string, jobId: string): Job | null {
  const rel = jobPath(hashid, jobId);
  if (!pathExists(rel)) {
    return null;
  }
  try {
    const raw = readJsonFile<Partial<Job> | null>(rel, null);
    if (!raw || typeof raw !== 'object') {
      return null;
    }
    return hydrateJob({ ...emptyJob(jobId), ...raw, id: jobId });
  } catch {
    return null;
  }
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

export function deleteJob(hashid: string, jobId: string, withBank = false): void {
  const job = loadJob(hashid, jobId);
  if (!job) {
    return;
  }
  dropSessionAudio(hashid, job);
  if (withBank && job.bankId) {
    removeBankFile(hashid, job.bankId);
  }
  deleteFile(jobPath(hashid, jobId));
}

function hydrateJob(job: Job): Job {
  const session = hydrateQaTurns(job.session);
  return {
    id: job.id,
    resumeId: String(job.resumeId ?? ''),
    remark: String(job.remark ?? '').trim(),
    rawJD: String(job.rawJD ?? ''),
    structured: job.structured ? normalizeStructuredJd(job.structured) : null,
    jdDigest: hydrateJdDigest(job.jdDigest),
    projectAssist: hydrateProjectAssist(job.projectAssist),
    bankId: String(job.bankId ?? ''),
    session,
    sessionIndex: Math.min(Math.max(0, Math.round(Number(job.sessionIndex) || 0)), session.length),
    createdAt: job.createdAt,
    updatedAt: job.updatedAt,
  };
}

export function emptyJob(id: string): Job {
  const now = nowIso();
  return {
    id,
    resumeId: '',
    remark: '',
    rawJD: '',
    structured: null,
    jdDigest: null,
    projectAssist: null,
    bankId: '',
    session: [],
    sessionIndex: 0,
    createdAt: now,
    updatedAt: now,
  };
}

export function listBanks(hashid: string): QaBank[] {
  ensureUserWorkspace(hashid);
  const dir = banksDirPath(hashid);
  if (!pathExists(dir)) {
    return [];
  }
  const banks: QaBank[] = [];
  for (const name of listFileNames(dir)) {
    if (!name.endsWith('.json')) {
      continue;
    }
    const bank = loadBank(hashid, name.replace(/\.json$/, ''));
    if (bank?.items.length) {
      banks.push(bank);
    }
  }
  return banks;
}

export function loadBank(hashid: string, bankId: string): QaBank | null {
  const rel = bankPath(hashid, bankId);
  if (!pathExists(rel)) {
    return null;
  }
  try {
    const raw = readJsonFile<Partial<QaBank> | null>(rel, null);
    if (!raw || typeof raw !== 'object') {
      return null;
    }
    const id = String(raw.id ?? bankId);
    return {
      id,
      jobId: String(raw.jobId ?? ''),
      title: String(raw.title ?? '').trim() || '未命名岗位',
      items: hydrateQaItems(raw.items),
    };
  } catch {
    return null;
  }
}

export function saveBank(hashid: string, bank: QaBank): QaBank {
  ensureUserWorkspace(hashid);
  writeJsonFile(bankPath(hashid, bank.id), bank);
  return bank;
}

export function createBank(hashid: string, job: Job): QaBank {
  const bank: QaBank = {
    id: newId('bank'),
    jobId: job.id,
    title: jobListTitle(job),
    items: [],
  };
  return saveBank(hashid, bank);
}

function removeBankFile(hashid: string, bankId: string): void {
  const bank = loadBank(hashid, bankId);
  if (!bank) {
    return;
  }
  for (const item of bank.items) {
    if (item.audio) {
      deleteFile(item.audio);
    }
  }
  deleteFile(bankPath(hashid, bankId));
}

export function deleteBank(hashid: string, bankId: string): void {
  removeBankFile(hashid, bankId);
  for (const job of listJobs(hashid)) {
    if (job.bankId === bankId) {
      saveJob(hashid, { ...job, bankId: '' });
    }
  }
}

export function dropSessionAudio(hashid: string, job: Job, keepIds?: Set<string>): void {
  const bank = job.bankId ? loadBank(hashid, job.bankId) : null;
  const keep = keepIds ?? new Set(bank?.items.map((item) => item.id) ?? []);
  for (const turn of job.session) {
    if (turn.audio && !keep.has(turn.id)) {
      deleteFile(turn.audio);
    }
  }
}

export function prepareAudioRel(hashid: string, id: string): string {
  ensureUserWorkspace(hashid);
  return audioPath(hashid, id);
}

export function archivedAudioUri(item: Pick<QaTurn, 'audio' | 'audioText' | 'question'>): string | null {
  if (!item.audio || item.audioText.trim() !== item.question.trim()) {
    return null;
  }
  return audioPlayUri(item.audio);
}

function hydrateAiSettings(raw: Partial<AiSettings>): AiSettings {
  const defaults = defaultAiSettings();
  return {
    baseURL: String(raw.baseURL ?? defaults.baseURL),
    apiKey: String(raw.apiKey ?? defaults.apiKey),
    model: String(raw.model ?? defaults.model),
    speechApiKey: String(raw.speechApiKey ?? defaults.speechApiKey),
    ttsResourceId: String(raw.ttsResourceId ?? defaults.ttsResourceId) || defaults.ttsResourceId,
    sttResourceId: String(raw.sttResourceId ?? defaults.sttResourceId) || defaults.sttResourceId,
    ttsVoice: String(raw.ttsVoice ?? defaults.ttsVoice) || defaults.ttsVoice,
  };
}

export async function loadAiSettings(): Promise<AiSettings> {
  const raw = await kvGet(AI_KEY);
  if (!raw) {
    return defaultAiSettings();
  }
  try {
    return hydrateAiSettings(JSON.parse(raw) as Partial<AiSettings>);
  } catch {
    return defaultAiSettings();
  }
}

export async function saveAiSettings(settings: AiSettings): Promise<void> {
  await kvSet(AI_KEY, JSON.stringify(hydrateAiSettings(settings)));
}
