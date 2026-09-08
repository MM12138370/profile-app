export function extractJson<T>(text: string): T {
  const trimmed = text.trim();
  const fenced = trimmed.match(/```(?:json)?\s*([\s\S]*?)```/i);
  const body = (fenced ? fenced[1] : trimmed).trim();
  const objStart = body.indexOf('{');
  const arrStart = body.indexOf('[');
  let start = -1;
  if (objStart >= 0 && arrStart >= 0) {
    start = Math.min(objStart, arrStart);
  } else {
    start = Math.max(objStart, arrStart);
  }
  const end = Math.max(body.lastIndexOf('}'), body.lastIndexOf(']'));
  if (start < 0 || end < start) {
    throw new Error('模型没有返回可解析的 JSON');
  }
  return JSON.parse(body.slice(start, end + 1)) as T;
}

export const GROUNDING_RULE =
  '禁止编造用户没有的经历、数据、技能。简历未写明的内容只能标为缺口或未知，绝不能写成用户已经具备。';
