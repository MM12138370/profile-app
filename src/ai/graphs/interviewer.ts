import { Annotation, END, START, StateGraph } from '@langchain/langgraph/web';

import type { Profile, StructuredJD } from '../../types';
import { extractJson, GROUNDING_RULE } from '../json';
import { complete } from '../llm';
import { profileToPrompt } from '../profileText';

export type InterviewTurn = {
  question: string;
  userAnswer: string;
  standardAnswer: string;
};

const State = Annotation.Root({
  jd: Annotation<StructuredJD>,
  profile: Annotation<Profile>,
  history: Annotation<InterviewTurn[]>,
  question: Annotation<string>,
  standardAnswer: Annotation<string>,
});

type StateType = {
  jd: StructuredJD;
  profile: Profile;
  history: InterviewTurn[];
  question: string;
  standardAnswer: string;
};

async function composeQuestion(state: StateType) {
  const asked = state.history
    .map((h) => `Q: ${h.question}\nA: ${h.userAnswer}`)
    .join('\n\n');
  const content = await complete(
    [
      {
        role: 'system',
        content:
          '你是该岗位的面试官。一次只问一个问题。不要假设候选人拥有简历没有的经历。只输出 JSON。' +
          GROUNDING_RULE,
      },
      {
        role: 'user',
        content: `岗位：${state.jd.jobTitle}
年限：${state.jd.yearsRequired}
地点：${state.jd.location}
JD：
${state.jd.jobDescription}

候选人简历：
${profileToPrompt(state.profile)}

已问过：
${asked || '（还没有）'}

请给出下一个面试问题，以及结合该候选人真实背景的参考答案。
输出：
{ "question": "...", "standardAnswer": "..." }`,
      },
    ],
    { temperature: 0.4 },
  );
  const parsed = extractJson<{ question?: string; standardAnswer?: string }>(content);
  return {
    question: String(parsed.question ?? '').trim(),
    standardAnswer: String(parsed.standardAnswer ?? '').trim(),
  };
}

function validate(state: StateType) {
  if (!state.question) {
    throw new Error('面试官没有给出问题');
  }
  return {
    question: state.question,
    standardAnswer: state.standardAnswer || '（简历信息不足，无法给出基于事实的标准答案）',
  };
}

const graph = new StateGraph(State)
  .addNode('compose', composeQuestion)
  .addNode('validate', validate)
  .addEdge(START, 'compose')
  .addEdge('compose', 'validate')
  .addEdge('validate', END)
  .compile();

export async function runInterviewer(input: {
  jd: StructuredJD;
  profile: Profile;
  history: InterviewTurn[];
}): Promise<{ question: string; standardAnswer: string }> {
  const result = await graph.invoke({
    jd: input.jd,
    profile: input.profile,
    history: input.history,
    question: '',
    standardAnswer: '',
  });
  return { question: result.question, standardAnswer: result.standardAnswer };
}
