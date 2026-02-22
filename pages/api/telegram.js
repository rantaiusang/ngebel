// /pages/api/telegram.js
import { createClient } from '@supabase/supabase-js';

// ==========================================
// KONFIGURASI SUPABASE (ADMIN ACCESS)
// ==========================================
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY; 

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('❌ Missing SUPABASE_SERVICE_ROLE_KEY in environment variables');
}

const supabase = createClient(supabaseUrl, supabaseServiceKey);

// ==========================================
// 1. HANDLE WEBHOOK (Menerima Balasan Admin)
// ==========================================
// PERBAIKAN: Gunakan POST bukan GET, karena Telegram mengirim Webhook via POST
export async function POST(req, res) {
  
  // Cek apakah ini request dari Telegram (Biasanya Telegram mengirim JSON)
  // Tapi untuk amannya, kita tangani semua POST di sini.
  
  try {
    // PERBAIKAN: Bungkus req.json() dalam try-catch terpisah
    // Request dari Telegram kadang body-nya kosong atau bukan JSON valid saat pertama kali connect
    let body;
    try {
      body = await req.json();
    } catch (e) {
      console.log('Request body kosong atau bukan JSON, mungkin ping dari Telegram.');
      return res.status(200).json({ ok: true });
    }

    // Logika Webhook: Jika ada pesan masuk
    if (body.message && body.message.text) {
      const text = body.message.text;
      const chatId = body.message.chat.id;

      console.log(`📩 Menerima pesan dari Telegram (Chat ID: ${chatId}): ${text}`);

      // --- LOGIKA ROUTING PESAN ---
      // Asumsi: Admin membalas pesan User terakhir (Single Thread)
      
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
        return res.status(200).json({ ok: true }); 
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

    // 3. Respon Sukses ke Telegram (Wajib 200 OK agar tidak spam retry)
    return res.status(200).json({ ok: true });

  } catch (error) {
    console.error('💥 Error handling Webhook:', error);
    return res.status(200).json({ ok: true });
  }
}

// ==========================================
// 2. HANDLE KIRIM PESAN (Dari Website)
// ==========================================
// Karena POST sudah dipakai untuk Webhook, kita pisahkan logikanya di dalam satu function
// ATAU kita buat endpoint baru.
// 
// CARA TERMUDAH: Kita deteksi lewat isi body (Heuristics).
// Jika body punya field 'message', itu dari WEBSITE. Jika punya struktur Telegram, itu dari WEBHOOK.

export default async function handler(req, res) {
  // Hanya izinkan POST
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method Not Allowed' });
  }

  try {
    const body = await req.json();

    // LOGIKA 1: Ini request dari WEBSITE (User kirim pesan)
    // Ciri: Ada key 'message' sederhana
    if (body.message && !body.message?.chat_id) { 
      
      console.log('📤 Request dari Website: Kirim pesan ke Telegram');
      
      const messageText = body.message;

      if (!messageText || messageText.trim() === '') {
        return res.status(400).json({ error: 'Pesan tidak boleh kosong' });
      }

      const TOKEN = process.env.TELEGRAM_BOT_TOKEN;
      const CHAT_ID = process.env.TELEGRAM_CHAT_ID;

      if (!TOKEN || !CHAT_ID) {
        return res.status(500).json({ error: 'Missing Token or Chat ID' });
      }

      // Kirim ke Telegram
      const telegramUrl = `https://api.telegram.org/bot${TOKEN}/sendMessage`;
      const response = await fetch(telegramUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          chat_id: CHAT_ID,
          text: messageText,
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
    }

    // LOGIKA 2: Ini request dari TELEGRAM (Webhook)
    // Ciri: Struktur body.message ada chat_id, from, etc.
    else if (body.message && body.message.text) {
      console.log('📩 Request dari Telegram: Simpan balasan ke DB');
      
      const text = body.message.text;
      
      // Cari user terakhir
      const { data: lastUserMsg, error } = await supabase
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

    // Jika format tidak dikenali
    else {
      console.log('⚠️ Format request tidak dikenali');
      return res.status(200).json({ ok: true });
    }

  } catch (error) {
    console.error('💥 Internal Error:', error);
    return res.status(500).json({ error: 'Internal Server Error' });
  }
}
