import { loadAiSettings } from '../storage';

export type ChatContentPart =
  | { type: 'text'; text: string }
  | { type: 'image_url'; image_url: { url: string } };

export type ChatMessage = {
  role: 'system' | 'user' | 'assistant';
  content: string | ChatContentPart[];
};

export async function complete(messages: ChatMessage[]): Promise<string> {
  const settings = await loadAiSettings();
  if (!settings.apiKey.trim()) {
    throw new Error('请先在设置 › 连接大模型 里填写 API Key');
  }
  const model = settings.model.trim();
  const base = settings.baseURL.replace(/\/+$/, '');
  const url = `${base}/chat/completions`;
  const body: Record<string, unknown> = { model, messages };
  if (!usesFixedSampling(model)) {
    body.temperature = 0.2;
  }

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 120000);

  try {
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${settings.apiKey.trim()}`,
      },
      body: JSON.stringify(body),
      signal: controller.signal,
    });

    const raw = await response.text();
    if (!response.ok) {
      throw new Error(parseProviderError(raw, response.status));
    }
    const data = JSON.parse(raw) as {
      choices?: Array<{ message?: { content?: string } }>;
    };
    const content = data.choices?.[0]?.message?.content?.trim();
    if (!content) {
      throw new Error('模型返回为空');
    }
    return content;
  } catch (error) {
    if (error instanceof Error && error.name === 'AbortError') {
      throw new Error('请求超时，请稍后重试');
    }
    throw error;
  } finally {
    clearTimeout(timer);
  }
}

/** Kimi / Moonshot 新模型不允许改 temperature，带上会 400。 */
function usesFixedSampling(model: string): boolean {
  const name = model.toLowerCase();
  return name.startsWith('kimi-') || name.startsWith('moonshot-kimi');
}

function parseProviderError(raw: string, status: number): string {
  try {
    const data = JSON.parse(raw) as {
      error?: { message?: string } | string;
      message?: string;
      msg?: string;
    };
    const fromError =
      typeof data.error === 'string' ? data.error : data.error?.message;
    return fromError || data.message || data.msg || `接口错误 ${status}`;
  } catch {
    return raw.slice(0, 200) || `接口错误 ${status}`;
  }
}
