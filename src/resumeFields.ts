import type { MasterTemplate, Resume } from './types';

export const GENDERS = ['男', '女', '不愿透露'];

type Field<K extends string> = {
  key: K;
  label: string;
  placeholder: string;
  multiline?: boolean;
};

export const MASTER_FIELDS: Array<Field<Exclude<keyof MasterTemplate, 'gender'>>> = [
  { key: 'name', label: '姓名', placeholder: '真实姓名' },
  { key: 'age', label: '年龄', placeholder: '26' },
  { key: 'phone', label: '电话', placeholder: '11 位手机号' },
  { key: 'email', label: '邮箱', placeholder: 'name@example.com' },
  { key: 'education', label: '学历', placeholder: '本科 / 硕士…' },
  { key: 'educationExperience', label: '教育经历', placeholder: '学校 · 专业 · 时间', multiline: true },
];

export const RESUME_FIELDS: Array<Field<Exclude<keyof Resume, 'id' | 'title' | 'sections' | 'createdAt' | 'updatedAt'>>> = [
  { key: 'jobIntention', label: '求职意向', placeholder: 'iOS 开发' },
  { key: 'yearsOfWork', label: '工作年限', placeholder: '3 年' },
  { key: 'intendedCities', label: '意向城市', placeholder: '上海、杭州' },
];

export type InfoRow = { key: string; label: string; value: string };

export function masterPreviewRows(master: MasterTemplate): InfoRow[] {
  return MASTER_FIELDS.flatMap((field) => {
    const item = { key: field.key, label: field.label, value: master[field.key] };
    if (field.key === 'name') {
      return [item, { key: 'gender', label: '性别', value: master.gender }];
    }
    return [item];
  });
}
