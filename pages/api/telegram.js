// pages/api/telegram.js
import { createClient } from '@supabase/supabase-js';

// ==========================================
// KONFIGURASI SUPABASE
// ==========================================
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY; 
const supabase = createClient(supabaseUrl, supabaseServiceKey);

// ==========================================
// HANDLER UTAMA
// ==========================================
export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method Not Allowed' });
  }

  try {
    const body = req.body; // Next.js auto-parsing

    // ===============================
    // A. DARI WEBSITE → KIRIM KE TELEGRAM
    // ===============================
    if (body.message && typeof body.message === 'string') {
      
      const TOKEN = process.env.TELEGRAM_BOT_TOKEN;
      const CHAT_ID = process.env.TELEGRAM_CHAT_ID;

      // 1. Kirim ke Telegram
      const response = await fetch(`https://api.telegram.org/bot${TOKEN}/sendMessage`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          chat_id: CHAT_ID,
          text: body.message,
        }),
      });

      if (!response.ok) {
        return res.status(400).json({ error: 'Gagal kirim ke Telegram' });
      }

      // 2. SIMPAN KE DATABASE (Termasuk telegram_chat_id & session_id)
      // Frontend WAJIB mengirim session_id di body request
      if (body.session_id) {
        await supabase.from('chats').insert([
          {
            sender: 'user',
            message: body.message,
            session_id: body.session_id,
            telegram_chat_id: CHAT_ID // Simpan Chat ID tujuan
          }
        ]);
        console.log(`✅ Pesan disimpan. Session: ${body.session_id}, Telegram ID: ${CHAT_ID}`);
      }

      return res.status(200).json({ success: true });
    }

    // ===============================
    // B. DARI TELEGRAM → WEBHOOK MASUK (ROUTING AKURAT)
    // ===============================
    else if (body.message && body.message.chat) {
      const incomingChatId = body.message.chat.id;
      const text = body.message.text;

      console.log(`📩 Webhook dari Chat ID: ${incomingChatId}`);

      // CARI SESSION YANG TEPAT berdasarkan telegram_chat_id
      // Ini memastikan balasan sampai ke user yang benar
      const { data: targetChat } = await supabase
        .from('chats')
        .select('session_id')
        .eq('telegram_chat_id', incomingChatId)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle(); // Gunakan maybeSingle agar tidak error jika tidak ketemu

      if (targetChat) {
        // Simpan balasan admin
        await supabase.from('chats').insert([
          {
            sender: 'admin',
            message: text,
            session_id: targetChat.session_id,
            telegram_chat_id: incomingChatId
          }
        ]);
        console.log(`✅ Balasan disimpan untuk session: ${targetChat.session_id}`);
      } else {
        console.warn('⚠️ Chat ID tidak ditemukan di database local.');
      }

      return res.status(200).json({ ok: true });
    }

    return res.status(200).json({ ok: true });

  } catch (error) {
    console.error('Error:', error);
    return res.status(500).json({ error: 'Internal Server Error' });
  }
}
