// @vitest-environment jsdom
import React, { useState } from "react";
import { act, cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { getDeckReviewCards } from "@/app/actions/profile";
import { submitCardReview } from "@/app/actions/review";
import ReviewSheet from "@/app/(client)/learn/_components/ReviewSheet";
import { CARD_REVIEW_RETRY_DELAY_MS, resetCardReviewQueueForTests } from "@/hooks/use-card-review-queue";
import { FLASHCARD_RATINGS } from "@/lib/flashcard-ratings";

// Test plan:
// - Mục tiêu: review tiến tới thẻ kế tiếp ngay khi chấm (LF8); việc lưu chạy nền theo thứ tự, và chỉ khi lưu thành công mới đổi giá trị do server quyết định (cảnh báo tiến độ, dueLeft, onReviewComplete).
// - Loại: component interaction, dialog thật; chỉ mock action để kiểm tra xử lý kết quả client.
// - Case: loading/empty/error/retry, reveal chỉ lộ mặt hiện tại, giữ mặt đáp án khi chuyển thẻ, bốn rating, next batch khi còn thẻ, hết thẻ chỉ quay lại, warning và stale load.
// - Resilience: cùng tick chỉ nhận một lần chấm; đóng, Escape và bấm ra ngoài chờ lưu xong rồi mới đóng.
// - LF8 (AC1-AC7): thẻ kế tiếp hiện trước khi lưu xong, một lần gọi; lưu lần lượt theo thứ tự; lỗi thử lại một lần rồi xếp thẻ lại kèm lời báo (không xếp lại khi lần chấm sau của chính thẻ còn chờ); hàng đợi rỗng chờ lưu xong rồi mới hoàn tất ("Đang lưu kết quả, vui lòng đợi…"); không có dòng trạng thái "Đang lưu…" khi đang chấm, chỉ tiêu đề cuối hàng đợi "Đang lưu kết quả, vui lòng đợi…" (vùng aria-live lịch sự, AC5b); lỗi cuối hủy lệnh đóng đang chờ; nút chấm không bị khóa; click của cử chỉ trước hoặc lần click thứ hai của bấm đúp không lật thẻ kế tiếp; beforeunload khi còn đang lưu.
// - LF6 (AC5): bốn nút rating giữ nhãn và thứ tự, dùng đúng lớp Attention (Lại/Khó) hoặc Recall (Ổn/Dễ) từ định nghĩa dùng chung với FlashcardStage, và không bị khóa khi đang lưu (LF8).
// - Giới hạn: không chứng minh RLS/FSRS persistence; browser local kiểm tra save/reopen/focus. Lỗi của thế hệ hàng đợi đã bị thay chỉ báo cho người học, không có test ở tầng component (không thể xảy ra khi đóng phải chờ lưu xong).
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
afterEach(() => {
  cleanup();
  resetCardReviewQueueForTests();
  vi.useRealTimers();
});

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
  it.each(["result", "throw"])("puts the card back with a message after %s failures and lets the learner rate it again", async (kind) => {
    if (kind === "throw") submit.mockRejectedValueOnce(new Error("secret")).mockRejectedValueOnce(new Error("secret"));
    else submit.mockResolvedValueOnce({ error: "Lưu thất bại" }).mockResolvedValueOnce({ error: "Lưu thất bại" });
    const { onComplete } = await openReview();
    vi.useFakeTimers({ toFake: ["setTimeout", "clearTimeout"] });
    revealAndRate();
    await act(async () => { await vi.advanceTimersByTimeAsync(CARD_REVIEW_RETRY_DELAY_MS); });
    expect(submit).toHaveBeenCalledTimes(2);
    expect(screen.getByRole("alert").textContent).toBe('Chưa lưu được đánh giá thẻ "reliable". Thẻ được xếp lại để bạn chấm lại.');
    expect(screen.queryByText("secret")).toBeNull();
    expect(screen.getByText("Đã xử lý 0/1 thẻ trong lượt")).toBeTruthy();
    expect(screen.getByRole("button", { name: "Hiện đáp án" })).toBeTruthy();
    expect(screen.queryByText("Đang lưu kết quả, vui lòng đợi…")).toBeNull();
    expect(screen.queryByRole("heading", { name: /Chúc mừng|Đã hoàn tất/ })).toBeNull();
    expect(onComplete).not.toHaveBeenCalled();
    vi.useRealTimers();
    revealAndRate();
    await screen.findByText("Chúc mừng! Bạn đã ôn hết thẻ đến hạn.");
    expect(submit).toHaveBeenCalledTimes(3);
  });
  it("shows the next card at once, with a single call and no completion claim, while the save is pending (AC1, AC3, AC5)", async () => {
    const pending = deferred<{ success: true; progressError?: string }>();
    submit.mockReturnValueOnce(pending.promise);
    getDeck.mockResolvedValue(deck([card, card2], 2));
    const { onComplete } = await openReview();
    revealAndRate("Ổn");
    expect(screen.getByRole("heading", { name: "progress" })).toBeTruthy();
    expect(screen.getByRole("button", { name: "Hiện đáp án" })).toBeTruthy();
    expect(screen.getByText("Đã xử lý 1/2 thẻ trong lượt")).toBeTruthy();
    await waitFor(() => expect(submit).toHaveBeenCalledOnce());
    // Chưa phải cuối hàng đợi: lưu đang chờ nhưng không có dòng trạng thái nào (AC5b).
    expect(screen.queryByText("Đang lưu…")).toBeNull();
    await act(async () => { pending.resolve({ success: true, progressError: "Đánh giá đã lưu, tiến độ bài học chưa đồng bộ." }); });
    // Server-derived values (warning) appear only after the save succeeded.
    expect(screen.getByText("Đánh giá đã lưu, tiến độ bài học chưa đồng bộ.")).toBeTruthy();
    expect(screen.queryByText("Đang lưu…")).toBeNull();
    expect(onComplete).not.toHaveBeenCalled();
  });
  it("saves ratings one at a time in the order given, without disabling the next rating (AC2, AC7)", async () => {
    const first = deferred<{ success: true }>();
    const second = deferred<{ success: true }>();
    submit.mockReturnValueOnce(first.promise).mockReturnValueOnce(second.promise);
    getDeck.mockResolvedValue(deck([card, card2], 2));
    await openReview();
    revealAndRate("Ổn");
    revealAndRate("Dễ");
    await waitFor(() => expect(submit).toHaveBeenCalledOnce());
    expect(submit).toHaveBeenLastCalledWith(card.id, 3);
    await act(async () => { first.resolve({ success: true }); });
    await waitFor(() => expect(submit).toHaveBeenCalledTimes(2));
    expect(submit).toHaveBeenLastCalledWith(card2.id, 4);
    await act(async () => { second.resolve({ success: true }); });
    await screen.findByText("Chúc mừng! Bạn đã ôn hết thẻ đến hạn.");
  });
  it("waits for the saves before completing, keeps a visible saving state and focuses the heading afterwards (AC5)", async () => {
    const pending = deferred<{ success: true }>();
    submit.mockReturnValueOnce(pending.promise);
    const { onComplete } = await openReview();
    revealAndRate();
    expect(screen.getByRole("heading", { name: "Đang lưu kết quả, vui lòng đợi…" })).toBeTruthy();
    expect(screen.getByRole("heading", { name: "Đang lưu kết quả, vui lòng đợi…" }).getAttribute("aria-live")).toBe("polite");
    expect(screen.queryByRole("heading", { name: /Chúc mừng|Đã hoàn tất/ })).toBeNull();
    expect(onComplete).not.toHaveBeenCalled();
    await act(async () => { pending.resolve({ success: true }); });
    const heading = await screen.findByRole("heading", { name: "Chúc mừng! Bạn đã ôn hết thẻ đến hạn." });
    expect(onComplete).toHaveBeenCalledOnce();
    expect(document.activeElement).toBe(heading);
  });
  it("never shows the saving state for a batch that has no cards at load (AC5)", async () => {
    getDeck.mockResolvedValue(deck([], 0));
    render(<ReviewSheet isOpen onClose={vi.fn()} onReviewComplete={vi.fn()} />);
    await screen.findByRole("heading", { name: "Hiện không có thẻ đến hạn" });
    expect(screen.queryByText("Đang lưu kết quả, vui lòng đợi…")).toBeNull();
    expect(screen.queryByText("Đang lưu…")).toBeNull();
  });
  it("accepts one rating per revealed card and makes close, Escape and outside click wait for the save (AC6, AC7)", async () => {
    const pending = deferred<{ success: true }>();
    submit.mockReturnValueOnce(pending.promise);
    const onClose = vi.fn();
    const onComplete = vi.fn();
    render(<ReviewSheet isOpen onClose={onClose} onReviewComplete={onComplete} />);
    await screen.findByText("reliable");
    fireEvent.click(screen.getByRole("button", { name: "Hiện đáp án" }));
    const rating = screen.getByRole("button", { name: "Ổn" });
    await act(async () => { rating.click(); rating.click(); });
    expect(submit).toHaveBeenCalledOnce();
    expect(screen.getByRole("heading", { name: "Đang lưu kết quả, vui lòng đợi…" })).toBeTruthy();
    const back = screen.getByRole("button", { name: "Đóng giao diện ôn tập" }) as HTMLButtonElement;
    expect(back.disabled).toBe(false);

    // Close, Escape and outside click wait; the back button then shows the pending state.
    fireEvent.keyDown(screen.getByRole("dialog"), { key: "Escape" });
    expect(back.disabled).toBe(true);
    fireEvent.pointerDown(document.body);
    fireEvent.click(back);
    expect(onClose).not.toHaveBeenCalled();
    expect(screen.getByRole("dialog")).toBeTruthy();
    await act(async () => { pending.resolve({ success: true }); });
    await waitFor(() => expect(onClose).toHaveBeenCalledOnce());
    expect(onComplete).toHaveBeenCalled();
  });
  it("ignores reveal and rate while a close is pending (AC6)", async () => {
    const pending = deferred<{ success: true }>();
    submit.mockReturnValueOnce(pending.promise);
    getDeck.mockResolvedValue(deck([card, card2], 2));
    const onClose = vi.fn();
    render(<ReviewSheet isOpen onClose={onClose} onReviewComplete={vi.fn()} />);
    await screen.findByText("reliable");
    revealAndRate("Ổn");
    fireEvent.click(screen.getByRole("button", { name: "Đóng giao diện ôn tập" }));
    fireEvent.click(screen.getByRole("button", { name: "Hiện đáp án" }));
    expect(screen.queryByRole("button", { name: "Ổn" })).toBeNull();
    await act(async () => { pending.resolve({ success: true }); });
    await waitFor(() => expect(onClose).toHaveBeenCalledOnce());
    expect(submit).toHaveBeenCalledOnce();
  });
  it("cancels a pending close when a save finally fails, and shows the put-back card with the alert (AC4, AC6)", async () => {
    submit.mockResolvedValueOnce({ error: "Lưu thất bại" }).mockResolvedValueOnce({ error: "Lưu thất bại" });
    const onClose = vi.fn();
    render(<ReviewSheet isOpen onClose={onClose} onReviewComplete={vi.fn()} />);
    await screen.findByText("reliable");
    vi.useFakeTimers({ toFake: ["setTimeout", "clearTimeout"] });
    revealAndRate();
    fireEvent.click(screen.getByRole("button", { name: "Đóng giao diện ôn tập" }));
    await act(async () => { await vi.advanceTimersByTimeAsync(CARD_REVIEW_RETRY_DELAY_MS); });
    vi.useRealTimers();
    expect(onClose).not.toHaveBeenCalled();
    expect(screen.getByRole("dialog")).toBeTruthy();
    expect(screen.getByRole("alert").textContent).toContain('Chưa lưu được đánh giá thẻ "reliable".');
    expect(screen.getByRole("heading", { name: "reliable" })).toBeTruthy();
    expect((screen.getByRole("button", { name: "Đóng giao diện ôn tập" }) as HTMLButtonElement).disabled).toBe(false);
    // Close works again once nothing is pending.
    fireEvent.click(screen.getByRole("button", { name: "Đóng giao diện ôn tập" }));
    await waitFor(() => expect(onClose).toHaveBeenCalledOnce());
  });
  it("does not put a failed card back when a later rating of the same card is still pending, and completes once (AC4, AC5)", async () => {
    const first = deferred<{ error: string }>();
    const second = deferred<{ success: true }>();
    submit.mockReturnValueOnce(first.promise as never).mockResolvedValueOnce({ error: "Lưu thất bại" }).mockReturnValueOnce(second.promise);
    const { onComplete } = await openReview();
    vi.useFakeTimers({ toFake: ["setTimeout", "clearTimeout"] });
    // Lại puts the card back; its second rating (Ổn) waits behind the first save in the chain.
    revealAndRate("Lại");
    revealAndRate("Ổn");
    await act(async () => { await vi.advanceTimersByTimeAsync(0); });
    expect(submit).toHaveBeenCalledOnce();
    // The first save fails twice (first try and the retry after the delay); the second rating then starts.
    await act(async () => { first.resolve({ error: "Lưu thất bại" }); await vi.advanceTimersByTimeAsync(CARD_REVIEW_RETRY_DELAY_MS); });
    vi.useRealTimers();
    await waitFor(() => expect(submit).toHaveBeenCalledTimes(3));
    expect(submit.mock.calls.map(([cardId, rating]) => [cardId, rating])).toEqual([[card.id, 1], [card.id, 1], [card.id, 3]]);
    expect(screen.getByRole("alert").textContent).toBe('Chưa lưu được đánh giá thẻ "reliable".');
    // Not requeued: the queue stays empty and the end is still armed, waiting for the second save.
    expect(screen.getByText("Đang lưu kết quả, vui lòng đợi…")).toBeTruthy();
    expect(screen.queryByRole("button", { name: "Hiện đáp án" })).toBeNull();
    expect(onComplete).not.toHaveBeenCalled();
    await act(async () => { second.resolve({ success: true }); });
    await screen.findByText("Chúc mừng! Bạn đã ôn hết thẻ đến hạn.");
    expect(onComplete).toHaveBeenCalledOnce();
    expect(submit).toHaveBeenCalledTimes(3);
  });
  it("does not reveal the next card for a click of the previous gesture or the second click of a double tap (AC7)", async () => {
    getDeck.mockResolvedValue(deck([card, card2], 2));
    await openReview();
    fireEvent.click(screen.getByRole("button", { name: "Hiện đáp án" }));
    const rating = screen.getByRole("button", { name: "Ổn" });
    fireEvent.pointerDown(rating);
    await act(async () => { fireEvent.click(rating, { detail: 1 }); });
    fireEvent.click(screen.getByRole("button", { name: "Hiện đáp án" }), { detail: 2 });
    expect(screen.queryByRole("button", { name: "Ổn" })).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "Hiện đáp án" }), { detail: 1 });
    expect(screen.queryByRole("button", { name: "Ổn" })).toBeNull();
    fireEvent.pointerDown(screen.getByRole("button", { name: "Hiện đáp án" }));
    fireEvent.click(screen.getByRole("button", { name: "Hiện đáp án" }), { detail: 1 });
    expect(screen.getByRole("button", { name: "Ổn" })).toBeTruthy();
  });
  it("warns before the page is left only while a save is pending (AC6)", async () => {
    const fireUnload = () => {
      const event = new Event("beforeunload", { cancelable: true });
      window.dispatchEvent(event);
      return event.defaultPrevented;
    };
    const pending = deferred<{ success: true }>();
    submit.mockReturnValueOnce(pending.promise);
    await openReview();
    expect(fireUnload()).toBe(false);
    revealAndRate();
    expect(fireUnload()).toBe(true);
    await act(async () => { pending.resolve({ success: true }); });
    await screen.findByText("Chúc mừng! Bạn đã ôn hết thẻ đến hạn.");
    expect(fireUnload()).toBe(false);
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
    fireEvent.click(screen.getByRole("button", { name: "Đóng giao diện ôn tập" }));
    await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
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

  it("keeps every rating enabled while a save is in flight (LF8 AC7)", async () => {
    const pending = deferred<{ success: true }>();
    submit.mockReturnValueOnce(pending.promise);
    getDeck.mockResolvedValue(deck([card, card2], 2));
    await openReview();
    revealAndRate("Ổn");
    await waitFor(() => expect(submit).toHaveBeenCalledOnce());
    fireEvent.click(screen.getByRole("button", { name: "Hiện đáp án" }));
    for (const name of ["Lại", "Khó", "Ổn", "Dễ"]) {
      expect((screen.getByRole("button", { name }) as HTMLButtonElement).disabled).toBe(false);
    }
    await act(async () => { pending.resolve({ success: true }); });
    expect(screen.queryByText("Đang lưu…")).toBeNull();
  });
});
