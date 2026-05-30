import { VercelRequest, VercelResponse } from '@vercel/node';
import { generateLLMText, getLLMModel } from '../../llm.ts';

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
    const { futureGoals, profession, wakeTime, sleepTime, activityPref, schoolSchedule, jobType, adHocHandling, selectedDate, model: requestedModel } = body;
    const dayName = getDayName(selectedDate);
    const model = requestedModel || getLLMModel();

    const prompt = `Anda adalah seorang ahli produktivitas cerdas. Pengguna memiliki profil harian berikut:\n- Profesi: ${profession || 'Pelajar/Umum'}\n- Hari Target: ${dayName || 'Hari Biasa'} (Tanggal: ${selectedDate || 'Tidak disebutkan'})\n- Target Masa Depan: ${futureGoals || 'Menjaga kebiasaan harian yang teratur'}\n- Jam Bangun: ${wakeTime || '06:00'}\n- Jam Tidur: ${sleepTime || '22:00'}\n- Preferensi: ${activityPref || 'Produktivitas di pagi hari'}`;

    const response = await generateLLMText({
      model,
      prompt,
      systemInstruction: 'Anda adalah AI Perancang Jadwal Harian. Berikan output JSON array sesuai skema.',
      responseMimeType: 'application/json',
      responseSchema: {
        type: 'array',
        items: {
          type: 'object',
          properties: {
            title: { type: 'string' },
            notes: { type: 'string' },
            startTime: { type: 'string' },
            endTime: { type: 'string' },
            routine: { type: 'string' }
          },
          required: ['title','notes','startTime','endTime','routine']
        }
      }
    });

    let parsed = [];
    try {
      parsed = JSON.parse(response.text || '[]');
    } catch (e) {
      return res.status(500).json({ success: false, error: 'Invalid JSON from AI', raw: response.text });
    }

    res.status(200).json({ success: true, tasks: parsed });
  } catch (err: any) {
    console.error('Generate Tasks Error:', err);
    res.status(500).json({ success: false, error: err.message || 'Generation failed' });
  }
}
