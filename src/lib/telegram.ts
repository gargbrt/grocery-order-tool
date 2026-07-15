// Thin wrapper around the Telegram Bot API (https://core.telegram.org/bots/api).
// No SDK needed - it's a plain REST API, one fetch call per action.

const TELEGRAM_API_BASE = "https://api.telegram.org/bot";

export async function sendTelegramMessage(
  botToken: string,
  chatId: string | number,
  text: string,
  options?: { parseMode?: "Markdown" | "HTML" }
) {
  const url = `${TELEGRAM_API_BASE}${botToken}/sendMessage`;
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      chat_id: chatId,
      text,
      parse_mode: options?.parseMode,
    }),
  });
  if (!res.ok) {
    const body = await res.text();
    throw new Error(`Telegram sendMessage failed: ${res.status} ${body}`);
  }
  return res.json();
}

// Registers the webhook URL with Telegram so incoming messages get POSTed to us.
// Run this once after the owner supplies their bot token (see setup docs).
export async function setTelegramWebhook(botToken: string, webhookUrl: string) {
  const url = `${TELEGRAM_API_BASE}${botToken}/setWebhook`;
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ url: webhookUrl }),
  });
  return res.json();
}

// splitOrderIntoLines and order-likelihood filtering now live in
// src/lib/orderParsing.ts, shared with the WhatsApp webhook.
export { splitOrderIntoLines } from "./orderParsing";
