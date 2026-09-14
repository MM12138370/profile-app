import { Annotation, END, START, StateGraph } from '@langchain/langgraph/web';

import type { Profile, StructuredJD } from '../../types';
import { jdToPrompt } from '../../jobText';
import { extractJson, GROUNDING_RULE } from '../json';
import { complete } from '../llm';
import { profileToPrompt } from '../profileText';

const State = Annotation.Root({
  jd: Annotation<StructuredJD>,
  profile: Annotation<Profile>,
  avoid: Annotation<string[]>,
  questions: Annotation<string[]>,
});

type StateType = {
  jd: StructuredJD;
  profile: Profile;
  avoid: string[];
  questions: string[];
};

async function draft(state: StateType) {
  const avoided = state.avoid.map((item) => item.trim()).filter(Boolean);
  const content = await complete([
    {
      role: 'system',
      content:
        '你是面试教练。根据岗位结构化结果和候选人真实简历只出面试问题，不要写答案。只输出 JSON。' +
        GROUNDING_RULE,
    },
    {
      role: 'user',
      content: `岗位：
${jdToPrompt(state.jd)}

候选人简历：
${profileToPrompt(state.profile)}

${avoided.length ? `以下问题已准备，请勿重复：\n${avoided.map((item) => `- ${item}`).join('\n')}\n` : ''}
请生成 6 到 10 道面试题，输出：
{ "questions": ["...", "..."] }

要求：
- 问题要紧扣该岗位
- 可以追问简历里出现过的项目、职责、技术
- 简历没有的能力不要在问题里写成对方已经做过
- 只出问题，不要答案`,
    },
  ]);
  const parsed = extractJson<{ questions?: unknown }>(content);
  const questions = Array.isArray(parsed.questions)
    ? parsed.questions
        .map((item) => String(item ?? '').trim())
        .filter(Boolean)
    : [];
  return { questions };
}

const graph = new StateGraph(State)
  .addNode('draft', draft)
  .addEdge(START, 'draft')
  .addEdge('draft', END)
  .compile();

export async function runGenerateQa(
  jd: StructuredJD,
  profile: Profile,
  avoid: string[] = [],
): Promise<string[]> {
  const result = await graph.invoke({ jd, profile, avoid, questions: [] });
  if (!result.questions.length) {
    throw new Error('没有生成可用的问题，请完善简历后重试');
  }
  return result.questions;
}
