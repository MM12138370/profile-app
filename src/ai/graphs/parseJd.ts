import { Annotation, END, START, StateGraph } from '@langchain/langgraph/web';

import type { StructuredJD } from '../../types';
import { extractJson, GROUNDING_RULE } from '../json';
import { complete } from '../llm';

const State = Annotation.Root({
  rawJd: Annotation<string>,
  structured: Annotation<StructuredJD | null>,
});

type StateType = {
  rawJd: string;
  structured: StructuredJD | null;
};

async function extract(state: StateType) {
  const content = await complete([
    {
      role: 'system',
      content:
        '你是求职JD解析器。只根据用户粘贴的正文提取字段，不要补充未出现的信息。只输出 JSON。' +
        GROUNDING_RULE,
    },
    {
      role: 'user',
      content: `从下面的 JD 正文提取字段，输出 JSON：
{
  "jobTitle": "职位名称",
  "yearsRequired": "工作年限要求",
  "location": "工作地点",
  "jobDescription": "整理后的岗位JD（保留关键职责、要求，不要编造）"
}

JD 正文：
${state.rawJd}`,
    },
  ]);
  const parsed = extractJson<Partial<StructuredJD>>(content);
  return {
    structured: {
      jobTitle: String(parsed.jobTitle ?? '').trim() || '未命名职位',
      yearsRequired: String(parsed.yearsRequired ?? '').trim(),
      location: String(parsed.location ?? '').trim(),
      jobDescription: String(parsed.jobDescription ?? '').trim() || state.rawJd,
    },
  };
}

function normalize(state: StateType) {
  const s = state.structured;
  if (!s) {
    return {};
  }
  return {
    structured: {
      jobTitle: s.jobTitle.trim() || '未命名职位',
      yearsRequired: s.yearsRequired.trim(),
      location: s.location.trim(),
      jobDescription: s.jobDescription.trim() || state.rawJd,
    },
  };
}

const graph = new StateGraph(State)
  .addNode('extract', extract)
  .addNode('normalize', normalize)
  .addEdge(START, 'extract')
  .addEdge('extract', 'normalize')
  .addEdge('normalize', END)
  .compile();

export async function runParseJd(rawJd: string): Promise<StructuredJD> {
  const result = await graph.invoke({ rawJd, structured: null });
  if (!result.structured) {
    throw new Error('JD 结构化失败');
  }
  return result.structured;
}
