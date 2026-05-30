import { VercelRequest, VercelResponse } from '@vercel/node';
import { GoogleGenAI } from '@google/genai';

function getGeminiClient() {
  const key = process.env.GEMINI_API_KEY;
  if (!key || key === 'MY_GEMINI_API_KEY') {
    throw new Error('GEMINI_API_KEY is not configured in environment variables.');
  }
  return new GoogleGenAI({ apiKey: key });
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') return res.status(405).json({ success: false, error: 'Method not allowed' });
  try {
    const { futureGoals, completedTasks, totalTasks, focusMinutes, distractionMinutes } = req.body || {};
    const client = getGeminiClient();

    const prompt = `Lakukan roasting (kritik pedas, sarkastik, tapi sangat lucu, kocak, dan mendidik) dalam Bahasa Indonesia santai untuk seseorang dengan detail progres berikut:\n- Target Masa Depan: "${futureGoals || 'Sukses mulia tanpa usaha'}"\n- Tugas Selesai: menyelesaikan ${completedTasks || 0} dari total ${totalTasks || 0} tugas hari ini.\n- Waktu Fokus: ${focusMinutes || 0} menit.\n- Jeda Terganggu/Distraksi: ${distractionMinutes || 0} menit.`;

    const response = await client.models.generateContent({
      model: 'gemini-3.5-flash',
      contents: prompt,
      config: {
        systemInstruction: 'Anda adalah AI Roaster spesialis produktivitas. Gaya Anda sarkastik, lucu, namun mendorong.'
      }
    });

    res.status(200).json({ success: true, roast: response.text || '' });
  } catch (err: any) {
    console.error('Roast Error:', err);
    res.status(500).json({ success: false, error: err.message || 'Roast generation failed' });
  }
}
