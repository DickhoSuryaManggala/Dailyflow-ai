import { VercelRequest, VercelResponse } from '@vercel/node';
import { GoogleGenAI } from '@google/genai';

function getGeminiClient() {
  const key = process.env.GEMINI_API_KEY;
  if (!key || key === 'MY_GEMINI_API_KEY') throw new Error('GEMINI_API_KEY not set');
  return new GoogleGenAI({ apiKey: key });
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') return res.status(405).json({ success: false, error: 'Method not allowed' });
  try {
    const { futureGoals, completedTasks, totalTasks, focusMinutes } = req.body || {};
    const client = getGeminiClient();

    const prompt = `Buat satu kalimat motivasi personal harian yang sangat singkat dan langsung. Jangan lebih dari satu kalimat. Target: "${futureGoals||'Produktivitas lebih baik'}". Pencapaian: ${completedTasks||0}/${totalTasks||0}. Fokus: ${focusMinutes||0} menit.`;

    const response = await client.models.generateContent({
      model: 'gemini-3.5-flash',
      contents: prompt,
      config: { systemInstruction: 'Anda adalah motivator produktivitas bahasa Indonesia yang hanya menulis satu kalimat motivasi singkat dan tegas.' }
    });

    const rawText = response.text || '';
    const motivationText = rawText.split(/\r?\n/)[0].trim();
    res.status(200).json({ success: true, motivation: motivationText });
  } catch (err: any) {
    console.error('Motivation Error:', err);
    res.status(500).json({ success: false, error: err.message || 'Motivation generation failed' });
  }
}
