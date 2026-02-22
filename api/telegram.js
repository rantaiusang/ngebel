import fetch from "node-fetch";

const TOKEN = process.env.TELEGRAM_BOT_TOKEN;

export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).send("Method Not Allowed");

  const update = req.body;
  console.log("Update received:", update);

  if (update.message) {
    const chatId = update.message.chat.id;
    const text = update.message.text;

    // Kirim balasan ke user
    await fetch(`https://api.telegram.org/bot${TOKEN}/sendMessage`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ chat_id: chatId, text: `Kamu bilang: ${text}` }),
    });
  }

  res.status(200).json({ ok: true });
}
