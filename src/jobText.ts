import { normalizeStructuredJd, type JdDigest, type StructuredJD } from './types';

export const JD_FIELDS = [
  { key: 'jobTitle', label: '岗位名称', multiline: false },
  { key: 'yearsRequired', label: '工作年限', multiline: false },
  { key: 'responsibilities', label: '岗位职责', multiline: true },
  { key: 'requirements', label: '任职要求', multiline: true },
  { key: 'benefits', label: '福利待遇', multiline: true },
  { key: 'location', label: '工作地点', multiline: false },
] as const;

export const JD_DIGEST_FIELDS = [
  { key: 'talent', label: '需要什么样的人才' },
  { key: 'work', label: '岗位需要做什么' },
  { key: 'offer', label: '公司能提供什么' },
] as const satisfies ReadonlyArray<{ key: keyof JdDigest; label: string }>;

export function formatJobText(job: StructuredJD): string {
  return JD_FIELDS.map(({ key, label }) => {
    const value = job[key].trim();
    return value ? `${label}：\n${value}` : '';
  })
    .filter(Boolean)
    .join('\n\n');
}

export function jdToPrompt(job: StructuredJD): string {
  const jd = normalizeStructuredJd(job);
  return JD_FIELDS.map(({ key, label }) => `${label}：\n${jd[key] || '未写'}`).join('\n\n');
}
