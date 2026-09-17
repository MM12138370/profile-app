import { Annotation, END, START, StateGraph } from '@langchain/langgraph/web';

import type { Profile, StructuredJD } from '../../types';
import { jdToPrompt } from '../../jobText';
import { extractJson, GROUNDING_RULE } from '../json';
import { complete } from '../llm';
import { profileToPrompt } from '../profileText';

const State = Annotation.Root({
  jd: Annotation<StructuredJD>,
  profile: Annotation<Profile | null>,
  avoid: Annotation<string[]>,
  count: Annotation<number>,
  focus: Annotation<string>,
  questions: Annotation<string[]>,
});

type StateType = {
  jd: StructuredJD;
  profile: Profile | null;
  avoid: string[];
  count: number;
  focus: string;
  questions: string[];
};

async function draft(state: StateType, config?: { signal?: AbortSignal }) {
  const avoided = state.avoid.map((item) => item.trim()).filter(Boolean);
  const count = Math.max(1, Math.round(state.count));
  const focus = state.focus.trim();
  const resume = state.profile
    ? `候选人简历：
${profileToPrompt(state.profile)}`
    : '未选择简历，只根据岗位出题。';
  const content = await complete(
    [
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

${resume}

${avoided.length ? `以下问题已准备，请勿重复：\n${avoided.map((item) => `- ${item}`).join('\n')}\n` : ''}
${focus ? `出题倾向：${focus}\n` : ''}
请正好生成 ${count} 道面试题，不多不少，输出：
{ "questions": ["...", "..."] }

要求：
- questions 数组长度必须恰好为 ${count}
- 问题要紧扣该岗位
- 可以追问简历里出现过的项目、职责、技术
- 简历没有的能力不要在问题里写成对方已经做过
- 只出问题，不要答案`,
      },
    ],
    config?.signal,
  );
  const parsed = extractJson<{ questions?: unknown }>(content);
  const questions = Array.isArray(parsed.questions)
    ? parsed.questions
        .map((item) => String(item ?? '').trim())
        .filter(Boolean)
        .slice(0, count)
    : [];
  return { questions };
}

const graph = new StateGraph(State)
  .addNode('draft', draft)
  .addEdge(START, 'draft')
  .addEdge('draft', END)
  .compile();

export async function runGenerateQa(input: {
  jd: StructuredJD;
  profile?: Profile | null;
  avoid?: string[];
  count?: number;
  focus?: string;
  signal?: AbortSignal;
}): Promise<string[]> {
  const count = Math.max(1, Math.round(input.count ?? 5));
  const result = await graph.invoke(
    {
      jd: input.jd,
      profile: input.profile ?? null,
      avoid: input.avoid ?? [],
      count,
      focus: input.focus ?? '',
      questions: [],
    },
    { signal: input.signal },
  );
  if (!result.questions.length) {
    throw new Error('没有生成可用的问题，请完善岗位或简历后重试');
  }
  return result.questions.slice(0, count);
}
