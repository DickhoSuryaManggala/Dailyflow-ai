import { VercelRequest, VercelResponse } from '@vercel/node';
import { getLLMProvider, isLLMApiConfigured } from '../../llm.ts';

export default function handler(req: VercelRequest, res: VercelResponse) {
  res.status(200).json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    provider: getLLMProvider(),
    apiConfigured: isLLMApiConfigured(),
  });
}
