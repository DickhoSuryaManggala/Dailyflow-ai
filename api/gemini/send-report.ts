import { VercelRequest, VercelResponse } from '@vercel/node';

export default function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') return res.status(405).json({ success: false, error: 'Method not allowed' });
  try {
    const { email, reportType, monthString } = req.body || {};
    if (!email || !email.includes('@')) return res.status(400).json({ success: false, error: 'Invalid email' });

    const timestampStr = new Date().toISOString();
    console.log(`[EMAIL SYSTEM] Dispatching automated report at ${timestampStr} to ${email}`);

    res.status(200).json({
      success: true,
      sentAt: timestampStr,
      recipient: email,
      subject: `[DailyFlow AI] Laporan ${reportType} - ${monthString}`,
      message: `Laporan ${reportType} untuk ${monthString} berhasil dikirim ke ${email} (simulasi).`
    });
  } catch (err: any) {
    console.error('Send Report Error:', err);
    res.status(500).json({ success: false, error: err.message || 'Send report failed' });
  }
}
