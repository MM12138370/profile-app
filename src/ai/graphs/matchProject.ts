import { Annotation, END, START, StateGraph } from '@langchain/langgraph/web';

import type { StructuredJD } from '../../types';
import { jdToPrompt } from '../../jobText';
import { extractJson, GROUNDING_RULE } from '../json';
import { complete } from '../llm';

export type ProjectMatchResult = {
  points: string;
  optimized: string;
};

const State = Annotation.Root({
  jd: Annotation<StructuredJD>,
  original: Annotation<string>,
  points: Annotation<string>,
  optimized: Annotation<string>,
});

type StateType = {
  jd: StructuredJD;
  original: string;
  points: string;
  optimized: string;
};

async function match(state: StateType) {
  const content = await complete([
    {
      role: 'system',
      content:
        '你帮助候选人把真实做过的项目写得更贴当前岗位。只能提炼、重组用户已写内容，禁止编造项目、职责、技术和数据。只输出 JSON。' +
        GROUNDING_RULE,
    },
    {
      role: 'user',
      content: `岗位：
${jdToPrompt(state.jd)}

用户描述的真实项目：
${state.original}

请输出：
{
  "points": "从原文提炼的重点，分点列出",
  "optimized": "贴合该岗位的项目表述，可直接放进简历"
}

要求：
- 突出与岗位职责、任职要求重叠的部分
- 没有的成果不要编数字
- 保持第一人称或简历常用陈述均可，但不要空话`,
    },
  ]);
  const parsed = extractJson<{ points?: unknown; optimized?: unknown }>(content);
  return {
    points: String(parsed.points ?? '').trim(),
    optimized: String(parsed.optimized ?? '').trim(),
  };
}

const graph = new StateGraph(State)
  .addNode('match', match)
  .addEdge(START, 'match')
  .addEdge('match', END)
  .compile();

export async function runMatchProject(
  jd: StructuredJD,
  original: string,
): Promise<ProjectMatchResult> {
  const text = original.trim();
  if (!text) {
    throw new Error('请先填写你真实产出或跟进过的项目');
  }
  const result = await graph.invoke({ jd, original: text, points: '', optimized: '' });
  if (!result.optimized) {
    throw new Error('没有生成可用的项目表述，请补充项目细节后重试');
  }
  return { points: result.points, optimized: result.optimized };
}
