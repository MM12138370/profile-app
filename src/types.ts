export type UserRecord = {
  hashid: string;
  username: string;
  nickname?: string;
};

export type PersonalInfo = {
  name: string;
  gender: string;
  birthDate: string;
  phone: string;
  email: string;
  education: string;
  jobIntention: string;
  educationExperience: string;
  yearsOfWork: string;
  intendedCities: string;
};

export type SectionItem = {
  title: string;
  content: string;
};

export type SectionNode = SectionItem | SectionNode[];

export type Profile = {
  personalInfo: PersonalInfo;
  sections: SectionNode[];
};

export type StructuredJD = {
  jobTitle: string;
  yearsRequired: string;
  location: string;
  jobDescription: string;
};

export type QAItem = {
  question: string;
  answer: string;
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
  rawJD: string;
  structured: StructuredJD | null;
  interviewQA: QAItem[];
  relatedProjects: SectionNode[];
  interviewResult: InterviewResult | null;
  createdAt: string;
  updatedAt: string;
};

export type AiSettings = {
  baseURL: string;
  apiKey: string;
  model: string;
};

export const emptyPersonalInfo = (): PersonalInfo => ({
  name: '',
  gender: '',
  birthDate: '',
  phone: '',
  email: '',
  education: '',
  jobIntention: '',
  educationExperience: '',
  yearsOfWork: '',
  intendedCities: '',
});

export const emptyProfile = (): Profile => ({
  personalInfo: emptyPersonalInfo(),
  sections: [],
});

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

export function profileHasContent(profile: Profile): boolean {
  if (profile.sections.length > 0) {
    return true;
  }
  return Object.values(profile.personalInfo).some((value) => value.trim().length > 0);
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
