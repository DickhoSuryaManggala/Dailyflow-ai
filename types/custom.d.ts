declare module '@vercel/node';
declare module '@google/genai';

declare namespace NodeJS {
  interface ProcessEnv {
    GEMINI_API_KEY?: string;
    APP_URL?: string;
  }
}

export {};
