// @vitest-environment jsdom

import { act, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { WordDeck } from "@/components/auth/word-deck";
import { deckScene } from "@/lib/auth/word-deck";

// Test plan:
// - Mục tiêu: U3 quyết định 17 — dưới 960px chồng thẻ từ thay đường cong: đúng thẻ, nhãn và lời cho từng biến thể;
//   /login tự ôn 2 lần rồi dừng (dưới 5 giây), thẻ trên cùng úp mặt khi gõ mật khẩu; chặng đăng ký mới thêm thẻ lên đầu.
// - Loại test: unit hàm thuần `deckScene` và component trong jsdom với timer giả.
// - Case biên: không tự ôn khi thẻ đang úp; chồng thẻ là minh hoạ (aria-hidden), lời bên cạnh nằm trong vùng có tên.
//   Giảm chuyển động: auth-motion-reduced.test.tsx.
// - Giới hạn: jsdom không áp media query 960px hay chạy CSS animation; ẩn/hiện theo cỡ màn và nhịp kiểm tra trên trình duyệt.

const card = (word: string) => document.querySelector<HTMLElement>(`[data-deck-card="${word}"]`)!;
const position = (word: string) => Number(card(word).dataset.deckPosition);

beforeEach(() => {
  vi.useFakeTimers();
});

afterEach(() => {
  vi.useRealTimers();
});

describe("deckScene", () => {
  it("cycles three word cards on /login with the due card on top", () => {
    const scene = deckScene({ kind: "login" });
    expect(scene.cards.map((c) => c.word)).toEqual(["remember", "review", "vivid"]);
    expect(scene.cards[0]).toMatchObject({ tag: "Đến hạn", tone: "due" });
    expect(scene.cycles).toBe(true);
    expect(scene.title).toBe("Ôn đúng lúc sắp quên.");
  });

  it("adds one card per registration stage, newest on top, and waits for email at stage 4", () => {
    const stage2 = deckScene({ kind: "register", stage: 2 });
    expect(stage2.cards.map((c) => [c.word, c.tag])).toEqual([
      ["profile", "Mới"],
      ["hello", "Đã xong"],
    ]);
    expect(stage2.text).toContain("Bước 2/5");
    expect(stage2.cycles).toBe(false);

    const stage4 = deckScene({ kind: "register", stage: 4 });
    expect(stage4.cards).toHaveLength(4);
    expect(stage4.cards[0]).toMatchObject({ word: "verify", tag: "Chờ email" });
  });

  it("locks the fifth card on /auth/set-password", () => {
    const scene = deckScene({ kind: "settled" });
    expect(scene.cards).toHaveLength(5);
    expect(scene.cards[0]).toMatchObject({ word: "secure", tag: "Khoá", locked: true });
  });

  it("fades the card before the recovery link is sent and restores it after", () => {
    expect(deckScene({ kind: "forgot", sent: false })).toMatchObject({ memory: "fading", cards: [{ tag: "Quên dần", tone: "fade" }] });
    expect(deckScene({ kind: "forgot", sent: true })).toMatchObject({ memory: "relearned", cards: [{ tag: "Ôn lại", tone: "ok" }] });
  });
});

describe("WordDeck", () => {
  it("names the illustration region, hides the cards from assistive tech and shows the scene title", () => {
    render(<WordDeck variant={{ kind: "login" }} flipped={false} />);

    const region = screen.getByRole("complementary", { name: "Minh hoạ cách VocaSpace ôn thẻ" });
    expect(region.textContent).toContain("Ôn đúng lúc sắp quên.");
    expect(screen.getByTestId("word-deck").getAttribute("aria-hidden")).toBe("true");
    expect([position("remember"), position("review"), position("vivid")]).toEqual([0, 1, 2]);
  });

  it("reviews the top card twice on /login and then stops (under 5 seconds)", () => {
    render(<WordDeck variant={{ kind: "login" }} flipped={false} />);

    act(() => vi.advanceTimersByTime(1500));
    expect(card("remember").style.opacity).toBe("0");
    act(() => vi.advanceTimersByTime(360));
    expect([position("review"), position("vivid"), position("remember")]).toEqual([0, 1, 2]);

    act(() => vi.advanceTimersByTime(1500 + 360));
    expect(position("vivid")).toBe(0);

    act(() => vi.advanceTimersByTime(10_000));
    expect(position("vivid")).toBe(0);
  });

  it("turns the top card face down while the password has focus and does not review it meanwhile", () => {
    render(<WordDeck variant={{ kind: "login" }} flipped />);

    expect(card("remember").firstElementChild!.className).toContain("[transform:rotateY(180deg)]");
    expect(card("review").firstElementChild!.className).not.toContain("rotateY(180deg)");
    act(() => vi.advanceTimersByTime(5000));
    expect(position("remember")).toBe(0);
  });

  it("drops the new stage card onto the deck when registration moves forward", () => {
    const { rerender } = render(<WordDeck variant={{ kind: "register", stage: 1 }} flipped={false} />);
    expect(card("hello").className).not.toContain("enter");

    rerender(<WordDeck variant={{ kind: "register", stage: 2 }} flipped={false} />);

    expect(position("profile")).toBe(0);
    expect(card("profile").className).toContain("enter");
    expect(card("hello").className).not.toContain("enter");
    act(() => vi.advanceTimersByTime(5000));
    expect(position("profile")).toBe(0);
  });

  it("does not replay the drop-in when going back to an earlier stage", () => {
    const { rerender } = render(<WordDeck variant={{ kind: "register", stage: 2 }} flipped={false} />);
    rerender(<WordDeck variant={{ kind: "register", stage: 3 }} flipped={false} />);
    expect(card("picture").className).toContain("enter");

    rerender(<WordDeck variant={{ kind: "register", stage: 2 }} flipped={false} />);

    expect(position("profile")).toBe(0);
    expect(card("profile").className).not.toContain("enter");
  });

  it("shows the next screen's card at once when the page changes mid-review", () => {
    const { rerender } = render(<WordDeck variant={{ kind: "login" }} flipped={false} />);
    act(() => vi.advanceTimersByTime(1500));
    expect(card("remember").style.opacity).toBe("0");

    rerender(<WordDeck variant={{ kind: "forgot", sent: false }} flipped={false} />);

    expect(card("remember").style.opacity).toBe("1");
    act(() => vi.advanceTimersByTime(1000));
    expect(position("remember")).toBe(0);
  });
});
