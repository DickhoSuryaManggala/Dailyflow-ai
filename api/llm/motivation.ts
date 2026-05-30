import { VercelRequest, VercelResponse } from '@vercel/node';
import { generateLLMText, getLLMModel } from './llm.ts';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') return res.status(405).json({ success: false, error: 'Method not allowed' });
  try {
    const body = req.body || {};
    const { futureGoals, completedTasks, totalTasks, focusMinutes, model: requestedModel } = body;
    const model = requestedModel || getLLMModel();

    const prompt = `Buat satu kalimat motivasi personal harian yang sangat singkat dan langsung. Jangan lebih dari satu kalimat. Target: "${futureGoals || 'Produktivitas lebih baik'}". Pencapaian: ${completedTasks || 0}/${totalTasks || 0}. Fokus: ${focusMinutes || 0} menit.`;

    const response = await generateLLMText({
      model,
      prompt,
      systemInstruction: 'Anda adalah motivator produktivitas bahasa Indonesia yang hanya menulis satu kalimat motivasi singkat dan tegas.',
    });

    const motivationText = response.text.split(/\r?\n/)[0].trim();
    res.status(200).json({ success: true, motivation: motivationText });
  } catch (err: any) {
    console.error('Motivation Error:', err);
    res.status(500).json({ success: false, error: err.message || 'Motivation generation failed' });
  }
}
