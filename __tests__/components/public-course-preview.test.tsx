// @vitest-environment jsdom

import { act, fireEvent, render, screen, waitFor, within } from "@/__tests__/support/intl";
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
// - Trình bày dùng chung với learning workspace D8-LUI (candidate): ChoiceGroup radio, ExerciseContext, thông báo thiếu ngữ liệu bắt buộc, kết thúc nói đúng là đã xem mẫu.
// - Điều hướng câu hỏi (D8-LUI follow-up 3, candidate): "Danh sách câu hỏi" dùng state cục bộ, không gọi thêm Server Action; hiện trạng thái đúng/chưa đúng/chưa trả lời, nhảy tới câu bất kỳ, câu đã đúng hiện lại lựa chọn đã chọn; không còn hộp "Chính xác!" hiển thị (giữ thông báo cho trình đọc màn hình và phần giải thích). Cột câu hỏi cạnh ngữ liệu chỉ dính khi vừa viewport; "Tới câu hỏi" đưa focus vào tiêu đề; câu cuối vào thẳng màn hình tóm tắt Preview bằng nút chính, không thêm bước phụ.
// - Kết quả trả về muộn: phản hồi của một câu chỉ gắn vào đúng câu đã gửi (cùng nhóm và khác nhóm), vẫn ghi vào lịch sử phiên của câu đó; quay lại câu đang chờ thì vẫn bị khóa, không gửi lần hai; phản hồi unavailable luôn đóng nội dung bất kể đang ở câu nào. Ảnh phóng to bị từ chối sau khi ảnh nhỏ đã tải sẽ kiểm tra lại quyền xem thử.
// - Bấm đúp sau khi chấm thẻ (LF8 AC7, candidate): click thuộc cử chỉ bắt đầu trước khi thẻ kế tiếp hiện, hoặc là lần click thứ hai của cú bấm đúp, không lật thẻ kế tiếp; bấm mới hoặc phím vẫn lật; Preview vẫn không gọi Server Action nào khi chấm thẻ.
// - Kết quả verify gần nhất: xem báo cáo checkpoint D8-LUI CP3/CP4 (chạy `npx vitest run __tests__/components/public-course-preview.test.tsx`).

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
        activity_stage: "exercise",
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

  it("does not reveal the next card for a stale or double click after a rating, and keeps rating local (LF8 AC7)", () => {
    renderPreview();

    fireEvent.click(screen.getByRole("button", { name: "Hiện đáp án" }));
    const rating = screen.getByRole("button", { name: "Lại" });
    fireEvent.pointerDown(rating);
    fireEvent.click(rating, { detail: 1 });
    expect(screen.getByText("beta")).toBeTruthy();

    // Second click of a double tap, then a click whose pointerdown came before this card was shown.
    fireEvent.click(screen.getByRole("button", { name: "Hiện đáp án" }), { detail: 2 });
    expect(screen.queryByRole("button", { name: "Ổn" })).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "Hiện đáp án" }), { detail: 1 });
    expect(screen.queryByRole("button", { name: "Ổn" })).toBeNull();

    // A new press reveals it; a second activation of the same rating button is taken only once.
    fireEvent.pointerDown(screen.getByRole("button", { name: "Hiện đáp án" }));
    fireEvent.click(screen.getByRole("button", { name: "Hiện đáp án" }), { detail: 1 });
    const good = screen.getByRole("button", { name: "Ổn" });
    fireEvent.click(good);
    fireEvent.click(good);
    expect(screen.getByText("alpha")).toBeTruthy();
    expect(screen.getByRole("button", { name: "Hiện đáp án" })).toBeTruthy();
    expect(mocks.answer).not.toHaveBeenCalled();
    expect(mocks.getFirstTopic).not.toHaveBeenCalled();
  });

  it("reveals the first card for a click that has no pointerdown, such as an event replayed after hydration (LF8 AC7)", () => {
    renderPreview();
    fireEvent.click(screen.getByRole("button", { name: "Hiện đáp án" }), { detail: 1 });
    expect(screen.getByRole("button", { name: "Lại" })).toBeTruthy();
  });

  it("keeps card ratings local and evaluates an exercise through the stateless Preview Action", async () => {
    mocks.answer.mockResolvedValue({
      status: "success",
      data: { isCorrect: true, explanation: "Đây là lời giải." },
    });
    renderPreview();

    expect(screen.getByText("Xem thử · Tiến độ không được lưu")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Hiện đáp án" }));
    fireEvent.click(screen.getByRole("button", { name: "Lại" }));
    expect(screen.getByText("beta")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Hiện đáp án" }));
    fireEvent.click(screen.getByRole("button", { name: "Ổn" }));
    expect(screen.getByText("alpha")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Hiện đáp án" }));
    fireEvent.click(screen.getByRole("button", { name: "Dễ" }));

    fireEvent.click(screen.getByRole("radio", { name: "Lựa chọn A" }));
    fireEvent.click(screen.getByRole("button", { name: "Xác nhận đáp án" }));

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

    fireEvent.click(screen.getByRole("radio", { name: "Lựa chọn A" }));
    fireEvent.click(screen.getByRole("button", { name: "Xác nhận đáp án" }));

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

    const option = screen.getByRole("radio", { name: "Lựa chọn A" });
    fireEvent.click(option);
    fireEvent.click(screen.getByRole("button", { name: "Xác nhận đáp án" }));

    expect(await screen.findByRole("alert")).toBeTruthy();
    expect(option.getAttribute("aria-checked")).toBe("true");
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

    const option = screen.getByRole("radio", { name: "Lựa chọn A" });
    fireEvent.click(option);
    fireEvent.click(screen.getByRole("button", { name: "Xác nhận đáp án" }));

    expect(await screen.findByText("Đang kiểm tra câu trả lời...")).toBeTruthy();
    expect(option.matches(":disabled")).toBe(true);
    expect((screen.getByRole("button", { name: "Đang kiểm tra…" }) as HTMLButtonElement).disabled)
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

    fireEvent.error(screen.getByLabelText("Âm thanh của nhóm câu hỏi"));

    expect(
      await screen.findByRole("heading", {
        name: "Nội dung xem thử hiện không khả dụng",
      }),
    ).toBeTruthy();
    expect(mocks.getPreview).toHaveBeenCalledWith({ courseSlug, topicSlug });
    expect(screen.queryByText("Chọn đáp án đúng.")).toBeNull();
  });

  it("rechecks eligibility when the enlarged image is refused after the inline one loaded", async () => {
    mocks.getPreview.mockResolvedValue({ status: "unavailable" });
    const data = preview({ flashcards: [] });
    data.exercises[0].part_type = "part1";
    data.exercises[0].groups[0].image_url =
      "/api/public-course-preview/media/44444444-4444-4444-8444-444444444444/image";
    renderPreview(data);

    fireEvent.load(screen.getByAltText("Hình ảnh của nhóm câu hỏi"));
    fireEvent.click(screen.getByRole("button", { name: "Phóng to hình ảnh" }));
    // Preview was withdrawn in between: only the new, enlarged request is denied.
    const dialog = screen.getByRole("dialog");
    expect(mocks.getPreview).not.toHaveBeenCalled();
    fireEvent.error(within(dialog).getByAltText("Hình ảnh của nhóm câu hỏi"));

    expect(mocks.getPreview).toHaveBeenCalledWith({ courseSlug, topicSlug });
    expect(
      await screen.findByRole("heading", { name: "Nội dung xem thử hiện không khả dụng" }),
    ).toBeTruthy();
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


  it("allows completing the preview when final question is answered incorrectly via 'Bỏ qua và hoàn thành'", async () => {
    mocks.answer.mockResolvedValue({
      status: "success",
      data: { isCorrect: false, explanation: "Đáp án chưa đúng." },
    });
    renderPreview(preview({ flashcards: [] }));

    fireEvent.click(screen.getByRole("radio", { name: "Lựa chọn A" }));
    fireEvent.click(screen.getByRole("button", { name: "Xác nhận đáp án" }));

    expect(await screen.findByText("Chưa chính xác")).toBeTruthy();
    expect(screen.getByText("Đáp án chưa đúng.")).toBeTruthy();

    const finishButton = screen.getByRole("button", { name: /Bỏ qua và hoàn thành/i });
    expect(finishButton).toBeTruthy();
    fireEvent.click(finishButton);

    expect(await screen.findByText("Bạn đã xem hết nội dung mẫu.")).toBeTruthy();
    expect(screen.getByText("0/1")).toBeTruthy();
  });

  it("shows the memory check before exercises as a transient stage that never locks them", async () => {
    const memoryQuestionId = "12121212-1212-4121-8121-121212121212";
    const base = preview({ flashcards: [] });
    mocks.answer.mockResolvedValue({
      status: "success",
      data: { isCorrect: false, explanation: "Xem lại từ vựng." },
    });
    renderPreview({
      ...base,
      exercises: [
        ...base.exercises,
        {
          id: "13131313-1313-4131-8131-131313131313",
          title: "Memory check",
          activity_stage: "memory_check",
          part_type: null,
          order_index: 1,
          questions: [
            {
              id: memoryQuestionId,
              content: "Từ nào nghĩa là đáng tin cậy?",
              order_index: 0,
              options: [
                {
                  id: "14141414-1414-4141-8141-141414141414",
                  content: "trustworthy",
                  label: "A",
                  order_index: 0,
                },
              ],
            },
          ],
          groups: [],
        },
      ],
    });

    expect(screen.getByText("Từ nào nghĩa là đáng tin cậy?")).toBeTruthy();
    expect(screen.getByText("Câu hỏi 1/2")).toBeTruthy();
    expect(screen.getAllByText("Memory check").length).toBeGreaterThan(0);

    fireEvent.click(screen.getByRole("radio", { name: "trustworthy" }));
    fireEvent.click(screen.getByRole("button", { name: "Xác nhận đáp án" }));
    expect(await screen.findByText("Chưa chính xác")).toBeTruthy();
    expect(mocks.answer).toHaveBeenCalledWith(
      expect.objectContaining({ questionId: memoryQuestionId }),
    );

    // Câu sai vẫn bỏ qua được: preview không khóa bài tập sau memory check.
    fireEvent.click(screen.getByRole("button", { name: /Bỏ qua câu này/i }));
    expect(screen.getByText("Chọn đáp án đúng.")).toBeTruthy();
    expect(screen.getByText("part5")).toBeTruthy();
  });
  it("names required Part 1 material that the group lacks instead of leaving a blank area", () => {
    const data = preview({ flashcards: [] });
    data.exercises[0].part_type = "part1";
    renderPreview(data);

    expect(screen.getByText(/đang thiếu hình ảnh/)).toBeTruthy();
    expect(screen.getByRole("radio", { name: "Lựa chọn A" })).toBeTruthy();
  });

  it("ends honestly: the sample was viewed and nothing was saved as learner progress", async () => {
    mocks.answer.mockResolvedValue({
      status: "success",
      data: { isCorrect: true, explanation: null },
    });
    renderPreview(preview({ flashcards: [] }));

    fireEvent.click(screen.getByRole("radio", { name: "Lựa chọn A" }));
    fireEvent.click(screen.getByRole("button", { name: "Xác nhận đáp án" }));
    expect(await screen.findByText("Chính xác!")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Hoàn thành bài học" }));

    expect(screen.getByText("Hoàn tất lượt xem thử")).toBeTruthy();
    expect(screen.getByText("Thẻ từ vựng đã xem")).toBeTruthy();
    expect(screen.queryByText(/Từ vựng đã học|Đã hoàn thành/)).toBeNull();
  });
});

describe("public course Preview question navigator", () => {
  const secondQuestionId = "56565656-5656-4565-8565-565656565656";
  const secondOptionId = "67676767-6767-4676-8676-676767676767";

  function twoQuestionPreview() {
    const data = preview({ flashcards: [] });
    data.exercises[0].groups[0].questions.push({
      id: secondQuestionId,
      content: "Câu thứ hai.",
      order_index: 1,
      options: [
        { id: secondOptionId, content: "Hai A", label: "A", order_index: 0 },
        { id: "68686868-6868-4686-8686-686868686868", content: "Hai B", label: "B", order_index: 1 },
      ],
    });
    return data;
  }

  const openNavigator = () =>
    fireEvent.click(screen.getByRole("button", { name: "Danh sách câu hỏi" }));

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("lists every question with its state and jumps locally, without calling any server action", async () => {
    mocks.answer.mockResolvedValue({
      status: "success",
      data: { isCorrect: false, explanation: "Xem lại ngữ liệu." },
    });
    renderPreview(twoQuestionPreview());

    fireEvent.click(screen.getByRole("radio", { name: "Lựa chọn B" }));
    fireEvent.click(screen.getByRole("button", { name: "Xác nhận đáp án" }));
    expect(await screen.findByText("Chưa chính xác")).toBeTruthy();
    expect(mocks.answer).toHaveBeenCalledTimes(1);

    openNavigator();
    const dialog = screen.getByRole("dialog");
    expect(within(dialog).getByRole("heading", { name: /Bài luyện tập/ })).toBeTruthy();
    expect(
      within(dialog).getByRole("button", { name: /Câu 1: Chọn đáp án đúng\.\s*Đang xem · Trả lời chưa đúng/ }),
    ).toBeTruthy();
    expect(
      within(dialog).getByRole("button", { name: /Câu 2: Câu thứ hai\.\s*Chưa trả lời/ }),
    ).toBeTruthy();

    fireEvent.click(within(dialog).getByRole("button", { name: /Câu 2: Câu thứ hai/ }));
    expect(screen.queryByRole("dialog")).toBeNull();
    expect(screen.getByText("Câu hỏi 2/2")).toBeTruthy();
    expect(document.activeElement).toBe(screen.getByRole("heading", { name: "Câu thứ hai." }));
    // The jump is local state: nothing else was sent.
    expect(mocks.answer).toHaveBeenCalledTimes(1);
    expect(mocks.getPreview).not.toHaveBeenCalled();
  });

  it("shows a right answer without a state box and brings it back on a revisit", async () => {
    mocks.answer.mockResolvedValue({
      status: "success",
      data: { isCorrect: true, explanation: "Vì sao câu này đúng." },
    });
    renderPreview(twoQuestionPreview());

    fireEvent.click(screen.getByRole("radio", { name: "Lựa chọn A" }));
    fireEvent.click(screen.getByRole("button", { name: "Xác nhận đáp án" }));
    expect(await screen.findByText("Vì sao câu này đúng.")).toBeTruthy();
    expect(screen.getByText("Chính xác!").className).toContain("sr-only");
    expect(screen.getByRole("radio", { name: /bạn chọn đúng/ }).getAttribute("data-motion")).toBeNull();

    fireEvent.click(screen.getByRole("button", { name: "Câu tiếp theo" }));
    expect(screen.getByText("Câu thứ hai.")).toBeTruthy();
    // The last question has no "Câu tiếp theo"; it finishes the preview instead.
    expect(screen.queryByRole("button", { name: "Câu tiếp theo" })).toBeNull();

    openNavigator();
    fireEvent.click(screen.getByRole("button", { name: /Câu 1: Chọn đáp án đúng/ }));
    // Revisit: the chosen right option is shown again, with its explanation, and no motion replay.
    const revisited = screen.getByRole("radio", { name: /bạn chọn đúng/ });
    expect(revisited.getAttribute("data-motion")).toBeNull();
    expect(screen.getByText("Vì sao câu này đúng.")).toBeTruthy();
    expect(mocks.answer).toHaveBeenCalledTimes(1);
  });

  it("reviews from the end screen and keeps the right-answer count", async () => {
    mocks.answer.mockResolvedValue({
      status: "success",
      data: { isCorrect: true, explanation: null },
    });
    renderPreview(preview({ flashcards: [] }));

    fireEvent.click(screen.getByRole("radio", { name: "Lựa chọn A" }));
    fireEvent.click(screen.getByRole("button", { name: "Xác nhận đáp án" }));
    await screen.findByText("Chính xác!");
    fireEvent.click(screen.getByRole("button", { name: "Hoàn thành bài học" }));
    expect(screen.getByText("Hoàn tất lượt xem thử")).toBeTruthy();
    expect(screen.getByText("1/1")).toBeTruthy();

    openNavigator();
    fireEvent.click(screen.getByRole("button", { name: /Câu 1: Chọn đáp án đúng/ }));
    expect(screen.queryByText("Hoàn tất lượt xem thử")).toBeNull();
    expect(screen.getByText("Câu hỏi 1/1")).toBeTruthy();
  });

  it("pins the question column beside a passage only while it fits, and jumps to the question from the passage end", () => {
    const originalHeight = Object.getOwnPropertyDescriptor(HTMLElement.prototype, "offsetHeight");
    const scrollIntoView = vi.fn();
    Element.prototype.scrollIntoView = scrollIntoView;
    const withPassage = () => {
      const data = twoQuestionPreview();
      data.exercises[0].groups[0].passage_text = "Đoạn văn dài của nhóm.";
      return data;
    };
    try {
      Object.defineProperty(HTMLElement.prototype, "offsetHeight", { configurable: true, get: () => 300 });
      const { unmount } = renderPreview(withPassage());
      const column = screen.getByRole("heading", { name: "Chọn đáp án đúng." }).closest("[data-sticky]");
      expect(column?.getAttribute("data-sticky")).toBe("true");
      fireEvent.click(screen.getByRole("button", { name: "Tới câu hỏi" }));
      expect(document.activeElement).toBe(screen.getByRole("heading", { name: "Chọn đáp án đúng." }));
      expect(scrollIntoView).toHaveBeenCalledWith(expect.objectContaining({ block: "start" }));
      unmount();

      Object.defineProperty(HTMLElement.prototype, "offsetHeight", { configurable: true, get: () => 4000 });
      renderPreview(withPassage());
      expect(
        screen.getByRole("heading", { name: "Chọn đáp án đúng." }).closest("[data-sticky]")?.getAttribute("data-sticky"),
      ).toBe("false");
    } finally {
      if (originalHeight) Object.defineProperty(HTMLElement.prototype, "offsetHeight", originalHeight);
    }
  });

  it("reaches the preview summary from the primary on the last answered question, with no extra step", async () => {
    mocks.answer.mockResolvedValue({ status: "success", data: { isCorrect: true, explanation: null } });
    renderPreview(preview({ flashcards: [] }));
    fireEvent.click(screen.getByRole("radio", { name: "Lựa chọn A" }));
    fireEvent.click(screen.getByRole("button", { name: "Xác nhận đáp án" }));
    await screen.findByText("Chính xác!");

    expect(screen.queryByRole("button", { name: "Câu tiếp theo" })).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "Hoàn thành bài học" }));
    expect(screen.getByText("Hoàn tất lượt xem thử")).toBeTruthy();
  });
  describe("a response that arrives after the learner moved to another question", () => {
    const otherGroupId = "45454545-4545-4545-8545-454545454545";

    function deferredAnswer() {
      let resolve!: (value: unknown) => void;
      mocks.answer.mockReturnValueOnce(
        new Promise((done) => {
          resolve = done;
        }),
      );
      return (value: unknown) => resolve(value);
    }

    function inOtherGroup() {
      const data = twoQuestionPreview();
      data.exercises[0].groups[0].questions.pop();
      data.exercises[0].groups.push({
        id: otherGroupId,
        passage_text: null,
        audio_url: null,
        image_url: null,
        order_index: 1,
        questions: [
          {
            id: secondQuestionId,
            content: "Câu thứ hai.",
            order_index: 0,
            options: [
              { id: secondOptionId, content: "Hai A", label: "A", order_index: 0 },
              { id: "68686868-6868-4686-8686-686868686868", content: "Hai B", label: "B", order_index: 1 },
            ],
          },
        ],
      });
      return data;
    }

    it.each([
      ["the same group", () => twoQuestionPreview()],
      ["a different group", () => inOtherGroup()],
    ])("keeps question 1's result off question 2 (%s) but records it for question 1", async (_name, build) => {
      renderPreview(build());
      const settle = deferredAnswer();

      fireEvent.click(screen.getByRole("radio", { name: "Lựa chọn A" }));
      fireEvent.click(screen.getByRole("button", { name: "Xác nhận đáp án" }));
      fireEvent.click(screen.getByRole("button", { name: "Danh sách câu hỏi" }));
      fireEvent.click(screen.getByRole("button", { name: /Câu 2: Câu thứ hai/ }));

      // While question 1 is still pending, question 2 is a fresh, answerable question.
      expect(screen.getByText("Câu thứ hai.")).toBeTruthy();
      expect(screen.getByRole("radio", { name: "Hai A" }).matches(":disabled")).toBe(false);

      await act(async () => {
        settle({ status: "success", data: { isCorrect: true, explanation: "Giải thích của câu 1." } });
      });

      expect(screen.queryByText("Giải thích của câu 1.")).toBeNull();
      expect(screen.queryByRole("button", { name: "Hoàn thành bài học" })).toBeNull();
      expect(screen.getByRole("radio", { name: "Hai A" }).matches(":disabled")).toBe(false);
      expect(screen.getByRole("button", { name: "Xác nhận đáp án" })).toBeTruthy();

      // The session history still has question 1 answered right, with its explanation.
      fireEvent.click(screen.getByRole("button", { name: "Danh sách câu hỏi" }));
      fireEvent.click(screen.getByRole("button", { name: /Câu 1: Chọn đáp án đúng\.\s*Đã trả lời đúng/ }));
      expect(screen.getByText("Giải thích của câu 1.")).toBeTruthy();
      expect(mocks.answer).toHaveBeenCalledTimes(1);
    });

    it("keeps a revisited pending question locked, sends nothing twice and shows the result when it lands", async () => {
      renderPreview(twoQuestionPreview());
      const settle = deferredAnswer();

      fireEvent.click(screen.getByRole("radio", { name: "Lựa chọn A" }));
      fireEvent.click(screen.getByRole("button", { name: "Xác nhận đáp án" }));
      fireEvent.click(screen.getByRole("button", { name: "Danh sách câu hỏi" }));
      fireEvent.click(screen.getByRole("button", { name: /Câu 2: Câu thứ hai/ }));
      fireEvent.click(screen.getByRole("button", { name: "Danh sách câu hỏi" }));
      fireEvent.click(screen.getByRole("button", { name: /Câu 1: Chọn đáp án đúng/ }));

      expect(screen.getByRole("radio", { name: "Lựa chọn A" }).matches(":disabled")).toBe(true);
      expect((screen.getByRole("button", { name: "Đang kiểm tra…" }) as HTMLButtonElement).disabled).toBe(true);

      await act(async () => {
        settle({ status: "success", data: { isCorrect: true, explanation: "Giải thích của câu 1." } });
      });
      expect(await screen.findByText("Giải thích của câu 1.")).toBeTruthy();
      expect(mocks.answer).toHaveBeenCalledTimes(1);
    });

    it("still fails closed when access was revoked, whichever question is open", async () => {
      renderPreview(twoQuestionPreview());
      const settle = deferredAnswer();

      fireEvent.click(screen.getByRole("radio", { name: "Lựa chọn A" }));
      fireEvent.click(screen.getByRole("button", { name: "Xác nhận đáp án" }));
      fireEvent.click(screen.getByRole("button", { name: "Danh sách câu hỏi" }));
      fireEvent.click(screen.getByRole("button", { name: /Câu 2: Câu thứ hai/ }));

      await act(async () => {
        settle({ status: "unavailable" });
      });
      expect(
        await screen.findByRole("heading", { name: "Nội dung xem thử hiện không khả dụng" }),
      ).toBeTruthy();
      expect(screen.queryByText("Câu thứ hai.")).toBeNull();
    });
  });
});
