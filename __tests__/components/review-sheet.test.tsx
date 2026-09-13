// @vitest-environment jsdom

import React from "react";
import { act, cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { getDeckReviewCards } from "@/app/actions/profile";
import { submitCardReview } from "@/app/actions/review";
import ReviewSheet from "@/app/(client)/learn/_components/ReviewSheet";

// Test plan:
// - Mục tiêu: bảo vệ review queue khỏi false completion khi FSRS write thất bại.
// - Loại test: component interaction trong jsdom.
// - Đối tượng: ReviewSheet.
// - Case thành công: confirmed review mới dequeue card và báo completion.
// - Case thất bại: rejected review giữ nguyên card/queue và không gọi completion callback.
// - Bảo mật/phân quyền: caller chỉ gửi cardId + rating, không gửi topicId.
// - Ổn định/resilience: rating control pending ngăn double submit và failure rollback an toàn.
// - Invariant cần giữ: UI không claim/dequeue success trước checked Server Action result.
// - Kết quả verify gần nhất: 27/27 test passed trong focused CP2 Vitest command.

vi.mock("@/app/actions/profile", () => ({ getDeckReviewCards: vi.fn() }));
vi.mock("@/app/actions/review", () => ({ submitCardReview: vi.fn() }));
vi.mock("sonner", () => ({ toast: { error: vi.fn(), success: vi.fn() } }));
vi.mock("@/components/ui/dialog", () => ({
  Dialog: ({ open, children }: { open: boolean; children: React.ReactNode }) =>
    open ? <div role="dialog">{children}</div> : null,
  DialogContent: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  DialogDescription: ({ children }: { children: React.ReactNode }) => <p>{children}</p>,
  DialogTitle: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}));

const mockedGetDeck = vi.mocked(getDeckReviewCards);
const mockedSubmitReview = vi.mocked(submitCardReview);

const reviewCard = {
  id: "44444444-4444-4444-8444-444444444444",
  front_content: { word: "reliable" },
  back_content: { translation: "đáng tin cậy" },
  audio_url: null,
  image_url: null,
};

function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((complete) => {
    resolve = complete;
  });
  return { promise, resolve };
}

describe("ReviewSheet", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockedGetDeck.mockResolvedValue({
      success: true,
      cards: [reviewCard],
      counts: { learningLeft: 1, dueLeft: 1 },
    });
  });

  afterEach(cleanup);

  it("keeps the current card when the checked review write fails", async () => {
    const pendingReview = deferred<{ error: string }>();
    mockedSubmitReview.mockReturnValue(pendingReview.promise);
    const onReviewComplete = vi.fn();

    render(
      <ReviewSheet
        isOpen
        onClose={vi.fn()}
        onReviewComplete={onReviewComplete}
      />,
    );

    expect(await screen.findByText("reliable")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Hiện đáp án" }));
    fireEvent.click(screen.getByRole("button", { name: "Ổn" }));

    expect(mockedSubmitReview).toHaveBeenCalledWith(reviewCard.id, 3);
    expect(screen.getByText("reliable")).toBeTruthy();
    expect(
      (screen.getByRole("button", { name: "Ổn" }) as HTMLButtonElement)
        .disabled,
    ).toBe(true);

    await act(async () => {
      pendingReview.resolve({ error: "failed" });
      await pendingReview.promise;
    });

    await waitFor(() => expect(screen.getByText("reliable")).toBeTruthy());
    expect(onReviewComplete).not.toHaveBeenCalled();
  });

  it("dequeues and completes only after the review write succeeds", async () => {
    mockedSubmitReview.mockResolvedValue({ success: true });
    const onReviewComplete = vi.fn();

    render(
      <ReviewSheet
        isOpen
        onClose={vi.fn()}
        onReviewComplete={onReviewComplete}
      />,
    );

    await screen.findByText("reliable");
    fireEvent.click(screen.getByRole("button", { name: "Hiện đáp án" }));
    fireEvent.click(screen.getByRole("button", { name: "Dễ" }));

    await waitFor(() => expect(onReviewComplete).toHaveBeenCalledOnce());
    expect(screen.queryByText("reliable")).toBeNull();
  });
});
