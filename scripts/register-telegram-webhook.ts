// Run with: npx tsx scripts/register-telegram-webhook.ts <storeId>
// Reads the store's telegramBotToken from the DB and tells Telegram where to send updates.
import { PrismaClient } from "@prisma/client";
import { setTelegramWebhook } from "../src/lib/telegram";

const prisma = new PrismaClient();

async function main() {
  const storeId = process.argv[2];
  if (!storeId) {
    console.error("Usage: npx tsx scripts/register-telegram-webhook.ts <storeId>");
    process.exit(1);
  }

  const store = await prisma.store.findUnique({ where: { id: storeId } });
  if (!store?.telegramBotToken) {
    console.error("Store not found or telegramBotToken not set.");
    process.exit(1);
  }

  const base = process.env.PUBLIC_BASE_URL;
  if (!base) {
    console.error("Set PUBLIC_BASE_URL in your .env first (your deployed URL).");
    process.exit(1);
  }

  const webhookUrl = `${base}/api/telegram/webhook?storeId=${storeId}`;
  const result = await setTelegramWebhook(store.telegramBotToken, webhookUrl);
  console.log("Telegram response:", result);
}

main().finally(() => prisma.$disconnect());
