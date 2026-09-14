import { Annotation, END, START, StateGraph } from '@langchain/langgraph/web';

import type { StructuredJD } from '../../types';
import { jdToPrompt } from '../../jobText';
import { extractJson, GROUNDING_RULE } from '../json';
import { complete } from '../llm';

export type PolishDraft = {
  question: string;
  answer: string;
};

export type PolishResult = {
  question: string;
  polishedAnswer: string;
  polishTips: string;
};

const State = Annotation.Root({
  jd: Annotation<StructuredJD>,
  items: Annotation<PolishDraft[]>,
  polished: Annotation<PolishResult[]>,
});

type StateType = {
  jd: StructuredJD;
  items: PolishDraft[];
  polished: PolishResult[];
};

async function polish(state: StateType) {
  const content = await complete([
    {
      role: 'system',
      content:
        '你是面试表达教练。只润色候选人已写的回答，提炼语句、理顺逻辑，不新增经历、数据或技能。只输出 JSON。' +
        GROUNDING_RULE,
    },
    {
      role: 'user',
      content: `岗位：
${jdToPrompt(state.jd)}

候选人原答：
${JSON.stringify(state.items, null, 2)}

请按相同顺序返回：
{
  "items": [
    {
      "question": "原问题",
      "polishedAnswer": "润色后的回答",
      "polishTips": "针对这题的润色建议，分点写清改了什么、为什么更好"
    }
  ]
}

要求：
- 保持原意，只改表达、结构、岗位相关措辞
- 原答没有的事实一律不要补
- 若原答已经通顺，可小幅整理，不要空转套话`,
    },
  ]);
  const parsed = extractJson<{ items?: unknown }>(content);
  const rows = Array.isArray(parsed.items) ? parsed.items : [];
  const polished = state.items.map((item, index) => {
    const row = rows[index] && typeof rows[index] === 'object' ? (rows[index] as Record<string, unknown>) : {};
    return {
      question: item.question,
      polishedAnswer: String(row.polishedAnswer ?? '').trim(),
      polishTips: String(row.polishTips ?? '').trim(),
    };
  });
  return { polished };
}

const graph = new StateGraph(State)
  .addNode('polish', polish)
  .addEdge(START, 'polish')
  .addEdge('polish', END)
  .compile();

export async function runPolishQa(
  jd: StructuredJD,
  items: PolishDraft[],
): Promise<PolishResult[]> {
  const ready = items.filter((item) => item.question.trim() && item.answer.trim());
  if (ready.length === 0) {
    throw new Error('请先答完所有问题再润色');
  }
  const result = await graph.invoke({ jd, items: ready, polished: [] });
  if (!result.polished.some((item) => item.polishedAnswer || item.polishTips)) {
    throw new Error('没有生成可用的润色结果，请稍后重试');
  }
  return result.polished;
}
