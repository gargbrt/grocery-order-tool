// Shared logic for turning an incoming chat message into order lines, and for
// flagging whether a message actually looks like an order at all.
//
// Deliberately conservative: this NEVER silently drops a message. Anything
// ambiguous is still created as an Order, just flagged isLikelyOrder=false so
// it surfaces in a separate "Needs review" tab instead of the main Orders
// list. A false negative here would mean a lost customer order, which is far
// worse than a store owner seeing one extra item in a review tab.

export function splitOrderIntoLines(rawMessage: string): string[] {
  return rawMessage
    .split(/\r?\n|,/)
    .map((line) => line.trim())
    .filter((line) => line.length > 0);
}

const GREETING_PATTERNS = [
  /^h(i+|ello+|ey+)[!. ]*$/i,
  /^(good\s?(morning|afternoon|evening))[!. ]*$/i,
  /^(thanks?|thank you|thank u|ty)[!. ]*$/i,
  /^(ok|okay|k|kk|yes|no|yep|nope|sure)[!. ]*$/i,
  /^(bye|see you|cya)[!. ]*$/i,
  /^[👍🙏😊🙂❤️✅👌\s]+$/u, // emoji-only reactions
];

const UNIT_WORD = "kgs?|kilograms?|grams?|g|litres?|liters?|l|ml|packets?|pkt|dozen|pieces?|pcs?";
const NUMBER_UNIT = new RegExp(`\\d+(\\.\\d+)?\\s*(${UNIT_WORD})\\b`, "i");
const BARE_UNIT_WORD = new RegExp(`\\b(${UNIT_WORD})\\b`, "i");

// A line "looks like an item" if it has a quantity/unit signal (numbers, kg,
// packet, etc.), OR is a short phrase (<=3 words) like a bare item name
// ("milk", "toor dal"). Longer wordy sentences without any quantity signal
// ("can you tell me if you have fresh vegetables") are treated as
// conversational, not an item line - grocery orders are short by nature.
function looksLikeItemLine(line: string): boolean {
  if (!/[a-zA-Z]/.test(line)) return false;
  // A bare digit isn't a quantity signal on its own - addresses, phone numbers
  // and times all contain digits too ("Sector 12", "6 pm"). Only count it as
  // a quantity signal when it's actually attached to a unit (space or not),
  // e.g. "2 kg", "500g", "1.5 litres".
  const hasNumberOrUnit = NUMBER_UNIT.test(line) || BARE_UNIT_WORD.test(line);
  const wordCount = line.split(/\s+/).filter(Boolean).length;
  return hasNumberOrUnit || wordCount <= 3;
}

const LEADING_QTY = new RegExp(`^(\\d+(?:\\.\\d+)?\\s*(?:${UNIT_WORD}))\\s+(.+)$`, "i");
const TRAILING_QTY = new RegExp(`^(.+?)\\s+(\\d+(?:\\.\\d+)?\\s*(?:${UNIT_WORD}))$`, "i");

export type ParsedItem = { quantityRequested: string; itemName: string };

// Splits a quantity+unit off an item line so the helper sees a clean item
// name during fulfillment instead of the whole raw line ("2 kg qwe" as one
// blob). Quantity can lead ("2 kg rice") or trail ("toor dal 500g") - tries
// both, falls back to treating the whole line as the item name with no
// parsed quantity if neither shape matches (e.g. "onions", "toor dal").
export function parseOrderLine(line: string): ParsedItem {
  const trimmed = line.trim();
  const leading = trimmed.match(LEADING_QTY);
  if (leading) return { quantityRequested: leading[1].trim(), itemName: leading[2].trim() };

  const trailing = trimmed.match(TRAILING_QTY);
  if (trailing) return { quantityRequested: trailing[2].trim(), itemName: trailing[1].trim() };

  return { quantityRequested: "", itemName: trimmed };
}

export type OrderLikelihood = {
  isLikelyOrder: boolean;
  reason: string;
};

// Returns whether the whole message looks like a grocery order.
// Conservative by design - see module comment above.
export function assessOrderLikelihood(rawMessage: string): OrderLikelihood {
  const trimmed = rawMessage.trim();

  if (trimmed.length === 0) {
    return { isLikelyOrder: false, reason: "Empty message" };
  }

  if (GREETING_PATTERNS.some((p) => p.test(trimmed))) {
    return { isLikelyOrder: false, reason: "Looks like a greeting/acknowledgement, not an order" };
  }

  const lines = splitOrderIntoLines(trimmed);
  if (lines.length === 0) {
    return { isLikelyOrder: false, reason: "No parseable lines" };
  }

  // If every line individually looks like a greeting, flag it
  if (lines.every((l) => GREETING_PATTERNS.some((p) => p.test(l)))) {
    return { isLikelyOrder: false, reason: "All lines look conversational" };
  }

  const itemLikeCount = lines.filter(looksLikeItemLine).length;
  const ratio = itemLikeCount / lines.length;

  // Single very short line with no digits/units and no comma/newline structure
  // (e.g. "when will you open today") is the main "chit-chat" case worth flagging.
  if (lines.length === 1 && !looksLikeItemLine(lines[0]) ) {
    return { isLikelyOrder: false, reason: "Single short line, doesn't look like an item" };
  }

  if (ratio < 0.5) {
    return { isLikelyOrder: false, reason: "Most lines don't look like grocery items" };
  }

  return { isLikelyOrder: true, reason: "Looks like a grocery order" };
}
