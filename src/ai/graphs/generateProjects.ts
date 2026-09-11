import { Annotation, END, START, StateGraph } from '@langchain/langgraph/web';

import type { Profile, SectionNode, StructuredJD } from '../../types';
import { profileHasContent, sanitizeSections } from '../../types';
import { extractJson, GROUNDING_RULE } from '../json';
import { complete } from '../llm';
import { profileToPrompt } from '../profileText';

const State = Annotation.Root({
  jd: Annotation<StructuredJD>,
  profile: Annotation<Profile>,
  projects: Annotation<SectionNode[]>,
});

type StateType = {
  jd: StructuredJD;
  profile: Profile;
  projects: SectionNode[];
};

async function draft(state: StateType) {
  if (!profileHasContent(state.profile)) {
    return { projects: [] as SectionNode[] };
  }
  const content = await complete([
    {
      role: 'system',
      content:
        '你把候选人已有经历改写成可插入简历的板块树。只能重组、提炼简历里已有内容，禁止新增项目或技能。只输出 JSON。' +
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

输出与简历板块同构的递归数组：
{ "projects": [ { "title": "...", "content": "..." }, [ { "title": "...", "content": "..." } ] ] }

规则：
- 每个元素要么是 {title, content}，要么是同构子数组
- 只使用简历里出现过的项目、工作、技能
- 按该岗位相关性整理标题和表述
- 若简历几乎没有可映射内容，返回空数组`,
    },
  ]);
  const parsed = extractJson<{ projects?: unknown }>(content);
  return { projects: sanitizeSections(parsed.projects) };
}

async function ground(state: StateType) {
  if (state.projects.length === 0) {
    return {};
  }
  const content = await complete([
    {
      role: 'system',
      content: '审查项目板块是否编造了简历没有的经历。只输出 JSON。' + GROUNDING_RULE,
    },
    {
      role: 'user',
      content: `简历：
${profileToPrompt(state.profile)}

待审查板块：
${JSON.stringify(state.projects, null, 2)}

返回：
{ "projects": [ ...同构递归数组 ] }

删除无法从简历支持的条目。`,
    },
  ]);
  const parsed = extractJson<{ projects?: unknown }>(content);
  return { projects: sanitizeSections(parsed.projects) };
}

const graph = new StateGraph(State)
  .addNode('draft', draft)
  .addNode('ground', ground)
  .addEdge(START, 'draft')
  .addEdge('draft', 'ground')
  .addEdge('ground', END)
  .compile();

export async function runGenerateProjects(
  jd: StructuredJD,
  profile: Profile,
): Promise<SectionNode[]> {
  const result = await graph.invoke({ jd, profile, projects: [] });
  return result.projects;
}
