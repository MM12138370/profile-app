import { Annotation, END, START, StateGraph } from '@langchain/langgraph/web';

import { extractJson } from '../json';
import { complete } from '../llm';

export type DedupeCandidate = {
  id: string;
  question: string;
};

const State = Annotation.Root({
  pending: Annotation<DedupeCandidate[]>,
  existing: Annotation<string[]>,
  keepIds: Annotation<string[]>,
});

type StateType = {
  pending: DedupeCandidate[];
  existing: string[];
  keepIds: string[];
};

async function pick(state: StateType) {
  const pending = state.pending.filter((item) => item.id && item.question.trim());
  const existing = state.existing.map((item) => item.trim()).filter(Boolean);
  if (!pending.length) {
    return { keepIds: [] };
  }
  if (!existing.length) {
    return { keepIds: pending.map((item) => item.id) };
  }
  const content = await complete([
    {
      role: 'system',
      content:
        '你筛选面试问题。只保留与已有问题语义不重复的待保存问题。同义改写、同一考点视为重复。只输出 JSON。',
    },
    {
      role: 'user',
      content: `已有问题：
${existing.map((item) => `- ${item}`).join('\n')}

待保存问题：
${pending.map((item) => `- ${item.id}: ${item.question}`).join('\n')}

输出：
{ "ids": ["保留的待保存问题唯一id"] }

要求：
- ids 只能来自待保存问题
- 与已有问题语义重复的不要放入 ids
- 待保存问题彼此重复时只留一题`,
    },
  ]);
  const parsed = extractJson<{ ids?: unknown }>(content);
  const allowed = new Set(pending.map((item) => item.id));
  const keepIds = Array.isArray(parsed.ids)
    ? parsed.ids.map((item) => String(item ?? '').trim()).filter((id) => allowed.has(id))
    : [];
  return { keepIds };
}

const graph = new StateGraph(State)
  .addNode('pick', pick)
  .addEdge(START, 'pick')
  .addEdge('pick', END)
  .compile();

export async function runDedupeQa(
  pending: DedupeCandidate[],
  existing: string[],
): Promise<string[]> {
  const result = await graph.invoke({ pending, existing, keepIds: [] });
  return result.keepIds;
}
