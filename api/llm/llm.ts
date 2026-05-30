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

const placeholderKeyPrefixes = ['MY_', 'REPLACE_ME'];
const preferredProviderOrder: LLMProvider[] = ['gemini', 'deepseak', 'claude', 'openai'];

function isValidApiKey(value: string | undefined): value is string {
  return Boolean(value) && !placeholderKeyPrefixes.some(prefix => value.startsWith(prefix));
}

export function getProviderFallbackOrder(provider: LLMProvider): LLMProvider[] {
  const startIndex = preferredProviderOrder.indexOf(provider);
  if (startIndex === -1) return preferredProviderOrder;
  return [
    ...preferredProviderOrder.slice(startIndex),
    ...preferredProviderOrder.slice(0, startIndex),
  ];
}

export function getLLMApiKeyForProvider(provider: LLMProvider): string | undefined {
  const providerKey = provider === 'gemini'
    ? process.env.GEMINI_API_KEY
    : provider === 'openai'
    ? process.env.OPENAI_API_KEY
    : provider === 'deepseak'
    ? process.env.DEEPSEAK_API_KEY
    : provider === 'claude'
    ? process.env.CLAUDE_API_KEY
    : undefined;

  if (isValidApiKey(providerKey)) {
    return providerKey;
  }

  if (isValidApiKey(process.env.LLM_API_KEY)) {
    return process.env.LLM_API_KEY;
  }

  return undefined;
}

export function getLLMApiKey(): string {
  const provider = getLLMProvider();
  const apiKey = getLLMApiKeyForProvider(provider);

  if (!apiKey) {
    throw new Error(`${provider.toUpperCase()} API key is not configured in environment variables.`);
  }

  return apiKey;
}

export function getLLMModel(override?: string, provider?: LLMProvider): string {
  if (override) return override;
  if (process.env.LLM_MODEL) return process.env.LLM_MODEL;

  const targetProvider = provider || getLLMProvider();
  switch (targetProvider) {
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
  const provider = getLLMProvider();
  const providers = getProviderFallbackOrder(provider);
  return providers.some(p => Boolean(getLLMApiKeyForProvider(p)));
}

export async function generateLLMText(options: LLMGenerateOptions): Promise<LLMGenerateResult> {
  const requestedProvider = getLLMProvider();
  const providers = getProviderFallbackOrder(requestedProvider);
  let lastError: Error | null = null;

  for (const provider of providers) {
    const apiKey = getLLMApiKeyForProvider(provider);
    if (!apiKey) continue;

    const model = getLLMModel(options.model, provider);
    try {
      return await generateLLMTextWithKey(provider, apiKey, model, options);
    } catch (err: any) {
      lastError = err instanceof Error ? err : new Error(String(err));
      console.warn(`LLM provider ${provider} failed, trying next provider if available:`, lastError.message);
    }
  }

  if (lastError) {
    throw lastError;
  }

  throw new Error(`No configured API keys found for any supported provider.`);
}

async function generateLLMTextWithKey(provider: LLMProvider, apiKey: string, model: string, options: LLMGenerateOptions): Promise<LLMGenerateResult> {
  if (provider === 'gemini') {
    return await generateGeminiText(apiKey, {
      prompt: options.prompt,
      systemInstruction: options.systemInstruction,
      model,
      responseMimeType: options.responseMimeType,
      responseSchema: options.responseSchema,
    });
  }

  if (provider === 'openai') {
    return await generateOpenAIText(apiKey, {
      prompt: options.prompt,
      systemInstruction: options.systemInstruction,
      model,
    });
  }

  if (provider === 'deepseak') {
    return await generateDeepseakText(apiKey, {
      prompt: options.prompt,
      systemInstruction: options.systemInstruction,
      model,
    });
  }

  if (provider === 'claude') {
    return await generateClaudeText(apiKey, {
      prompt: options.prompt,
      systemInstruction: options.systemInstruction,
      model,
    });
  }

  throw new Error(`Unsupported LLM provider: ${provider}`);
}

async function generateGeminiText(apiKey: string, opts: Pick<LLMGenerateOptions, 'prompt' | 'systemInstruction' | 'model'> & {
  responseMimeType?: string;
  responseSchema?: any;
}): Promise<LLMGenerateResult> {
  const client = new GoogleGenAI({ apiKey });
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

async function generateOpenAIText(apiKey: string, opts: Pick<LLMGenerateOptions, 'prompt' | 'systemInstruction' | 'model'>): Promise<LLMGenerateResult> {
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

async function generateDeepseakText(apiKey: string, opts: Pick<LLMGenerateOptions, 'prompt' | 'systemInstruction' | 'model'>): Promise<LLMGenerateResult> {
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

async function generateClaudeText(apiKey: string, opts: Pick<LLMGenerateOptions, 'prompt' | 'systemInstruction' | 'model'>): Promise<LLMGenerateResult> {
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
