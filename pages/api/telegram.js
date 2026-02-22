// telegram.js (atau api.js)
import { createClient } from '@supabase/supabase-js';

// ==========================================
// KONFIGURASI SUPABASE
// ==========================================
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY; 

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('❌ Missing SUPABASE_SERVICE_ROLE_KEY');
}

const supabase = createClient(supabaseUrl, supabaseServiceKey);

// ==========================================
// HANDLER UTAMA (SATU PINTU UNTUK SEMUA)
// ==========================================
export default async function handler(req, res) {
  // 1. Cek Method: Hanya izinkan POST
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method Not Allowed' });
  }

  try {
    // 2. Ambil Body Request
    let body;
    try {
      body = await req.json();
    } catch (e) {
      // Jika body kosong (misal: ping dari Telegram)
      return res.status(200).json({ ok: true });
    }

    // 3. LOGIKA PEMISAHAN: INI DARI MANA?
    
    // --- KASUS A: DARI WEBSITE (User mengirim pesan) ---
    // Ciri-ciri: Body memiliki key "message" yang isinya string sederhana, TIDAK memiliki "chat_id"
    if (body.message && typeof body.message === 'string' && !body.message?.chat_id) {
      console.log('📤 [Dari Website] Mengirim pesan ke Telegram...');

      const messageText = body.message;
      const TOKEN = process.env.TELEGRAM_BOT_TOKEN;
      const CHAT_ID = process.env.TELEGRAM_CHAT_ID;

      if (!TOKEN || !CHAT_ID) {
        return res.status(500).json({ error: 'Missing Token/ChatID di Env Var' });
      }

      // Kirim ke Telegram API
      const telegramResponse = await fetch(`https://api.telegram.org/bot${TOKEN}/sendMessage`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          chat_id: CHAT_ID,
          text: messageText,
          parse_mode: 'HTML',
          disable_web_page_preview: true
        }),
      });

      if (!telegramResponse.ok) {
        const errorData = await telegramResponse.json();
        console.error('❌ Gagal kirim ke Telegram:', errorData);
        return res.status(400).json({ error: 'Gagal kirim ke Telegram', details: errorData });
      }

      console.log('✅ Sukses kirim ke Telegram');
      return res.status(200).json({ success: true, message: 'Pesan terkirim' });
    }

    // --- KASUS B: DARI TELEGRAM (Admin membalas pesan / Webhook) ---
    // Ciri-ciri: Body memiliki struktur Telegram (message.chat.id, message.from, dll)
    else if (body.message && body.message.chat_id) {
      console.log('📩 [Dari Telegram] Menerima Webhook...');

      const text = body.message.text;

      // 1. Cari pesan User terakhir di DB (untuk tahu mau dibalas ke siapa)
      const { data: lastUserMsg, error } = await supabase
        .from('chats')
        .select('session_id')
        .eq('sender', 'user')
        .order('created_at', { ascending: false })
        .limit(1)
        .single();

      if (error || !lastUserMsg) {
        console.error('⚠️ Tidak ada sesi user aktif untuk dibalas.');
      } else {
        // 2. Simpan balasan Admin ke DB
        const { error: insertError } = await supabase.from('chats').insert([
          {
            sender: 'admin',
            message: text,
            session_id: lastUserMsg.session_id
          }
        ]);

        if (insertError) {
          console.error('❌ Gagal simpan balasan ke DB:', insertError);
        } else {
          console.log('✅ Balasan admin disimpan untuk session:', lastUserMsg.session_id);
        }
      }

      // Wajib balas 200 OK ke Telegram
      return res.status(200).json({ ok: true });
    }

    // --- KASUS C: Format Tidak Dikenali ---
    else {
      console.log('⚠️ Request format tidak dikenali:', body);
      return res.status(200).json({ ok: true });
    }

  } catch (error) {
    console.error('💥 Internal Server Error:', error);
    return res.status(500).json({ error: 'Internal Server Error' });
  }
}
