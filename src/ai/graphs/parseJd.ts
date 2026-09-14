import { normalizeStructuredJd, type StructuredJD } from '../../types';
import { extractJson, GROUNDING_RULE } from '../json';
import { complete, type ChatContentPart } from '../llm';

export type JobImageInput = {
  mimeType: string;
  base64: string;
};

export type AnalyzeJobInput = {
  text?: string;
  images?: JobImageInput[];
};

export async function runAnalyzeJob(input: AnalyzeJobInput): Promise<StructuredJD> {
  const rawJd = input.text?.trim() ?? '';
  const images = input.images ?? [];
  if (!rawJd && images.length === 0) {
    throw new Error('请先填写岗位信息或添加图片');
  }

  const prompt = `从下面的岗位信息提取字段，只根据已有内容，不要编造。没有的字段输出空字符串。分条内容用换行分隔。只输出 JSON：
{
  "jobTitle": "岗位名称",
  "yearsRequired": "工作年限",
  "location": "工作地点",
  "responsibilities": "岗位职责",
  "requirements": "任职要求",
  "benefits": "福利待遇"
}

${rawJd ? `岗位文本：\n${rawJd}` : '岗位信息在图片中。'}`;

  const userContent: string | ChatContentPart[] =
    images.length === 0
      ? prompt
      : [
          { type: 'text', text: prompt },
          ...images.map((image) => ({
            type: 'image_url' as const,
            image_url: { url: `data:${image.mimeType};base64,${image.base64}` },
          })),
        ];

  const content = await complete([
    {
      role: 'system',
      content:
        '你是求职JD解析器。把信息拆成指定字段，不要补充未出现的内容。只输出 JSON。' +
        GROUNDING_RULE,
    },
    { role: 'user', content: userContent },
  ]);
  return normalizeStructuredJd(extractJson<Partial<StructuredJD>>(content));
}
