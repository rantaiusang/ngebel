// /api/telegram.js
// API Handler untuk mengirim pesan dari Website ke Telegram

export default async function handler(req, res) {
  // 1. Cek Metode Request: Hanya izinkan POST
  if (req.method !== 'POST') {
    return res.status(405).json({ 
      success: false,
      error: 'Method Not Allowed. Gunakan POST.' 
    });
  }

  try {
    // 2. Ambil data dari request body
    const { message } = req.body;

    // Validasi input agar tidak kosong
    if (!message || typeof message !== 'string' || message.trim() === '') {
      return res.status(400).json({ 
        success: false,
        error: 'Bad Request: Isi pesan tidak boleh kosong.' 
      });
    }

    // 3. Ambil Konfigurasi dari Environment Variables
    // Pastikan Anda sudah mengisi ini di Dashboard Vercel (Settings > Env Variables)
    const TOKEN = process.env.TELEGRAM_BOT_TOKEN;
    const CHAT_ID = process.env.TELEGRAM_CHAT_ID;

    // Cek apakah Token dan Chat ID ada
    if (!TOKEN) {
      console.error('❌ CRITICAL: TELEGRAM_BOT_TOKEN tidak ditemukan di Env Variables.');
      return res.status(500).json({ 
        success: false, 
        error: 'Server Error: Konfigurasi Bot Token hilang.' 
      });
    }

    if (!CHAT_ID) {
      console.error('❌ CRITICAL: TELEGRAM_CHAT_ID tidak ditemukan di Env Variables.');
      return res.status(500).json({ 
        success: false, 
        error: 'Server Error: Konfigurasi Chat ID hilang.' 
      });
    }

    // 4. Siapkan URL API Telegram
    const telegramUrl = `https://api.telegram.org/bot${TOKEN}/sendMessage`;

    // Log untuk debugging (bisa dilihat di Vercel Logs)
    console.log(`📤 Mencoba mengirim pesan ke Chat ID: ${CHAT_ID}`);
    console.log(`📝 Isi Pesan: ${message}`);

    // 5. Lakukan Request ke Telegram (Menggunakan Native Fetch Node.js)
    const response = await fetch(telegramUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        chat_id: CHAT_ID,
        text: message,
        parse_mode: 'HTML', // Opsional: Mengaktifkan format teks HTML jika diperlukan
        disable_web_page_preview: true // Opsional: Matikan preview link
      }),
    });

    // 6. Analisa Response dari Telegram
    const responseData = await response.json();

    if (!response.ok) {
      // Jika Telegram merespon Error (contoh: Token salah, Chat ID diblokir)
      console.error('❌ Gagal mengirim ke Telegram API:', responseData);
      
      return res.status(400).json({ 
        success: false,
        error: 'Gagal mengirim pesan ke Telegram.',
        details: responseData.description || 'Unknown Telegram API Error'
      });
    }

    // 7. Sukses!
    console.log('✅ Pesan berhasil dikirim ke Telegram:', responseData);
    
    return res.status(200).json({ 
      success: true,
      message: 'Pesan berhasil diteruskan ke Admin.',
      data: responseData.result
    });

  } catch (error) {
    // 8. Menangani Error tak terduga (Network error, dsb)
    console.error('💥 Internal Server Error pada /api/telegram:', error);
    
    return res.status(500).json({ 
      success: false,
      error: 'Internal Server Error',
      message: error.message 
    });
  }
}
