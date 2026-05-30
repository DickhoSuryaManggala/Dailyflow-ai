import { VercelRequest, VercelResponse } from '@vercel/node';
import { GoogleGenAI, Type } from '@google/genai';

function getGeminiClient() {
  const key = process.env.GEMINI_API_KEY;
  if (!key || key === 'MY_GEMINI_API_KEY') throw new Error('GEMINI_API_KEY not set');
  return new GoogleGenAI({ apiKey: key });
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') return res.status(405).json({ success: false, error: 'Method not allowed' });
  try {
    const { monthString, futureGoals, analyticsSummary, averageFocusTime, completionRate } = req.body || {};
    const client = getGeminiClient();

    const prompt = `Berikan evaluasi performa bulanan untuk ${monthString||'Bulan Ini'} berdasarkan data.`;

    const response = await client.models.generateContent({
      model: 'gemini-3.5-flash',
      contents: prompt,
      config: {
        systemInstruction: 'Anda adalah Coach Produktivitas yang memberi evaluasi JSON.',
        responseMimeType: 'application/json',
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            productivityScore: { type: Type.INTEGER },
            strengths: { type: Type.ARRAY, items: { type: Type.STRING } },
            weaknesses: { type: Type.ARRAY, items: { type: Type.STRING } },
            recommendations: { type: Type.ARRAY, items: { type: Type.STRING } }
          },
          required: ['productivityScore','strengths','weaknesses','recommendations']
        }
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
