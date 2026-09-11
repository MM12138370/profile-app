import type { PersonalInfo } from './types';

export const GENDERS = ['男', '女', '不愿透露'];

export const INFO_FIELDS: Array<{
  key: keyof PersonalInfo;
  label: string;
  placeholder: string;
  multiline?: boolean;
}> = [
  { key: 'name', label: '姓名', placeholder: '真实姓名' },
  { key: 'birthDate', label: '出生年月', placeholder: '1998-07' },
  { key: 'phone', label: '手机号', placeholder: '11 位手机号' },
  { key: 'email', label: '邮箱', placeholder: 'name@example.com' },
  { key: 'education', label: '学历信息', placeholder: '本科 / 硕士…' },
  { key: 'jobIntention', label: '求职意向', placeholder: 'iOS 开发' },
  { key: 'educationExperience', label: '教育经历', placeholder: '学校 · 专业 · 时间', multiline: true },
  { key: 'yearsOfWork', label: '工作年限', placeholder: '3 年' },
  { key: 'intendedCities', label: '意向城市', placeholder: '上海、杭州' },
];
