import { VercelRequest, VercelResponse } from '@vercel/node';
import { GoogleGenAI, Type } from '@google/genai';

function getGeminiClient() {
  const key = process.env.GEMINI_API_KEY;
  if (!key || key === 'MY_GEMINI_API_KEY') {
    throw new Error('GEMINI_API_KEY is not configured in environment variables.');
  }
  return new GoogleGenAI({ apiKey: key });
}

function getDayName(selectedDate?: string) {
  if (!selectedDate) return '';
  const days = ['Minggu','Senin','Selasa','Rabu','Kamis','Jumat','Sabtu'];
  const parts = selectedDate.split('-');
  let d: Date;
  if (parts.length === 3) {
    const year = parseInt(parts[0],10);
    const month = parseInt(parts[1],10)-1;
    const day = parseInt(parts[2],10);
    d = new Date(year, month, day);
  } else {
    d = new Date(selectedDate);
  }
  if (isNaN(d.getTime())) return '';
  return days[d.getDay()];
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') return res.status(405).json({ success: false, error: 'Method not allowed' });
  try {
    const body = req.body || {};
    const { futureGoals, profession, wakeTime, sleepTime, activityPref, schoolSchedule, jobType, adHocHandling, selectedDate } = body;
    const dayName = getDayName(selectedDate);

    const client = getGeminiClient();

    const prompt = `Anda adalah seorang ahli produktivitas cerdas. Pengguna memiliki profil harian berikut:\n- Profesi: ${profession||'Pelajar/Umum'}\n- Hari Target: ${dayName||'Hari Biasa'} (Tanggal: ${selectedDate||'Tidak disebutkan'})\n- Target Masa Depan: ${futureGoals||'Menjaga kebiasaan harian yang teratur'}\n- Jam Bangun: ${wakeTime||'06:00'}\n- Jam Tidur: ${sleepTime||'22:00'}\n- Preferensi: ${activityPref||'Produktivitas di pagi hari'}`;

    const response = await client.models.generateContent({
      model: 'gemini-3.5-flash',
      contents: prompt,
      config: {
        systemInstruction: 'Anda adalah AI Perancang Jadwal Harian. Berikan output JSON array sesuai skema.',
        responseMimeType: 'application/json',
        responseSchema: {
          type: Type.ARRAY,
          items: {
            type: Type.OBJECT,
            properties: {
              title: { type: Type.STRING },
              notes: { type: Type.STRING },
              startTime: { type: Type.STRING },
              endTime: { type: Type.STRING },
              routine: { type: Type.STRING }
            },
            required: ['title','notes','startTime','endTime','routine']
          }
        }
      }
    });

    let parsed = [];
    try {
      parsed = JSON.parse(response.text || '[]');
    } catch (e) {
      // Return raw text to help debugging if parsing fails
      return res.status(500).json({ success: false, error: 'Invalid JSON from AI', raw: response.text });
    }

    res.status(200).json({ success: true, tasks: parsed });
  } catch (err: any) {
    console.error('Generate Tasks Error:', err);
    res.status(500).json({ success: false, error: err.message || 'Generation failed' });
  }
}
