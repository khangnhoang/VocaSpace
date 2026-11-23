import type { Translate } from "@/lib/i18n/translate";
import { viAuthText } from "./vi-auth-text";

// U3 AC5: gợi ý sửa tên miền email gõ nhầm và link mở hộp thư. Chỉ gợi ý, không bao giờ tự đổi giá trị.
const SUGGESTED_DOMAINS = ["gmail.com", "yahoo.com", "outlook.com", "hotmail.com", "icloud.com"] as const;
// Tên miền thật nằm gần các tên trên (ví dụ ymail.com cách gmail.com 1 ký tự): không được coi là gõ nhầm.
const REAL_PROVIDER_DOMAINS = new Set([
  "ymail.com",
  "mail.com",
  "email.com",
  "live.com",
  "msn.com",
  "gmx.com",
  "aol.com",
  // Bản theo quốc gia của chính các nhà cung cấp trên.
  "yahoo.ca",
  "yahoo.fr",
  "yahoo.de",
  "hotmail.ca",
  "hotmail.fr",
  "hotmail.de",
  "outlook.fr",
  "outlook.de",
]);
const MAX_EDIT_DISTANCE = 2;

const MAILBOX_LINKS: Record<string, { labelKey: string; href: string }> = {
  "gmail.com": { labelKey: "mailbox.gmail", href: "https://mail.google.com/mail/u/0/#inbox" },
  "outlook.com": { labelKey: "mailbox.outlook", href: "https://outlook.live.com/mail/0/inbox" },
  "hotmail.com": { labelKey: "mailbox.outlook", href: "https://outlook.live.com/mail/0/inbox" },
  "yahoo.com": { labelKey: "mailbox.yahoo", href: "https://mail.yahoo.com" },
};

function editDistance(a: string, b: string): number {
  const previous = Array.from({ length: b.length + 1 }, (_, index) => index);
  for (let i = 1; i <= a.length; i += 1) {
    let diagonal = previous[0];
    previous[0] = i;
    for (let j = 1; j <= b.length; j += 1) {
      const above = previous[j];
      previous[j] = Math.min(previous[j] + 1, previous[j - 1] + 1, diagonal + (a[i - 1] === b[j - 1] ? 0 : 1));
      diagonal = above;
    }
  }
  return previous[b.length];
}

function splitEmail(value: string): { local: string; domain: string } | null {
  const trimmed = value.trim();
  const at = trimmed.lastIndexOf("@");
  if (at < 1 || at === trimmed.length - 1) return null;
  return { local: trimmed.slice(0, at), domain: trimmed.slice(at + 1).toLowerCase() };
}

export function suggestEmailCorrection(value: string): string | null {
  const parts = splitEmail(value);
  if (!parts) return null;
  const { local, domain } = parts;
  if ((SUGGESTED_DOMAINS as readonly string[]).includes(domain) || REAL_PROVIDER_DOMAINS.has(domain)) return null;

  let best: { domain: string; distance: number } | null = null;
  for (const candidate of SUGGESTED_DOMAINS) {
    const distance = editDistance(domain, candidate);
    if (distance <= MAX_EDIT_DISTANCE && (!best || distance < best.distance)) best = { domain: candidate, distance };
  }
  return best ? `${local}@${best.domain}` : null;
}

export function mailboxLinkFor(value: string, t: Translate = viAuthText): { label: string; href: string } | null {
  const parts = splitEmail(value);
  const link = parts ? MAILBOX_LINKS[parts.domain] : undefined;
  return link ? { label: t(link.labelKey), href: link.href } : null;
}
