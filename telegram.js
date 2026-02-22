// /pages/api/telegram.js
import { createClient } from '@supabase/supabase-js';

// ==========================================
// KONFIGURASI SUPABASE (ADMIN ACCESS)
// ==========================================
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
// PENTING: Gunakan Service Role Key agar API punya akses tulis penuh ke DB tanpa login user
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY; 

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('❌ Missing SUPABASE_SERVICE_ROLE_KEY in environment variables');
}

const supabase = createClient(supabaseUrl, supabaseServiceKey);

// ==========================================
// 1. HANDLE WEBHOOK (Menerima Balasan Admin)
// ==========================================
// Fungsi ini dipanggil otomatis oleh Telegram ketika Anda membalas pesan di Bot
export async function GET(req, res) {
  // Verifikasi Secret Token (Opsional: Keamanan tambahan)
  // const secret = req.query.secret;
  // if (secret !== process.env.TELEGRAM_WEBHOOK_SECRET) {
  //   return res.status(403).json({ error: 'Forbidden' });
  // }

  try {
    const body = await req.json(); // Body dari Telegram

    // Cek apakah ada pesan teks
    if (body.message && body.message.text) {
      const text = body.message.text;
      const chatId = body.message.chat.id;

      // --- LOGIKA ROUTING PESAN ---
      // Sistem ini mengasumsikan Admin membalas pesan User terakhir yang masuk.
      // (Single Thread Mode)
      
      console.log(`📩 Menerima pesan dari Telegram (Chat ID: ${chatId}): ${text}`);

      // 1. Cari pesan User terakhir di database
      const { data: lastUserMsg, error } = await supabase
        .from('chats')
        .select('session_id')
        .eq('sender', 'user')
        .order('created_at', { ascending: false })
        .limit(1)
        .single();

      if (error || !lastUserMsg) {
        console.error('❌ Gagal mencari session user terakhir:', error?.message);
        return res.status(200).json({ ok: true }); // Tetap balas OK ke Telegram
      }

      const targetSessionId = lastUserMsg.session_id;
      console.log(`🎯 Mengarahkan balasan ke session: ${targetSessionId}`);

      // 2. Simpan balasan Admin ke Database
      const { error: insertError } = await supabase.from('chats').insert([
        {
          sender: 'admin',
          message: text,
          session_id: targetSessionId
        }
      ]);

      if (insertError) {
        console.error('❌ Gagal menyimpan balasan ke DB:', insertError.message);
      } else {
        console.log('✅ Balasan Admin berhasil disimpan ke DB.');
      }
    }

    // 3. Respon Sukses ke Telegram (Wajib agar tidak retry)
    return res.status(200).json({ ok: true });

  } catch (error) {
    console.error('💥 Error handling Webhook:', error);
    // Tetap return 200 agar Telegram tidak spam request error ke kita
    return res.status(200).json({ ok: true });
  }
}

// ==========================================
// 2. HANDLE KIRIM PESAN (Dari Website)
// ==========================================
// Fungsi ini dipanggil oleh Frontend (index.html) saat User klik Kirim
export async function POST(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method Not Allowed' });
  }

  try {
    const { message } = req.body;

    if (!message || message.trim() === '') {
      return res.status(400).json({ error: 'Pesan tidak boleh kosong' });
    }

    const TOKEN = process.env.TELEGRAM_BOT_TOKEN;
    const CHAT_ID = process.env.TELEGRAM_CHAT_ID;

    if (!TOKEN || !CHAT_ID) {
      return res.status(500).json({ error: 'Missing Token or Chat ID' });
    }

    // 1. Kirim ke Telegram
    const telegramUrl = `https://api.telegram.org/bot${TOKEN}/sendMessage`;
    
    const response = await fetch(telegramUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        chat_id: CHAT_ID,
        text: message,
        parse_mode: 'HTML',
        disable_web_page_preview: true
      }),
    });

    const data = await response.json();

    if (!response.ok) {
      console.error('Telegram Error:', data);
      return res.status(400).json({ error: 'Gagal kirim ke Telegram', details: data });
    }

    return res.status(200).json({ success: true });

  } catch (error) {
    console.error('Error send message:', error);
    return res.status(500).json({ error: 'Internal Server Error' });
  }
}
