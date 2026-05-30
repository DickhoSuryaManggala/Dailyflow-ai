import { GoogleGenAI } from '@google/genai';

export type LLMProvider = 'gemini' | 'openai' | 'deepseak' | 'claude';

export interface LLMGenerateOptions {
  prompt: string;
  systemInstruction?: string;
  model?: string;
  responseMimeType?: string;
  responseSchema?: any;
}

export interface LLMGenerateResult {
  text: string;
}

export function getLLMProvider(): LLMProvider {
  const provider = (process.env.LLM_PROVIDER || 'gemini').toLowerCase();
  if (provider === 'openai') return 'openai';
  if (provider === 'deepseak') return 'deepseak';
  if (provider === 'claude') return 'claude';
  return 'gemini';
}

export function getLLMApiKey(): string {
  const provider = getLLMProvider();
  const key = process.env.LLM_API_KEY || (
    provider === 'gemini' ? process.env.GEMINI_API_KEY :
    provider === 'openai' ? process.env.OPENAI_API_KEY :
    provider === 'deepseak' ? process.env.DEEPSEAK_API_KEY :
    provider === 'claude' ? process.env.CLAUDE_API_KEY :
    undefined
  );

  if (!key || key === 'MY_GEMINI_API_KEY' || key === 'MY_OPENAI_API_KEY' || key === 'MY_DEEPSEAK_API_KEY' || key === 'MY_CLAUDE_API_KEY') {
    throw new Error(`${provider.toUpperCase()} API key is not configured in environment variables.`);
  }

  return key as string;
}

export function getLLMModel(override?: string): string {
  if (override) return override;
  if (process.env.LLM_MODEL) return process.env.LLM_MODEL;

  switch (getLLMProvider()) {
    case 'openai':
      return 'gpt-4o-mini';
    case 'deepseak':
      return 'deepseak-1';
    case 'claude':
      return 'claude-3.5';
    default:
      return 'gemini-3.5-flash';
  }
}

export function isLLMApiConfigured(): boolean {
  try {
    getLLMApiKey();
    return true;
  } catch {
    return false;
  }
}

export async function generateLLMText(options: LLMGenerateOptions): Promise<LLMGenerateResult> {
  const provider = getLLMProvider();
  const model = getLLMModel(options.model);

  if (provider === 'gemini') {
    return await generateGeminiText({
      prompt: options.prompt,
      systemInstruction: options.systemInstruction,
      model,
      responseMimeType: options.responseMimeType,
      responseSchema: options.responseSchema,
    });
  }

  if (provider === 'openai') {
    return await generateOpenAIText({
      prompt: options.prompt,
      systemInstruction: options.systemInstruction,
      model,
    });
  }

  if (provider === 'deepseak') {
    return await generateDeepseakText({
      prompt: options.prompt,
      systemInstruction: options.systemInstruction,
      model,
    });
  }

  if (provider === 'claude') {
    return await generateClaudeText({
      prompt: options.prompt,
      systemInstruction: options.systemInstruction,
      model,
    });
  }

  throw new Error(`Unsupported LLM provider: ${provider}`);
}

async function generateGeminiText(opts: Pick<LLMGenerateOptions, 'prompt' | 'systemInstruction' | 'model'> & {
  responseMimeType?: string;
  responseSchema?: any;
}): Promise<LLMGenerateResult> {
  const client = new GoogleGenAI({ apiKey: getLLMApiKey() });
  const response = await client.models.generateContent({
    model: opts.model,
    contents: opts.prompt,
    config: {
      systemInstruction: opts.systemInstruction,
      responseMimeType: opts.responseMimeType,
      responseSchema: opts.responseSchema,
    },
  });
  return { text: response.text || '' };
}

async function generateOpenAIText(opts: Pick<LLMGenerateOptions, 'prompt' | 'systemInstruction' | 'model'>): Promise<LLMGenerateResult> {
  const apiKey = getLLMApiKey();
  const response = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: opts.model,
      messages: [
        { role: 'system', content: opts.systemInstruction || 'You are a helpful assistant.' },
        { role: 'user', content: opts.prompt },
      ],
      temperature: 0.7,
      max_tokens: 1024,
    }),
  });

  const body = await response.json();
  if (!response.ok) {
    throw new Error(body.error?.message || `OpenAI request failed with status ${response.status}`);
  }

  const text = body.choices?.map((choice: any) => choice.message?.content || '').join(' ') || '';
  return { text };
}

async function generateDeepseakText(opts: Pick<LLMGenerateOptions, 'prompt' | 'systemInstruction' | 'model'>): Promise<LLMGenerateResult> {
  const apiKey = getLLMApiKey();
  const response = await fetch('https://api.deepseak.ai/v1/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: opts.model,
      prompt: opts.prompt,
      system_instruction: opts.systemInstruction,
      temperature: 0.7,
      max_tokens: 1024,
    }),
  });

  const body = await response.json();
  if (!response.ok) {
    throw new Error(body.error?.message || `DeepSeaK request failed with status ${response.status}`);
  }

  const text = body.output_text || body.choices?.[0]?.text || body.text || body.completion || '';
  return { text };
}

async function generateClaudeText(opts: Pick<LLMGenerateOptions, 'prompt' | 'systemInstruction' | 'model'>): Promise<LLMGenerateResult> {
  const apiKey = getLLMApiKey();
  const prompt = [opts.systemInstruction, opts.prompt].filter(Boolean).join('\n\n');

  const response = await fetch('https://api.anthropic.com/v1/complete', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': apiKey,
    },
    body: JSON.stringify({
      model: opts.model,
      prompt,
      max_tokens_to_sample: 1024,
      temperature: 0.7,
      stop_sequences: ['\n\n'],
    }),
  });

  const body = await response.json();
  if (!response.ok) {
    throw new Error(body.error?.message || `Claude request failed with status ${response.status}`);
  }

  const text = body.completion || body.output_text || body.choices?.[0]?.text || body.text || '';
  return { text };
}
