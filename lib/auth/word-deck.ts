// U3 quyết định 17: dưới 960px, panel đường cong được thay bằng chồng thẻ từ. Module này chỉ chọn thẻ và lời cho từng
// biến thể của panel; thẻ là minh hoạ cố định, không phải dữ liệu học của người dùng (AC12).
import type { CurveVariant } from "./memory-curve";

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
  { word: "remember", meaning: "/rɪˈmem.bər/ · ghi nhớ", tag: "Đến hạn", tone: "due" },
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

// Thẻ của các chặng đã qua (thẻ mới nhất nằm trên), thẻ chặng hiện tại mang nhãn của nó.
function stageDeck(stage: number, currentTag: string, currentTone: DeckTone, locked = false): DeckCard[] {
  return STAGE_CARDS.slice(0, stage)
    .map((card, index): DeckCard =>
      index === stage - 1
        ? { ...card, tag: currentTag, tone: currentTone, locked }
        : { ...card, tag: "Đã xong", tone: "ok" },
    )
    .reverse();
}

export function deckScene(variant: CurveVariant): DeckScene {
  switch (variant.kind) {
    case "login":
      return {
        cards: LOGIN_CARDS,
        title: "Ôn đúng lúc sắp quên.",
        text: "Thẻ đến hạn quay lại đầu chồng để ôn. VocaSpace dùng FSRS để chọn đúng lúc đó.",
        cycles: true,
      };
    case "forgot":
      return variant.sent
        ? {
            cards: [{ word: "remember", meaning: "/rɪˈmem.bər/ · ghi nhớ", tag: "Ôn lại", tone: "ok" }],
            title: "Ôn lại là nhớ lại.",
            text: "Mở link trong email để đặt mật khẩu mới, như một lần ôn kéo thẻ về rõ nét.",
            cycles: false,
            memory: "relearned",
          }
        : {
            cards: [{ word: "remember", meaning: "/rɪˈmem.bər/ · ghi nhớ", tag: "Quên dần", tone: "fade" }],
            title: "Quên là chuyện bình thường.",
            text: "Lâu không ôn, thẻ mờ dần. Một link đặt lại sẽ giúp bạn quay lại.",
            cycles: false,
            memory: "fading",
          };
    case "register":
      if (variant.stage === 4) {
        return {
          cards: stageDeck(4, "Chờ email", "due"),
          title: "Còn một bước: xác minh email.",
          text: "Thẻ “verify” chờ bạn mở email. Sau khi xác minh, bạn đặt mật khẩu để hoàn tất.",
          cycles: false,
        };
      }
      if (variant.stage === 5) return settledScene();
      return {
        cards: stageDeck(variant.stage, "Mới", "due"),
        title: "Mỗi bước, thêm một thẻ vào chồng.",
        text: `Bước ${variant.stage}/5 thêm thẻ “${STAGE_CARDS[variant.stage - 1].word}”. Đủ 5 thẻ là tài khoản sẵn sàng.`,
        cycles: false,
      };
    case "settled":
      return settledScene();
  }
}

function settledScene(): DeckScene {
  return {
    cards: stageDeck(5, "Khoá", "due", true),
    title: "Thẻ cuối: bảo mật tài khoản.",
    text: "Đặt mật khẩu để hoàn tất chồng thẻ của bạn.",
    cycles: false,
  };
}
