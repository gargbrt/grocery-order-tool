// Sends a short "your order status changed" ping back to the customer on
// whichever channel the order came in on. Best-effort: a failed send never
// blocks the status change itself (the owner already sees it in the dashboard
// regardless of whether the customer got notified).

import { sendTelegramMessage } from "./telegram";
import { sendWhatsappMessage } from "./whatsapp";

const STATUS_MESSAGES: Record<string, string> = {
  ASSIGNED: "Your order has been picked up and is being prepared.",
  FULFILLING: "We're packing your order now.",
  DELIVERED: "Your order has been delivered. Thank you!",
  CANCELLED: "Your order has been cancelled. Please contact us if this doesn't look right.",
};

type NotifyParams = {
  status: string;
  contact: { telegramChatId: string | null; whatsappWaId: string | null } | null | undefined;
  store: {
    telegramBotToken: string | null;
    whatsappPhoneNumberId: string | null;
    whatsappAccessToken: string | null;
  };
};

export async function notifyOrderStatus({ status, contact, store }: NotifyParams) {
  const message = STATUS_MESSAGES[status];
  if (!message || !contact) return;

  try {
    if (contact.telegramChatId && store.telegramBotToken) {
      await sendTelegramMessage(store.telegramBotToken, contact.telegramChatId, message);
      return;
    }
    if (contact.whatsappWaId && store.whatsappPhoneNumberId && store.whatsappAccessToken) {
      await sendWhatsappMessage(store.whatsappPhoneNumberId, store.whatsappAccessToken, contact.whatsappWaId, message);
    }
    // No linked Telegram chat or configured WhatsApp Cloud API - nothing to send to
    // (e.g. WhatsApp manual mode, or a contact with no messaging channel linked yet).
  } catch (err) {
    console.error("Order status notification failed:", err);
  }
}
