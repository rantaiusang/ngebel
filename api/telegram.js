// /api/telegram.js
import fetch from 'node-fetch';

export default async function handler(req, res) {
  if (req.method === 'POST') {
    const { message } = req.body;
    const TOKEN = process.env.TELEGRAM_BOT_TOKEN; // dari Vercel Env Variable
    const CHAT_ID = process.env.TELEGRAM_CHAT_ID; // ID chat Telegram tujuan

    try {
      await fetch(`https://api.telegram.org/bot${TOKEN}/sendMessage`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ chat_id: CHAT_ID, text: message }),
      });
      res.status(200).json({ ok: true });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  } else {
    res.status(405).json({ error: 'Method not allowed' });
  }
}
