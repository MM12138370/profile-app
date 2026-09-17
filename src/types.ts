export type UserRecord = {
  hashid: string;
  username: string;
  nickname?: string;
};

/** 母模版：各子简历复用的通用个人信息。每人一份。 */
export type MasterTemplate = {
  name: string;
  gender: string;
  age: string;
  phone: string;
  email: string;
  education: string;
  educationExperience: string;
};

/** 子简历：面向某一类岗位的版本。不存母模版字段。 */
export type Resume = {
  id: string;
  title: string;
  jobIntention: string;
  yearsOfWork: string;
  intendedCities: string;
  sections: SectionItem[];
  createdAt: string;
  updatedAt: string;
};

export type PersonalInfo = MasterTemplate &
  Pick<Resume, 'jobIntention' | 'yearsOfWork' | 'intendedCities'>;

/** 预览和模型用的合成结果，不落盘。 */
export type Profile = {
  personalInfo: PersonalInfo;
  sections: SectionItem[];
};

export type SectionItem = {
  title: string;
  content: string;
};

export type StructuredJD = {
  jobTitle: string;
  yearsRequired: string;
  location: string;
  responsibilities: string;
  requirements: string;
  benefits: string;
};

/** 从结构化 JD 再压缩出的重点，不编造岗位里没有的内容。 */
export type JdDigest = {
  talent: string;
  work: string;
  offer: string;
};

export function normalizeStructuredJd(value: unknown): StructuredJD {
  const rec = value && typeof value === 'object' ? (value as Record<string, unknown>) : {};
  const pick = (key: string) => String(rec[key] ?? '').trim();
  const jobTitle = pick('jobTitle');
  return {
    jobTitle:
      jobTitle === '未命名职位' || jobTitle === '未命名岗位' || jobTitle === '新岗位' ? '' : jobTitle,
    yearsRequired: pick('yearsRequired'),
    location: pick('location'),
    responsibilities: pick('responsibilities') || pick('jobDescription'),
    requirements: pick('requirements'),
    benefits: pick('benefits'),
  };
}

export function structuredJdOrNull(value: unknown): StructuredJD | null {
  const next = normalizeStructuredJd(value);
  return Object.values(next).some((item) => item.length > 0) ? next : null;
}

export function normalizeJdDigest(value: unknown): JdDigest {
  const rec = value && typeof value === 'object' ? (value as Record<string, unknown>) : {};
  const pick = (key: string) => String(rec[key] ?? '').trim();
  return {
    talent: pick('talent'),
    work: pick('work'),
    offer: pick('offer'),
  };
}

export function hydrateJdDigest(value: unknown): JdDigest | null {
  if (!value || typeof value !== 'object') {
    return null;
  }
  const next = normalizeJdDigest(value);
  return next.talent || next.work || next.offer ? next : null;
}

export type ProjectAssist = {
  original: string;
  optimized: string;
  points: string;
};

export type InterviewStatus = 'idle' | 'generating' | 'active';
export type Proficiency = 1 | 2 | 3;

export type QaTurn = {
  id: string;
  question: string;
  audio: string;
  audioText: string;
  answer: string;
};

export type QaItem = QaTurn & {
  proficiency: Proficiency;
};

export type QaBank = {
  id: string;
  jobId: string;
  title: string;
  items: QaItem[];
};

export type Job = {
  id: string;
  resumeId: string;
  remark: string;
  rawJD: string;
  structured: StructuredJD | null;
  jdDigest: JdDigest | null;
  projectAssist: ProjectAssist | null;
  bankId: string;
  session: QaTurn[];
  sessionIndex: number;
  createdAt: string;
  updatedAt: string;
};

export function jobListTitle(job: Job): string {
  return job.remark.trim() || job.structured?.jobTitle.trim() || '未命名岗位';
}

export function jobMetaLine(job: Job): string {
  const title = job.structured?.jobTitle.trim() ?? '';
  const extra = [job.structured?.location, job.structured?.yearsRequired].filter(Boolean);
  if (job.remark.trim() && title && title !== job.remark.trim()) {
    return [title, ...extra].join(' · ');
  }
  return extra.join(' · ');
}

export type AiSettings = {
  baseURL: string;
  apiKey: string;
  model: string;
  speechApiKey: string;
  ttsResourceId: string;
  sttResourceId: string;
  ttsVoice: string;
};

export function speechConfigured(settings: AiSettings): boolean {
  return Boolean(settings.speechApiKey.trim() || settings.apiKey.trim());
}

export const emptyMaster = (): MasterTemplate => ({
  name: '',
  gender: '',
  age: '',
  phone: '',
  email: '',
  education: '',
  educationExperience: '',
});

export const emptyResume = (id: string): Resume => ({
  id,
  title: '',
  jobIntention: '',
  yearsOfWork: '',
  intendedCities: '',
  sections: [],
  createdAt: '',
  updatedAt: '',
});

export function composeProfile(master: MasterTemplate, resume: Resume): Profile {
  return {
    personalInfo: {
      name: master.name,
      gender: master.gender,
      age: master.age,
      phone: master.phone,
      email: master.email,
      education: master.education,
      educationExperience: master.educationExperience,
      jobIntention: resume.jobIntention,
      yearsOfWork: resume.yearsOfWork,
      intendedCities: resume.intendedCities,
    },
    sections: resume.sections,
  };
}

export function masterHasContent(master: MasterTemplate): boolean {
  return Object.values(master).some((value) => value.trim().length > 0);
}

export function profileHasContent(profile: Profile): boolean {
  if (profile.sections.length > 0) {
    return true;
  }
  return Object.values(profile.personalInfo).some((value) => value.trim().length > 0);
}

export function resumeLabel(resume: Resume): string {
  return resume.title.trim() || resume.jobIntention.trim() || '未命名简历';
}

export function readSections(value: unknown): SectionItem[] {
  if (!Array.isArray(value)) {
    return [];
  }
  const out: SectionItem[] = [];
  for (const item of value) {
    if (!item || typeof item !== 'object' || Array.isArray(item)) {
      continue;
    }
    const rec = item as Record<string, unknown>;
    if (typeof rec.title === 'string' && typeof rec.content === 'string') {
      out.push({ title: rec.title, content: rec.content });
    }
  }
  return out;
}

export const emptySection = (): SectionItem => ({ title: '', content: '' });

export function newId(prefix: string): string {
  return `${prefix}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
}

export function emptyQaTurn(question = ''): QaTurn {
  return {
    id: newId('qa'),
    question,
    audio: '',
    audioText: '',
    answer: '',
  };
}

export function parseProficiency(value: unknown): Proficiency {
  return value === 1 || value === 2 ? value : 3;
}

export function nextProficiency(value: Proficiency): Proficiency {
  return value === 1 ? 2 : value === 2 ? 3 : 1;
}

export function hydrateQaTurn(value: unknown): QaTurn | null {
  if (!value || typeof value !== 'object') {
    return null;
  }
  const rec = value as Record<string, unknown>;
  const question = String(rec.question ?? '').trim();
  const id = String(rec.id ?? '').trim();
  if (!id && !question) {
    return null;
  }
  return {
    id: id || newId('qa'),
    question,
    audio: String(rec.audio ?? '').trim(),
    audioText: String(rec.audioText ?? ''),
    answer: String(rec.answer ?? ''),
  };
}

export function hydrateQaItem(value: unknown): QaItem | null {
  const turn = hydrateQaTurn(value);
  if (!turn) {
    return null;
  }
  const rec = value as Record<string, unknown>;
  return { ...turn, proficiency: parseProficiency(rec.proficiency) };
}

export function hydrateQaTurns(value: unknown): QaTurn[] {
  return Array.isArray(value)
    ? value.map(hydrateQaTurn).filter((item): item is QaTurn => Boolean(item))
    : [];
}

export function hydrateQaItems(value: unknown): QaItem[] {
  return Array.isArray(value)
    ? value.map(hydrateQaItem).filter((item): item is QaItem => Boolean(item))
    : [];
}

export function hydrateProjectAssist(value: unknown): ProjectAssist | null {
  if (!value || typeof value !== 'object') {
    return null;
  }
  const rec = value as Record<string, unknown>;
  const original = String(rec.original ?? '');
  const optimized = String(rec.optimized ?? '');
  const points = String(rec.points ?? '');
  if (!original && !optimized && !points) {
    return null;
  }
  return { original, optimized, points };
}

export function userLabel(user: Pick<UserRecord, 'username' | 'nickname'>): string {
  const nick = user.nickname?.trim();
  if (nick) {
    return nick;
  }
  const id = user.username.trim();
  if (/^\d+$/.test(id) && id.length >= 4) {
    return id.slice(-4);
  }
  return id;
}
