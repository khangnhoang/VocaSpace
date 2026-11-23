// U3 quyết định 17: dưới 960px, panel đường cong được thay bằng chồng thẻ từ. Module này chỉ chọn thẻ và lời cho từng
// biến thể của panel; thẻ là minh hoạ cố định, không phải dữ liệu học của người dùng (AC12).
import type { Translate } from "@/lib/i18n/translate";
import type { CurveVariant } from "./memory-curve";
import { viAuthText } from "./vi-auth-text";

export type DeckTone = "due" | "fade" | "ok";
export type DeckCard = { word: string; meaning: string; tag?: string; tone?: DeckTone; locked?: boolean };
export type DeckScene = {
  // Thẻ đầu mảng nằm trên cùng chồng.
  cards: DeckCard[];
  title: string;
  text: string;
  // Chỉ chồng thẻ của /login tự ôn vòng và úp mặt khi gõ mật khẩu.
  cycles: boolean;
  // /forgot-password: chữ trên thẻ mờ dần ("fading") rồi rõ lại sau khi gửi ("relearned").
  memory?: "fading" | "relearned";
};

const LOGIN_CARDS: DeckCard[] = [
  { word: "remember", meaning: "/rɪˈmem.bər/ · ghi nhớ", tone: "due" },
  { word: "review", meaning: "/rɪˈvjuː/ · ôn lại" },
  { word: "vivid", meaning: "/ˈvɪv.ɪd/ · sống động" },
];

// Mỗi chặng của rail 5 chặng gắn với một thẻ: Tài khoản, Thông tin, Ảnh, Xác minh, Mật khẩu.
const STAGE_CARDS = [
  { word: "hello", meaning: "xin chào" },
  { word: "profile", meaning: "hồ sơ" },
  { word: "picture", meaning: "ảnh" },
  { word: "verify", meaning: "xác minh" },
  { word: "secure", meaning: "bảo mật" },
] as const;

// Từ, phiên âm và nghĩa trên thẻ là nội dung học mẫu, giữ nguyên (quyết định 1); nhãn, tiêu đề và lời là chữ giao diện lấy từ
// catalog `auth.deck` qua `t`, thiếu thì dùng tiếng Việt.
// Thẻ của các chặng đã qua (thẻ mới nhất nằm trên), thẻ chặng hiện tại mang nhãn của nó.
function stageDeck(stage: number, currentTag: string, currentTone: DeckTone, doneTag: string, locked = false): DeckCard[] {
  return STAGE_CARDS.slice(0, stage)
    .map((card, index): DeckCard =>
      index === stage - 1
        ? { ...card, tag: currentTag, tone: currentTone, locked }
        : { ...card, tag: doneTag, tone: "ok" },
    )
    .reverse();
}

export function deckScene(variant: CurveVariant, t: Translate = viAuthText): DeckScene {
  const doneTag = t("deck.tagDone");
  switch (variant.kind) {
    case "login":
      return {
        cards: LOGIN_CARDS.map((card, index) => (index === 0 ? { ...card, tag: t("deck.tagDue") } : card)),
        title: t("deck.loginTitle"),
        text: t("deck.loginText"),
        cycles: true,
      };
    case "forgot":
      return variant.sent
        ? {
            cards: [{ word: "remember", meaning: "/rɪˈmem.bər/ · ghi nhớ", tag: t("deck.tagRelearn"), tone: "ok" }],
            title: t("deck.forgotSentTitle"),
            text: t("deck.forgotSentText"),
            cycles: false,
            memory: "relearned",
          }
        : {
            cards: [{ word: "remember", meaning: "/rɪˈmem.bər/ · ghi nhớ", tag: t("deck.tagFading"), tone: "fade" }],
            title: t("deck.forgotTitle"),
            text: t("deck.forgotText"),
            cycles: false,
            memory: "fading",
          };
    case "register":
      if (variant.stage === 4) {
        return {
          cards: stageDeck(4, t("deck.tagWaitingEmail"), "due", doneTag),
          title: t("deck.verifyTitle"),
          text: t("deck.verifyText"),
          cycles: false,
        };
      }
      if (variant.stage === 5) return settledScene(t);
      return {
        cards: stageDeck(variant.stage, t("deck.tagNew"), "due", doneTag),
        title: t("deck.stageTitle"),
        text: t("deck.stageText", { stage: variant.stage, word: STAGE_CARDS[variant.stage - 1].word }),
        cycles: false,
      };
    case "settled":
      return settledScene(t);
  }
}

function settledScene(t: Translate): DeckScene {
  return {
    cards: stageDeck(5, t("deck.tagLocked"), "due", t("deck.tagDone"), true),
    title: t("deck.settledTitle"),
    text: t("deck.settledText"),
    cycles: false,
  };
}
