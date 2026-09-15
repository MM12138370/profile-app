import { normalizeJdDigest, type JdDigest, type StructuredJD } from '../../types';
import { jdToPrompt } from '../../jobText';
import { extractJson, GROUNDING_RULE } from '../json';
import { complete } from '../llm';

export async function runDistillJd(jd: StructuredJD): Promise<JdDigest> {
  const content = await complete([
    {
      role: 'system',
      content:
        '你是求职岗位阅读助手。只根据已给出的结构化岗位信息提炼重点，不要补充未出现的内容。只输出 JSON。' +
        GROUNDING_RULE,
    },
    {
      role: 'user',
      content: `岗位结构化结果：
${jdToPrompt(jd)}

请把信息压缩成三类重点，分条换行。没有依据的类别输出空字符串。只输出 JSON：
{
  "talent": "需要什么样的人才：任职要求、年限、地点等对候选人的要求",
  "work": "岗位需要做什么：职责、产出、日常工作",
  "offer": "公司能提供什么：薪资福利、成长、氛围、地点等候选人能得到的"
}

要求：
- 只提炼、合并、缩短原文，不要编造福利、技能或要求
- 去掉重复套话和广告语，保留可核对的事实
- 每类控制在数条以内，便于快速扫读`,
    },
  ]);
  const digest = normalizeJdDigest(extractJson<Partial<JdDigest>>(content));
  if (!digest.talent && !digest.work && !digest.offer) {
    throw new Error('没有提炼出可用内容，请检查结构化结果后重试');
  }
  return digest;
}
