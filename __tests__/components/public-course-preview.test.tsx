// @vitest-environment jsdom

import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { PublicCoursePreviewExperience } from "@/app/(client)/courses/[course-slug]/preview/[topic-slug]/_components/PublicCoursePreviewExperience";
import type { PublicCoursePreview } from "@/lib/schemas/public-course-preview";

const mocks = vi.hoisted(() => ({
  answer: vi.fn(),
  getPreview: vi.fn(),
  getFirstTopic: vi.fn(),
  push: vi.fn(),
}));

vi.mock("@/app/actions/public-course-preview", () => ({
  answerPublicCoursePreviewQuestion: mocks.answer,
  getPublicCoursePreview: mocks.getPreview,
}));

vi.mock("@/app/actions/course-navigation", () => ({
  getFirstTopicSlugByCourseSlug: mocks.getFirstTopic,
}));

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: mocks.push }),
}));

// Test plan:
// - Mục tiêu: bảo vệ public Preview session khỏi persisted learning writes.
// - Loại test: client component interaction trong jsdom.
// - Đối tượng: hàng đợi FlashcardStage, stateless answer, unavailable/error và end state.
// - Thành công: Lại/Khó xếp thẻ lại; Ổn/Dễ bỏ thẻ; câu trả lời nhận phản hồi riêng qua Preview Action.
// - Thất bại: answer/media unavailable xóa nội dung đang hiển thị; lỗi giữ lựa chọn để thử lại.
// - Bảo mật/phân quyền: enrolled CTA chỉ điều hướng qua course-navigation; không import Persistent Learning Actions.
// - Ổn định: pending chặn gửi lặp, option rỗng có thể bỏ qua, nội dung Preview không có đáp án trước khi submit.
// - Invariant cần giữ: không ghi user_flashcards, user_question_answers hoặc user_topic_progress.
// - Kết quả verify gần nhất: C5 focused Vitest bundle đạt 4 files / 35 tests; TypeScript và targeted ESLint đạt.

const courseSlug = "public-course";
const topicSlug = "public-topic";
const questionId = "55555555-5555-4555-8555-555555555555";
const optionId = "66666666-6666-4666-8666-666666666666";

function preview(overrides: Partial<PublicCoursePreview> = {}): PublicCoursePreview {
  return {
    course: { slug: courseSlug, title: "Khóa học xem thử" },
    topic: {
      id: "11111111-1111-4111-8111-111111111111",
      slug: topicSlug,
      title: "Chủ đề mẫu",
      description: "Mô tả ngắn cho nội dung xem thử.",
    },
    flashcards: [
      {
        id: "77777777-7777-4777-8777-777777777777",
        front_content: { word: "alpha" },
        back_content: { translation: "nghĩa thứ nhất" },
        audio_url: null,
        image_url: null,
        order_index: 0,
      },
      {
        id: "88888888-8888-4888-8888-888888888888",
        front_content: { word: "beta" },
        back_content: { translation: "nghĩa thứ hai" },
        audio_url: null,
        image_url: null,
        order_index: 1,
      },
    ],
    exercises: [
      {
        id: "33333333-3333-4333-8333-333333333333",
        title: "Bài luyện tập",
        part_type: "part5",
        order_index: 0,
        questions: [],
        groups: [
          {
            id: "44444444-4444-4444-8444-444444444444",
            passage_text: null,
            audio_url: null,
            image_url: null,
            order_index: 0,
            questions: [
              {
                id: questionId,
                content: "Chọn đáp án đúng.",
                order_index: 0,
                options: [
                  {
                    id: optionId,
                    content: "Lựa chọn A",
                    label: "A",
                    order_index: 0,
                  },
                  {
                    id: "99999999-9999-4999-8999-999999999999",
                    content: "Lựa chọn B",
                    label: "B",
                    order_index: 1,
                  },
                ],
              },
            ],
          },
        ],
      },
    ],
    ...overrides,
  };
}

function renderPreview(
  data = preview(),
  isEnrolled = false,
) {
  return render(
    <PublicCoursePreviewExperience
      data={data}
      isEnrolled={isEnrolled}
      returnToCourseHref="/courses/public-course"
    />,
  );
}

describe("public course Preview experience", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("keeps card ratings local and evaluates an exercise through the stateless Preview Action", async () => {
    mocks.answer.mockResolvedValue({
      status: "success",
      data: { isCorrect: true, explanation: "Đây là lời giải." },
    });
    renderPreview();

    expect(screen.getByText("Tiến độ trong lượt xem thử này không được lưu.")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Hiện đáp án" }));
    fireEvent.click(screen.getByRole("button", { name: "Lại" }));
    expect(screen.getByText("beta")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Hiện đáp án" }));
    fireEvent.click(screen.getByRole("button", { name: "Ổn" }));
    expect(screen.getByText("alpha")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Hiện đáp án" }));
    fireEvent.click(screen.getByRole("button", { name: "Dễ" }));

    fireEvent.click(screen.getByRole("button", { name: "A. Lựa chọn A" }));
    fireEvent.click(screen.getByRole("button", { name: "Kiểm tra đáp án" }));

    expect(await screen.findByText("Chính xác!")).toBeTruthy();
    expect(screen.getByText("Đây là lời giải.")).toBeTruthy();
    expect(mocks.answer).toHaveBeenCalledExactlyOnceWith({
      courseSlug,
      topicSlug,
      questionId,
      selectedOptionId: optionId,
    });
    expect(mocks.getFirstTopic).not.toHaveBeenCalled();

    fireEvent.click(screen.getByRole("button", { name: /Hoàn thành bài học|Xem kết quả/ }));
    expect(screen.getByText("Bạn đã xem hết nội dung mẫu.")).toBeTruthy();
    expect(screen.getByText(/Nội dung trong phiên này không được lưu thành tiến độ học/)).toBeTruthy();
    expect(screen.queryByRole("button", { name: "Tiếp tục học" })).toBeNull();
  });

  it("clears protected content when answer evaluation reports that access was revoked", async () => {
    mocks.answer.mockResolvedValue({ status: "unavailable" });
    renderPreview(preview({ flashcards: [] }));

    fireEvent.click(screen.getByRole("button", { name: "A. Lựa chọn A" }));
    fireEvent.click(screen.getByRole("button", { name: "Kiểm tra đáp án" }));

    expect(
      await screen.findByRole("heading", {
        name: "Nội dung xem thử hiện không khả dụng",
      }),
    ).toBeTruthy();
    expect(screen.queryByText("Chọn đáp án đúng.")).toBeNull();
    expect(screen.getByRole("link", { name: "Về khóa học" }).getAttribute("href"))
      .toBe("/courses/public-course");
  });

  it("preserves a selected option after a recoverable service error", async () => {
    mocks.answer.mockResolvedValue({
      status: "error",
      error: "Không thể kiểm tra câu trả lời lúc này. Vui lòng thử lại.",
    });
    renderPreview(preview({ flashcards: [] }));

    const option = screen.getByRole("button", { name: "A. Lựa chọn A" });
    fireEvent.click(option);
    fireEvent.click(screen.getByRole("button", { name: "Kiểm tra đáp án" }));

    expect(await screen.findByRole("alert")).toBeTruthy();
    expect(option.getAttribute("aria-pressed")).toBe("true");
  });

  it("disables answer controls while the stateless check is pending", async () => {
    let resolveAnswer!: (value: {
      status: "success";
      data: { isCorrect: boolean; explanation: string | null };
    }) => void;
    mocks.answer.mockReturnValue(
      new Promise((resolve) => {
        resolveAnswer = resolve;
      }),
    );
    renderPreview(preview({ flashcards: [] }));

    const option = screen.getByRole("button", { name: "A. Lựa chọn A" });
    fireEvent.click(option);
    fireEvent.click(screen.getByRole("button", { name: "Kiểm tra đáp án" }));

    expect(await screen.findByText("Đang kiểm tra câu trả lời...")).toBeTruthy();
    expect(option.matches(":disabled")).toBe(true);
    expect((screen.getByRole("button", { name: "Đang kiểm tra..." }) as HTMLButtonElement).disabled)
      .toBe(true);

    await act(async () => {
      resolveAnswer({
        status: "success",
        data: { isCorrect: true, explanation: null },
      });
    });
    expect(await screen.findByText("Chính xác!")).toBeTruthy();
  });

  it("clears the Preview when guarded media reports that the object is unavailable", async () => {
    mocks.getPreview.mockResolvedValue({ status: "unavailable" });
    const data = preview({ flashcards: [] });
    data.exercises[0].groups[0].audio_url =
      "/api/public-course-preview/media/44444444-4444-4444-8444-444444444444/audio";
    renderPreview(data);

    fireEvent.error(screen.getByLabelText("Âm thanh ngữ liệu"));

    expect(
      await screen.findByRole("heading", {
        name: "Nội dung xem thử hiện không khả dụng",
      }),
    ).toBeTruthy();
    expect(mocks.getPreview).toHaveBeenCalledWith({ courseSlug, topicSlug });
    expect(screen.queryByText("Chọn đáp án đúng.")).toBeNull();
  });

  it("offers enrolled continuation only after the local Preview session ends", async () => {
    mocks.getFirstTopic.mockResolvedValue({ error: null, topicSlug: "first-topic" });
    const singleCard = preview().flashcards[0];
    renderPreview(preview({ flashcards: [singleCard], exercises: [] }), true);

    expect(screen.queryByRole("button", { name: "Tiếp tục học" })).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "Hiện đáp án" }));
    fireEvent.click(screen.getByRole("button", { name: "Dễ" }));
    expect(screen.getByRole("button", { name: "Tiếp tục học" })).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Tiếp tục học" }));

    expect(mocks.getFirstTopic).toHaveBeenCalledWith(courseSlug);
    await waitFor(() => {
      expect(mocks.push).toHaveBeenCalledWith("/learn/public-course/first-topic");
    });
  });
});
