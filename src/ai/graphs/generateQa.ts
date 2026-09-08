import { Annotation, END, START, StateGraph } from '@langchain/langgraph/web';

import type { Profile, QAItem, StructuredJD } from '../../types';
import { extractJson, GROUNDING_RULE } from '../json';
import { complete } from '../llm';
import { profileToPrompt } from '../profileText';

const State = Annotation.Root({
  jd: Annotation<StructuredJD>,
  profile: Annotation<Profile>,
  items: Annotation<QAItem[]>,
});

type StateType = {
  jd: StructuredJD;
  profile: Profile;
  items: QAItem[];
};

async function draft(state: StateType) {
  const content = await complete([
    {
      role: 'system',
      content:
        '你是面试教练。根据岗位结构化结果和候选人真实简历出题。答案必须能从简历推得，不能编造经历。只输出 JSON。' +
        GROUNDING_RULE,
    },
    {
      role: 'user',
      content: `岗位：
职位名称：${state.jd.jobTitle}
工作年限：${state.jd.yearsRequired}
工作地点：${state.jd.location}
岗位JD：
${state.jd.jobDescription}

候选人简历：
${profileToPrompt(state.profile)}

请生成 6 到 10 条面试问答，输出：
{ "items": [{ "question": "...", "answer": "..." }] }

要求：
- 问题要紧扣该岗位
- 答案站在这位候选人立场，只用简历里有的事实
- 简历没有的能力，答案里如实写缺口，给出不编造的表达方式`,
    },
  ]);
  const parsed = extractJson<{ items?: QAItem[] }>(content);
  const items = Array.isArray(parsed.items)
    ? parsed.items
        .filter((x) => x && typeof x.question === 'string' && typeof x.answer === 'string')
        .map((x) => ({ question: x.question.trim(), answer: x.answer.trim() }))
        .filter((x) => x.question)
    : [];
  return { items };
}

async function ground(state: StateType) {
  if (state.items.length === 0) {
    return {};
  }
  const content = await complete([
    {
      role: 'system',
      content: '你负责审查面试答案是否编造了简历没有的经历。只输出 JSON。' + GROUNDING_RULE,
    },
    {
      role: 'user',
      content: `简历：
${profileToPrompt(state.profile)}

待审查问答：
${JSON.stringify(state.items, null, 2)}

请返回同样结构：
{ "items": [{ "question": "...", "answer": "..." }] }

删掉或改写任何编造的经历/数据/技能。`,
    },
  ]);
  const parsed = extractJson<{ items?: QAItem[] }>(content);
  const items = Array.isArray(parsed.items)
    ? parsed.items
        .filter((x) => x && typeof x.question === 'string' && typeof x.answer === 'string')
        .map((x) => ({ question: x.question.trim(), answer: x.answer.trim() }))
        .filter((x) => x.question)
    : state.items;
  return { items };
}

const graph = new StateGraph(State)
  .addNode('draft', draft)
  .addNode('ground', ground)
  .addEdge(START, 'draft')
  .addEdge('draft', 'ground')
  .addEdge('ground', END)
  .compile();

export async function runGenerateQa(
  jd: StructuredJD,
  profile: Profile,
): Promise<QAItem[]> {
  const result = await graph.invoke({ jd, profile, items: [] });
  if (!result.items.length) {
    throw new Error('没有生成可用的问答，请完善简历后重试');
  }
  return result.items;
}
