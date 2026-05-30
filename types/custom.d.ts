declare module '@vercel/node';
declare module '@google/genai';

declare namespace NodeJS {
  interface ProcessEnv {
    GEMINI_API_KEY?: string;
    OPENAI_API_KEY?: string;
    DEEPSEAK_API_KEY?: string;
    CLAUDE_API_KEY?: string;
    LLM_API_KEY?: string;
    LLM_PROVIDER?: string;
    LLM_MODEL?: string;
    APP_URL?: string;
  }
}

export {};
