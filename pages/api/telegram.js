// pages/api/telegram.js
import { createClient } from '@supabase/supabase-js';

// ==========================================
// KONFIGURASI SUPABASE (ADMIN ACCESS)
// ==========================================
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY; 

const supabase = createClient(supabaseUrl, supabaseServiceKey);

// ==========================================
// HANDLER UTAMA (SATU PINTU UNTUK SEMUA)
// ==========================================
export default async function handler(req, res) {
  // Hanya izinkan POST
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method Not Allowed' });
  }

  try {
    const body = await req.json();

    // 3. LOGIKA PEMISAHAN: INI DARI MANA?
    
    // --- KASUS A: DARI WEBSITE (User mengirim pesan) ---
    // Ciri: Body punya key "message" string, TIDAK punya "chat_id"
    if (body.message && typeof body.message === 'string' && !body.message?.chat_id) {
      
      console.log('📤 [Dari Website] Mengirim pesan ke Telegram...');

      const messageText = body.message;
      const TOKEN = process.env.TELEGRAM_BOT_TOKEN;
      const CHAT_ID = process.env.TELEGRAM_CHAT_ID;

      if (!TOKEN || !CHAT_ID) {
        return res.status(500).json({ error: 'Missing Token/ChatID' });
      }

      const response = await fetch(`https://api.telegram.org/bot${TOKEN}/sendMessage`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          chat_id: CHAT_ID,
          text: messageText,
          parse_mode: 'HTML',
          disable_web_page_preview: true
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        console.error('Telegram Error:', errorData);
        return res.status(400).json({ error: 'Gagal kirim ke Telegram', details: errorData });
      }

      console.log('✅ Sukses kirim ke Telegram');
      return res.status(200).json({ success: true });
    }

    // --- KASUS B: DARI TELEGRAM (Admin membalas / Webhook) ---
    // Ciri: Struktur Telegram (message.chat.id, message.from, dll)
    else if (body.message && body.message.chat_id) {
      console.log('📩 [Dari Telegram] Menerima Webhook...');

      const text = body.message.text;

      // Cari user terakhir
      const { data: lastUserMsg } = await supabase
        .from('chats')
        .select('session_id')
        .eq('sender', 'user')
        .order('created_at', { ascending: false })
        .limit(1)
        .single();

      if (lastUserMsg) {
        await supabase.from('chats').insert([
          {
            sender: 'admin',
            message: text,
            session_id: lastUserMsg.session_id
          }
        ]);
        console.log('✅ Balasan disimpan.');
      }

      return res.status(200).json({ ok: true });
    }

    // Format tidak dikenali
    else {
      return res.status(200).json({ ok: true });
    }

  } catch (error) {
    console.error('💥 Internal Error:', error);
    return res.status(500).json({ error: 'Internal Server Error' });
  }
}
