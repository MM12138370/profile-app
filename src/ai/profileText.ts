import type { Profile, SectionNode } from '../types';
import { isSectionItem } from '../types';

export function profileToPrompt(profile: Profile): string {
  const p = profile.personalInfo;
  const lines = [
    `姓名：${p.name || '未填'}`,
    `性别：${p.gender || '未填'}`,
    `出生年月：${p.birthDate || '未填'}`,
    `手机号：${p.phone || '未填'}`,
    `邮箱：${p.email || '未填'}`,
    `学历信息：${p.education || '未填'}`,
    `求职意向：${p.jobIntention || '未填'}`,
    `教育经历：${p.educationExperience || '未填'}`,
    `工作年限：${p.yearsOfWork || '未填'}`,
    `意向城市：${p.intendedCities || '未填'}`,
    '',
    '简历板块：',
    renderSections(profile.sections) || '（空）',
  ];
  return lines.join('\n');
}

export function renderSections(nodes: SectionNode[], depth = 0): string {
  const indent = '  '.repeat(depth);
  return nodes
    .map((node) => {
      if (isSectionItem(node)) {
        return `${indent}- ${node.title || '未命名'}：${node.content || ''}`;
      }
      return `${indent}- 分组：\n${renderSections(node, depth + 1)}`;
    })
    .join('\n');
}

