import { VercelRequest, VercelResponse } from '@vercel/node';
import { generateLLMText, getLLMModel } from '../../llm';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') return res.status(405).json({ success: false, error: 'Method not allowed' });
  try {
    const body = req.body || {};
    const { monthString, futureGoals, analyticsSummary, averageFocusTime, completionRate, model: requestedModel } = body;
    const model = requestedModel || getLLMModel();

    const prompt = `Berikan evaluasi performa bulanan untuk ${monthString || 'Bulan Ini'} berdasarkan data.`;

    const response = await generateLLMText({
      model,
      prompt,
      systemInstruction: 'Anda adalah Coach Produktivitas yang memberi evaluasi JSON.',
      responseMimeType: 'application/json',
      responseSchema: {
        type: 'object',
        properties: {
          productivityScore: { type: 'integer' },
          strengths: { type: 'array', items: { type: 'string' } },
          weaknesses: { type: 'array', items: { type: 'string' } },
          recommendations: { type: 'array', items: { type: 'string' } }
        },
        required: ['productivityScore','strengths','weaknesses','recommendations']
      }
    });

    try {
      const parsed = JSON.parse(response.text || '{}');
      res.status(200).json({ success: true, evaluation: parsed });
    } catch (e) {
      return res.status(500).json({ success: false, error: 'Invalid JSON from AI', raw: response.text });
    }
  } catch (err: any) {
    console.error('Evaluate Month Error:', err);
    res.status(500).json({ success: false, error: err.message || 'Evaluation failed' });
  }
}
