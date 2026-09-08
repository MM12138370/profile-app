import { loadAiSettings } from '../storage';

export type ChatMessage = {
  role: 'system' | 'user' | 'assistant';
  content: string;
};

export async function complete(
  messages: ChatMessage[],
  options?: { temperature?: number },
): Promise<string> {
  const settings = await loadAiSettings();
  if (!settings.apiKey.trim()) {
    throw new Error('请先在设置里填写 API Key');
  }
  const base = settings.baseURL.replace(/\/+$/, '');
  const url = `${base}/chat/completions`;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 120000);

  try {
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${settings.apiKey.trim()}`,
      },
      body: JSON.stringify({
        model: settings.model.trim(),
        temperature: options?.temperature ?? 0.2,
        stream: false,
        messages,
      }),
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

function parseProviderError(raw: string, status: number): string {
  try {
    const data = JSON.parse(raw) as {
      error?: { message?: string };
      message?: string;
    };
    return data.error?.message || data.message || `接口错误 ${status}`;
  } catch {
    return raw.slice(0, 200) || `接口错误 ${status}`;
  }
}
