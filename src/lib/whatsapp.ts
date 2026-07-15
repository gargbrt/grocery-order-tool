// Thin wrapper around the WhatsApp Cloud API (Meta for Developers).
// Receiving messages works immediately with a free Meta test number - no
// business verification required. Sending is only unrestricted within the
// 24-hour customer service window after the customer's last message (which
// covers our "send the bill back" use case); anything outside that window
// needs a pre-approved message template, which is a separate Meta step.

const GRAPH_API_BASE = "https://graph.facebook.com/v20.0";

export async function sendWhatsappMessage(
  phoneNumberId: string,
  accessToken: string,
  to: string,
  text: string
) {
  const url = `${GRAPH_API_BASE}/${phoneNumberId}/messages`;
  const res = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${accessToken}`,
    },
    body: JSON.stringify({
      messaging_product: "whatsapp",
      to,
      type: "text",
      text: { body: text },
    }),
  });
  if (!res.ok) {
    const body = await res.text();
    throw new Error(`WhatsApp sendMessage failed: ${res.status} ${body}`);
  }
  return res.json();
}

// Meta's webhook payload is deeply nested - this pulls out just what we need.
export function extractWhatsappTextMessage(payload: any): { from: string; text: string; name: string } | null {
  try {
    const entry = payload.entry?.[0];
    const change = entry?.changes?.[0];
    const value = change?.value;
    const message = value?.messages?.[0];
    if (!message || message.type !== "text") return null;
    const contact = value.contacts?.[0];
    return {
      from: message.from, // WhatsApp ID / phone number, no "+"
      text: message.text.body,
      name: contact?.profile?.name || "Customer",
    };
  } catch {
    return null;
  }
}
