// @vitest-environment jsdom
import React, { useState } from "react";
import { act, cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { getDeckReviewCards } from "@/app/actions/profile";
import { submitCardReview } from "@/app/actions/review";
import ReviewSheet from "@/app/(client)/learn/_components/ReviewSheet";
import { FLASHCARD_RATINGS } from "@/lib/flashcard-ratings";

// Test plan:
// - Mục tiêu: review từng lượt chỉ tiến sau rating đã lưu; lỗi giữ đáp án và cho retry.
// - Loại: component interaction, dialog thật; chỉ mock action để kiểm tra xử lý kết quả client.
// - Case: loading/empty/error/retry, reveal chỉ lộ mặt hiện tại, giữ mặt đáp án khi chuyển thẻ, bốn rating, next batch khi còn thẻ, hết thẻ chỉ quay lại, warning và stale load.
// - Resilience: cùng tick chỉ lưu một lần; pending ngăn nút đóng, Escape và outside.
// - LF6 (AC5): bốn nút rating giữ nhãn và thứ tự, dùng đúng lớp Attention (Lại/Khó) hoặc Recall (Ổn/Dễ) từ định nghĩa dùng chung với FlashcardStage, và vẫn bị khóa khi đang lưu.
// - Giới hạn: không chứng minh RLS/FSRS persistence; browser local kiểm tra save/reopen/focus.
// - Verify: xem State D6 trong progress.md.
vi.mock("@/app/actions/profile", () => ({ getDeckReviewCards: vi.fn() }));
vi.mock("@/app/actions/review", () => ({ submitCardReview: vi.fn() }));
const getDeck = vi.mocked(getDeckReviewCards);
const submit = vi.mocked(submitCardReview);
const card = { id: "44444444-4444-4444-8444-444444444444", front_content: { word: "reliable" }, back_content: { translation: "đáng tin cậy" }, audio_url: null, image_url: null };
const card2 = { ...card, id: "55555555-5555-4555-8555-555555555555", front_content: { word: "progress" } };
const deck = (cards = [card], dueLeft = cards.length) => ({ success: true, cards, counts: { learningLeft: 2, dueLeft } });
function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((r) => { resolve = r; });
  return { promise, resolve };
}
function Harness({ onComplete = () => {} }: { onComplete?: () => void }) {
  const [open, setOpen] = useState(false);
  return <><button onClick={() => setOpen(true)}>Ôn ngay</button><h2 id="review-summary-title" tabIndex={-1}>Nhịp ôn tập</h2><ReviewSheet isOpen={open} onClose={() => setOpen(false)} onReviewComplete={onComplete} /></>;
}
async function openReview(onComplete = vi.fn()) {
  const view = render(<Harness onComplete={onComplete} />);
  fireEvent.click(screen.getByRole("button", { name: "Ôn ngay" }));
  await screen.findByText("reliable");
  return { ...view, onComplete };
}
function revealAndRate(name = "Ổn") {
  fireEvent.click(screen.getByRole("button", { name: "Hiện đáp án" }));
  fireEvent.click(screen.getByRole("button", { name }));
}
beforeEach(() => {
  vi.resetAllMocks();
  getDeck.mockResolvedValue(deck());
  submit.mockResolvedValue({ success: true });
});
afterEach(cleanup);

describe("D6 review batches", () => {
  it.each(["Lại", "Khó", "Ổn", "Dễ"])("retains the outgoing answer while %s advances to an immediately usable recall face", async (rating) => {
    getDeck.mockResolvedValue(deck([card, { ...card2, back_content: { translation: "tiến bộ" } }]));
    await openReview();
    revealAndRate(rating);
    await screen.findByRole("heading", { name: "progress" });
    expect(screen.getByText("đáng tin cậy")).toBeTruthy();
    expect(screen.queryByRole("heading", { name: "đáng tin cậy" })).toBeNull();
    expect(screen.queryByText("tiến bộ")).toBeNull();
    expect(document.activeElement).toBe(screen.getByRole("button", { name: "Hiện đáp án" }));
    fireEvent.click(screen.getByRole("button", { name: "Hiện đáp án" }));
    expect(screen.getByRole("heading", { name: "tiến bộ" })).toBeTruthy();
    expect(screen.queryByText("đáng tin cậy")).toBeNull();
    expect(submit).toHaveBeenCalledOnce();
  });
  it("exposes only the current recall face to assistive technology", async () => {
    await openReview();
    expect(screen.getByRole("heading", { name: "reliable" })).toBeTruthy();
    expect(screen.queryByRole("heading", { name: "đáng tin cậy" })).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "Hiện đáp án" }));
    expect(screen.getByRole("heading", { name: "đáng tin cậy" })).toBeTruthy();
    expect(screen.queryByRole("heading", { name: "reliable" })).toBeNull();
    expect(document.activeElement).toBe(screen.getByRole("button", { name: "Lại" }));
    expect(submit).not.toHaveBeenCalled();
  });
  it("shows loading without claiming completion, then a batch-scoped empty state even with positive due count", async () => {
    const pending = deferred<ReturnType<typeof deck>>();
    getDeck.mockReturnValue(pending.promise);
    render(<ReviewSheet isOpen onClose={vi.fn()} onReviewComplete={vi.fn()} />);
    expect(screen.getByText("Đang tải thẻ ôn tập…")).toBeTruthy();
    expect(screen.queryByText("Đã hoàn tất lượt này")).toBeNull();
    await act(async () => { pending.resolve(deck([], 51)); });
    expect(screen.getByText("Lượt tải này chưa có thẻ có thể ôn")).toBeTruthy();
    expect(screen.queryByText(/Không có thẻ đến hạn/)).toBeNull();
    expect(screen.queryByRole("button", { name: /Ôn lượt tiếp|Tải lại lượt ôn/ })).toBeNull();
  });
  it("offers only return when the server has no due cards without claiming a completed session", async () => {
    getDeck.mockResolvedValue(deck([], 0));
    const onClose = vi.fn();
    render(<ReviewSheet isOpen onClose={onClose} onReviewComplete={vi.fn()} />);
    await screen.findByRole("heading", { name: "Hiện không có thẻ đến hạn" });
    expect(screen.queryByRole("button", { name: /Ôn lượt tiếp|Tải lại lượt ôn|Về dashboard/ })).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "Quay lại" }));
    expect(onClose).toHaveBeenCalledOnce();
    expect(getDeck).toHaveBeenCalledOnce();
  });
  it("congratulates the learner after the last due card and returns without another empty fetch", async () => {
    await openReview();
    revealAndRate();
    await screen.findByRole("heading", { name: "Chúc mừng! Bạn đã ôn hết thẻ đến hạn." });
    expect(screen.queryByRole("button", { name: /Ôn lượt tiếp|Tải lại lượt ôn|Về dashboard/ })).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "Quay lại" }));
    await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
    expect(getDeck).toHaveBeenCalledOnce();
  });
  it("does not claim all due cards are done when the server omits queue counts", async () => {
    getDeck.mockResolvedValue({ success: true, cards: [card] });
    await openReview();
    revealAndRate();
    await screen.findByRole("heading", { name: "Đã hoàn tất lượt này" });
    expect(screen.queryByRole("heading", { name: /Chúc mừng/ })).toBeNull();
    expect(screen.queryByRole("button", { name: /Ôn lượt tiếp|Tải lại lượt ôn/ })).toBeNull();
    expect(screen.getByRole("button", { name: "Quay lại" })).toBeTruthy();
  });
  it.each(["result", "throw"])("keeps a %s load failure open and retries", async (kind) => {
    if (kind === "throw") getDeck.mockRejectedValueOnce(new Error("internal secret"));
    else getDeck.mockResolvedValueOnce({ error: "Tải thất bại" });
    const onClose = vi.fn();
    render(<ReviewSheet isOpen onClose={onClose} onReviewComplete={vi.fn()} />);
    await screen.findByText("Chưa thể mở lượt ôn");
    expect(onClose).not.toHaveBeenCalled();
    expect(screen.queryByText("internal secret")).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "Thử lại" }));
    await screen.findByText("reliable");
    expect(getDeck).toHaveBeenCalledTimes(2);
  });
  it.each([{ name: "Lại", rating: 1 }, { name: "Khó", rating: 2 }])("requeues $name without advancing batch progress", async ({ name, rating }) => {
    getDeck.mockResolvedValue(deck([card, card2]));
    const { onComplete } = await openReview();
    revealAndRate(name);
    await screen.findByText("progress");
    expect(screen.getByText("Đã xử lý 0/2 thẻ trong lượt")).toBeTruthy();
    expect(submit).toHaveBeenCalledWith(card.id, rating);
    revealAndRate();
    await screen.findByText("reliable");
    expect(screen.getByText("Đã xử lý 1/2 thẻ trong lượt")).toBeTruthy();
    expect(onComplete).not.toHaveBeenCalled();
    expect(document.activeElement).toBe(screen.getByRole("button", { name: "Hiện đáp án" }));
  });
  it.each([{ name: "Ổn", rating: 3 }, { name: "Dễ", rating: 4 }])("completes $name only after success and refreshes", async ({ name, rating }) => {
    const { onComplete } = await openReview();
    expect(screen.queryByRole("button", { name })).toBeNull();
    revealAndRate(name);
    await screen.findByText("Chúc mừng! Bạn đã ôn hết thẻ đến hạn.");
    expect(screen.getByText("Đã xử lý 1/1 thẻ trong lượt")).toBeTruthy();
    expect(submit).toHaveBeenCalledWith(card.id, rating);
    expect(onComplete).toHaveBeenCalledOnce();
    expect(document.activeElement).toBe(screen.getByRole("heading", { name: "Chúc mừng! Bạn đã ôn hết thẻ đến hạn." }));
  });
  it.each(["result", "throw"])("retains the revealed answer/progress on %s save failure and allows manual retry", async (kind) => {
    if (kind === "throw") submit.mockRejectedValueOnce(new Error("secret"));
    else submit.mockResolvedValueOnce({ error: "Lưu thất bại" });
    const { onComplete } = await openReview();
    revealAndRate();
    await screen.findByRole("alert");
    expect(screen.getByText("đáng tin cậy")).toBeTruthy();
    expect(screen.getByText("Đã xử lý 0/1 thẻ trong lượt")).toBeTruthy();
    expect(onComplete).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole("button", { name: "Ổn" }));
    await screen.findByText("Chúc mừng! Bạn đã ôn hết thẻ đến hạn.");
    expect(submit).toHaveBeenCalledTimes(2);
  });
  it("keeps pending answer and rejects same-tick duplicate, close, Escape and outside", async () => {
    const pending = deferred<{ success: true }>();
    submit.mockReturnValue(pending.promise);
    await openReview();
    fireEvent.click(screen.getByRole("button", { name: "Hiện đáp án" }));
    const rating = screen.getByRole("button", { name: "Ổn" });
    act(() => { rating.click(); rating.click(); });
    expect(submit).toHaveBeenCalledOnce();
    expect(screen.getByText("đáng tin cậy")).toBeTruthy();
    expect(screen.getByText("Đang lưu đánh giá…")).toBeTruthy();
    expect((screen.getByRole("button", { name: "Đóng giao diện ôn tập" }) as HTMLButtonElement).disabled).toBe(true);
    fireEvent.keyDown(screen.getByRole("dialog"), { key: "Escape" });
    fireEvent.pointerDown(document.body);
    expect(screen.getByRole("dialog")).toBeTruthy();
    await act(async () => { pending.resolve({ success: true }); });
    await screen.findByText("Chúc mừng! Bạn đã ôn hết thẻ đến hạn.");
  });
  it("advances once with a progress warning without rerating saved data", async () => {
    submit.mockResolvedValue({ success: true, progressError: "Đánh giá đã lưu, tiến độ bài học chưa đồng bộ." });
    await openReview();
    revealAndRate();
    await screen.findByText("Chúc mừng! Bạn đã ôn hết thẻ đến hạn.");
    expect(screen.getByText("Đánh giá đã lưu, tiến độ bài học chưa đồng bộ.")).toBeTruthy();
    expect(submit).toHaveBeenCalledOnce();
  });
  it.each(["data", "empty", "error"])("fetches the next batch with %s instead of retaining completion or old cards", async (kind) => {
    getDeck.mockResolvedValueOnce(deck([card], 2));
    await openReview(); revealAndRate(); await screen.findByText("Đã hoàn tất lượt này");
    const pending = deferred<Awaited<ReturnType<typeof getDeckReviewCards>>>();
    getDeck.mockReturnValueOnce(pending.promise);
    const next = screen.getByRole("button", { name: "Ôn lượt tiếp theo" });
    act(() => { next.click(); next.click(); });
    expect(getDeck).toHaveBeenCalledTimes(2);
    expect(screen.queryByText("Đã hoàn tất lượt này")).toBeNull();
    expect(screen.queryByText("reliable")).toBeNull();
    await act(async () => { pending.resolve(kind === "error" ? { error: "Tải thất bại" } : deck(kind === "empty" ? [] : [card2])); });
    if (kind === "data") { await screen.findByText("progress"); expect(screen.getByText("Đã xử lý 0/1 thẻ trong lượt")).toBeTruthy(); }
    else await screen.findByText(kind === "empty" ? "Hiện không có thẻ đến hạn" : "Chưa thể mở lượt ôn");
  });
  it("does not reload an active batch when parent callback identities change", async () => {
    const view = render(<ReviewSheet isOpen onClose={vi.fn()} onReviewComplete={vi.fn()} />);
    await screen.findByText("reliable");
    fireEvent.click(screen.getByRole("button", { name: "Hiện đáp án" }));
    view.rerender(<ReviewSheet isOpen onClose={vi.fn()} onReviewComplete={vi.fn()} />);
    expect(getDeck).toHaveBeenCalledOnce();
    expect(screen.getByText("đáng tin cậy")).toBeTruthy();
  });
  it("ignores a closed load response after reopening with a newer queue", async () => {
    const old = deferred<ReturnType<typeof deck>>(); getDeck.mockReturnValueOnce(old.promise);
    const view = render(<ReviewSheet isOpen onClose={vi.fn()} onReviewComplete={vi.fn()} />);
    view.rerender(<ReviewSheet isOpen={false} onClose={vi.fn()} onReviewComplete={vi.fn()} />);
    getDeck.mockResolvedValueOnce(deck([card2]));
    view.rerender(<ReviewSheet isOpen onClose={vi.fn()} onReviewComplete={vi.fn()} />);
    await screen.findByText("progress");
    await act(async () => { old.resolve(deck()); });
    expect(screen.queryByText("reliable")).toBeNull();
  });
  it("reloads server truth on reopen and refreshes only after saved ratings", async () => {
    const { onComplete } = await openReview();
    fireEvent.click(screen.getByRole("button", { name: "Đóng giao diện ôn tập" }));
    await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
    expect(onComplete).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole("button", { name: "Ôn ngay" }));
    await screen.findByText("reliable");
    expect(getDeck).toHaveBeenCalledTimes(2);
    revealAndRate("Khó"); await waitFor(() => expect(submit).toHaveBeenCalledOnce());
    await waitFor(() => expect(screen.queryByText("Đang lưu đánh giá…")).toBeNull());
    fireEvent.click(screen.getByRole("button", { name: "Đóng giao diện ôn tập" }));
    expect(onComplete).toHaveBeenCalledOnce();
  });
});

describe("LF6 rating colours (AC5)", () => {
  // Lại/Khó mang Attention (mức nhớ khó hơn), Ổn/Dễ mang Recall; Growth và Correction không dùng cho tự đánh giá.
  const expected: Record<string, string[]> = {
    Lại: ["border-attention-line", "bg-attention-quiet", "text-attention"],
    Khó: ["border-attention-line", "bg-white", "text-attention"],
    Ổn: ["border-recall-line", "bg-white", "text-recall"],
    Dễ: ["border-recall-line", "bg-recall-quiet", "text-recall"],
  };

  it("shows the four ratings in order with the shared Attention and Recall classes, one definition for both surfaces", async () => {
    await openReview();
    fireEvent.click(screen.getByRole("button", { name: "Hiện đáp án" }));
    const labels = ["Lại", "Khó", "Ổn", "Dễ"];
    const buttons = labels.map((name) => screen.getByRole("button", { name }));
    expect(buttons.map((button) => button.textContent)).toEqual(labels);
    expect(FLASHCARD_RATINGS.map(({ label }) => label)).toEqual(labels);
    buttons.forEach((button, index) => {
      const classes = button.className.split(/\s+/);
      for (const token of expected[labels[index]]) expect(classes).toContain(token);
      for (const token of FLASHCARD_RATINGS[index].className.split(/\s+/)) expect(classes).toContain(token);
      expect(classes.some((token) => /^(hover:)?(bg|text|border)-(growth|correction)/.test(token))).toBe(false);
    });
    // The pair for each colour family must not mix: no Recall token on an Attention rating and vice versa.
    expect(buttons[0].className).not.toMatch(/recall/);
    expect(buttons[2].className).not.toMatch(/attention/);
  });

  it("keeps every rating disabled while a save is in flight", async () => {
    const pending = deferred<{ success: true }>();
    submit.mockReturnValueOnce(pending.promise);
    await openReview();
    revealAndRate("Ổn");
    await waitFor(() => expect(submit).toHaveBeenCalledOnce());
    for (const name of ["Lại", "Khó", "Ổn", "Dễ"]) {
      expect((screen.getByRole("button", { name }) as HTMLButtonElement).disabled).toBe(true);
    }
    pending.resolve({ success: true });
    await waitFor(() => expect(screen.queryByText("Đang lưu đánh giá…")).toBeNull());
  });
});
