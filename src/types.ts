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
  sections: SectionNode[];
  createdAt: string;
  updatedAt: string;
};

export type PersonalInfo = MasterTemplate &
  Pick<Resume, 'jobIntention' | 'yearsOfWork' | 'intendedCities'>;

/** 预览和模型用的合成结果，不落盘。 */
export type Profile = {
  personalInfo: PersonalInfo;
  sections: SectionNode[];
};

export type SectionItem = {
  title: string;
  content: string;
};

export type SectionNode = SectionItem | SectionNode[];

export type StructuredJD = {
  jobTitle: string;
  yearsRequired: string;
  location: string;
  responsibilities: string;
  requirements: string;
  benefits: string;
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

export type QASource = 'ai' | 'manual';

export type QAItem = {
  id: string;
  question: string;
  answer: string;
  source: QASource;
  polishedAnswer: string;
  polishTips: string;
};

export type ProjectAssist = {
  original: string;
  optimized: string;
  points: string;
};

export type InterviewResult = {
  questions: string[];
  standardAnswers: string[];
  userAnswers: string[];
  score?: number;
  optimizationPoints?: string;
  matchScore?: number;
};

export type Job = {
  id: string;
  resumeId: string;
  remark: string;
  rawJD: string;
  structured: StructuredJD | null;
  interviewQA: QAItem[];
  projectAssist: ProjectAssist | null;
  interviewResult: InterviewResult | null;
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
};

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

export function isSectionItem(node: SectionNode): node is SectionItem {
  return !Array.isArray(node);
}

export function isSectionNode(value: unknown): value is SectionNode {
  if (Array.isArray(value)) {
    return value.every(isSectionNode);
  }
  if (!value || typeof value !== 'object') {
    return false;
  }
  const rec = value as Record<string, unknown>;
  return typeof rec.title === 'string' && typeof rec.content === 'string';
}

export function sanitizeSections(value: unknown): SectionNode[] {
  if (!Array.isArray(value)) {
    return [];
  }
  return value.filter(isSectionNode);
}

export function newQaId(): string {
  return `qa_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
}

export function emptyQAItem(input: Partial<QAItem> = {}): QAItem {
  return {
    id: input.id?.trim() || newQaId(),
    question: input.question ?? '',
    answer: input.answer ?? '',
    source: input.source ?? 'manual',
    polishedAnswer: input.polishedAnswer ?? '',
    polishTips: input.polishTips ?? '',
  };
}

export function hydrateQAItem(value: unknown, index = 0): QAItem {
  const rec = value && typeof value === 'object' ? (value as Record<string, unknown>) : {};
  const rawId = typeof rec.id === 'string' ? rec.id.trim() : '';
  const question = String(rec.question ?? '');
  return emptyQAItem({
    id: rawId || `qa_legacy_${index}_${qaQuestionKey(question) || 'blank'}`,
    question,
    answer: String(rec.answer ?? ''),
    source: rec.source === 'manual' ? 'manual' : 'ai',
    polishedAnswer: String(rec.polishedAnswer ?? ''),
    polishTips: String(rec.polishTips ?? ''),
  });
}

export function hydrateQAItems(value: unknown): QAItem[] {
  return Array.isArray(value) ? value.map((item, index) => hydrateQAItem(item, index)) : [];
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

export function qaQuestionKey(question: string): string {
  return question.trim().replace(/\s+/g, ' ');
}

export function withQAEdits(item: QAItem, patch: Partial<Pick<QAItem, 'question' | 'answer'>>): QAItem {
  const question = patch.question ?? item.question;
  const answer = patch.answer ?? item.answer;
  const stale = question !== item.question || answer !== item.answer;
  return {
    ...item,
    question,
    answer,
    polishedAnswer: stale ? '' : item.polishedAnswer,
    polishTips: stale ? '' : item.polishTips,
  };
}

function insertRandomly<T>(base: T[], extras: T[]): T[] {
  const mixed = [...base];
  for (const item of extras) {
    mixed.splice(Math.floor(Math.random() * (mixed.length + 1)), 0, item);
  }
  return mixed;
}

export function mergeGeneratedQuestions(existing: QAItem[], generated: string[]): QAItem[] {
  const manuals = existing.filter((item) => item.source === 'manual' && item.question.trim());
  const blanks = existing.filter((item) => item.source === 'manual' && !item.question.trim());
  const taken = new Set(manuals.map((item) => qaQuestionKey(item.question)));
  const ai = generated
    .map((question) => question.trim())
    .filter((question) => question && !taken.has(qaQuestionKey(question)))
    .map((question) => emptyQAItem({ question, source: 'ai' }));
  return [...insertRandomly(ai, manuals), ...blanks];
}

export function questionsAnswered(items: QAItem[]): boolean {
  const ready = items.filter((item) => item.question.trim());
  return ready.length > 0 && ready.every((item) => item.answer.trim().length > 0);
}

export function qaReadyCount(job: Job): number {
  return job.interviewQA.filter((item) => item.question.trim()).length;
}

export function referenceAnswer(item: QAItem): string {
  return item.polishedAnswer.trim() || item.answer.trim();
}

export function collectReusableQuestions(
  jobs: Job[],
  exceptJobId: string,
): { jobTitle: string; question: string }[] {
  const seen = new Set<string>();
  const out: { jobTitle: string; question: string }[] = [];
  for (const job of jobs) {
    if (job.id === exceptJobId) {
      continue;
    }
    const title = jobListTitle(job);
    for (const item of job.interviewQA) {
      if (item.source !== 'manual') {
        continue;
      }
      const question = item.question.trim();
      const key = qaQuestionKey(question);
      if (!question || seen.has(key)) {
        continue;
      }
      seen.add(key);
      out.push({ jobTitle: title, question });
    }
  }
  return out;
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
