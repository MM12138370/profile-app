import { Annotation, END, START, StateGraph } from '@langchain/langgraph/web';

import type { InterviewResult, Profile, StructuredJD } from '../../types';
import { jdToPrompt } from '../../jobText';
import { extractJson, GROUNDING_RULE } from '../json';
import { complete } from '../llm';
import { profileToPrompt } from '../profileText';

const State = Annotation.Root({
  jd: Annotation<StructuredJD>,
  profile: Annotation<Profile>,
  questions: Annotation<string[]>,
  standardAnswers: Annotation<string[]>,
  userAnswers: Annotation<string[]>,
  score: Annotation<number>,
  matchScore: Annotation<number>,
  optimizationPoints: Annotation<string>,
});

type StateType = {
  jd: StructuredJD;
  profile: Profile;
  questions: string[];
  standardAnswers: string[];
  userAnswers: string[];
  score: number;
  matchScore: number;
  optimizationPoints: string;
};

async function evaluate(state: StateType) {
  const rounds = state.questions.map((question, i) => ({
    question,
    standardAnswer: state.standardAnswers[i] ?? '',
    userAnswer: state.userAnswers[i] ?? '',
  }));
  const content = await complete([
    {
      role: 'system',
      content:
        '你是面试复盘官。根据问题、参考答案、面试者回答打分。不要因为候选人没提到简历没有的经历而扣「造假」以外的冤枉分。只输出 JSON。' +
        GROUNDING_RULE,
    },
    {
      role: 'user',
      content: `岗位：
${jdToPrompt(state.jd)}

简历：
${profileToPrompt(state.profile)}

三数组回合：
${JSON.stringify(rounds, null, 2)}

输出：
{
  "score": 0到100的整数,
  "matchScore": 1到10的整数,
  "optimizationPoints": "针对表达、匹配度、缺口的优化建议，分点书写"
}`,
    },
  ]);
  const parsed = extractJson<{
    score?: number;
    matchScore?: number;
    optimizationPoints?: string;
  }>(content);
  return {
    score: Number(parsed.score),
    matchScore: Number(parsed.matchScore),
    optimizationPoints: String(parsed.optimizationPoints ?? '').trim(),
  };
}

function clamp(state: StateType) {
  const score = Number.isFinite(state.score)
    ? Math.min(100, Math.max(0, Math.round(state.score)))
    : 0;
  const matchScore = Number.isFinite(state.matchScore)
    ? Math.min(10, Math.max(1, Math.round(state.matchScore)))
    : 1;
  return {
    score,
    matchScore,
    optimizationPoints: state.optimizationPoints || '暂无具体优化点。',
  };
}

const graph = new StateGraph(State)
  .addNode('evaluate', evaluate)
  .addNode('clamp', clamp)
  .addEdge(START, 'evaluate')
  .addEdge('evaluate', 'clamp')
  .addEdge('clamp', END)
  .compile();

export async function runReview(input: {
  jd: StructuredJD;
  profile: Profile;
  questions: string[];
  standardAnswers: string[];
  userAnswers: string[];
}): Promise<Pick<InterviewResult, 'score' | 'matchScore' | 'optimizationPoints'>> {
  const result = await graph.invoke({
    jd: input.jd,
    profile: input.profile,
    questions: input.questions,
    standardAnswers: input.standardAnswers,
    userAnswers: input.userAnswers,
    score: 0,
    matchScore: 1,
    optimizationPoints: '',
  });
  return {
    score: result.score,
    matchScore: result.matchScore,
    optimizationPoints: result.optimizationPoints,
  };
}
