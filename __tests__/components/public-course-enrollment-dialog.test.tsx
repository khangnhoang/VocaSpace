// @vitest-environment jsdom

import { act, cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createCheckoutSession } from "@/app/actions/payment";
import { PublicCourseEnrollmentCard } from "@/app/(client)/courses/_components/PublicCourseEnrollmentCard";
import type { PublicCourseDetail } from "@/lib/schemas/public-course";

// Test plan:
// - Mục tiêu: U4 AC1-AC3 - hộp thoại đăng ký trên trang chi tiết khóa học thoát khỏi cột sticky, giữ focus đúng và có bố cục một cột cho khóa miễn phí.
// - Loại test: component interaction trong jsdom với PublicCourseEnrollmentCard và PublicCoursePaymentModal thật; action, Supabase realtime, confetti và toast được mock.
// - Đối tượng: PublicCoursePaymentModal (portal, useDialogFocus), PublicCoursePaymentStageDiscount (nhánh miễn phí).
// - Case thành công: mở hộp thoại -> nằm dưới document.body chứ không trong cột chứa thẻ, focus vào nút "Đăng ký miễn phí",
//   hiện số chương/chủ đề và "Miễn phí"; Tab ở nút cuối quay về nút đầu; Esc và "Để sau" đóng rồi trả focus về nút đã mở.
// - Case thất bại: đang gửi đăng ký thì Esc không đóng và nút đóng bị khóa.
// - Bảo mật/phân quyền: không áp dụng; quyền ghi danh thuộc createCheckoutSession (kiểm riêng).
// - Ổn định/resilience: đóng hộp thoại giữ nó trong DOM nhưng aria-hidden + inert, nên không còn trong cây truy cập.
// - Invariant cần giữ: hộp thoại khóa miễn phí không có ô mã giảm giá hay chữ thanh toán.
// - Kết quả verify gần nhất: passed bằng `npx vitest run __tests__/components/public-course-enrollment-dialog.test.tsx`.

vi.mock("next/navigation", () => ({
  useRouter: () => ({ replace: vi.fn(), refresh: vi.fn(), push: vi.fn() }),
}));
vi.mock("next/image", () => ({
  // eslint-disable-next-line @next/next/no-img-element
  default: ({ src, alt }: { src: string; alt: string }) => <img src={src} alt={alt} />,
}));
vi.mock("@/app/actions/payment", () => ({
  createCheckoutSession: vi.fn(),
  cancelCheckoutSession: vi.fn(),
  checkPaymentStatus: vi.fn(),
}));
vi.mock("@/app/actions/discount", () => ({ validateDiscountPreview: vi.fn() }));
vi.mock("@/app/actions/course-navigation", () => ({ getFirstTopicSlugByCourseSlug: vi.fn() }));
vi.mock("@/utils/supabase/client", () => ({
  createClient: () => ({
    channel: () => {
      const channel = { on: () => channel, subscribe: () => channel };
      return channel;
    },
    removeChannel: vi.fn(),
  }),
}));
vi.mock("canvas-confetti", () => ({ default: vi.fn() }));
vi.mock("sonner", () => ({ toast: { success: vi.fn(), error: vi.fn(), info: vi.fn() } }));

const FREE_COURSE: Pick<
  PublicCourseDetail,
  "id" | "title" | "slug" | "price" | "thumbnail_url" | "is_enrolled" | "learner_progress"
> = {
  id: "22222222-2222-4222-8222-222222222222",
  title: "TOEIC từ vựng nền tảng",
  slug: "toeic-tu-vung-nen-tang",
  price: 0,
  thumbnail_url: null,
  is_enrolled: false,
  learner_progress: null,
};

const DIALOG = { name: "Đăng ký khóa học miễn phí" };

function renderInStickyColumn() {
  render(
    <aside data-testid="sticky-column" className="lg:sticky">
      <PublicCourseEnrollmentCard course={FREE_COURSE} contentSummary={{ chapterCount: 2, topicCount: 5 }} />
    </aside>,
  );
  const opener = within(screen.getByTestId("sticky-column")).getByRole("button", { name: "Đăng ký miễn phí" });
  act(() => opener.focus());
  fireEvent.click(opener);
  return { opener, dialog: screen.getByRole("dialog", DIALOG) };
}

describe("public course enrollment dialog (U4)", () => {
  beforeEach(() => {
    vi.mocked(createCheckoutSession).mockReset();
  });

  afterEach(() => {
    cleanup();
  });

  it("renders outside the sticky column with focus on the primary action and the free layout", () => {
    const { dialog } = renderInStickyColumn();

    expect(screen.getByTestId("sticky-column").contains(dialog)).toBe(false);
    expect(dialog.parentElement).toBe(document.body);
    expect(document.activeElement).toBe(within(dialog).getByRole("button", { name: "Đăng ký miễn phí" }));
    expect(within(dialog).getByText("2 chương · 5 chủ đề")).toBeTruthy();
    expect(within(dialog).getByText("Miễn phí")).toBeTruthy();
    expect(within(dialog).queryByText(/Mã giảm giá|Thanh toán/)).toBeNull();
  });

  it("keeps Tab inside the dialog", () => {
    const { dialog } = renderInStickyColumn();
    const buttons = within(dialog).getAllByRole("button");
    const first = buttons[0];
    const last = buttons[buttons.length - 1];

    act(() => last.focus());
    fireEvent.keyDown(document, { key: "Tab" });
    expect(document.activeElement).toBe(first);

    fireEvent.keyDown(document, { key: "Tab", shiftKey: true });
    expect(document.activeElement).toBe(last);

    // Focus đã rơi ra ngoài hộp thoại (ví dụ nút vừa bấm bị inert khi chuyển bước) thì Tab đưa nó về nút đầu.
    act(() => (document.activeElement as HTMLElement).blur());
    fireEvent.keyDown(document, { key: "Tab" });
    expect(document.activeElement).toBe(first);
  });

  it("closes on Escape and on 'Để sau', returning focus to the opener", () => {
    const { opener, dialog } = renderInStickyColumn();

    fireEvent.keyDown(document, { key: "Escape" });
    expect(screen.queryByRole("dialog", DIALOG)).toBeNull();
    expect(document.activeElement).toBe(opener);

    fireEvent.click(opener);
    fireEvent.click(within(dialog).getByRole("button", { name: "Để sau" }));
    expect(screen.queryByRole("dialog", DIALOG)).toBeNull();
    expect(document.activeElement).toBe(opener);
  });

  it("does not close while the enrollment request is in flight", async () => {
    vi.mocked(createCheckoutSession).mockReturnValue(new Promise(() => {}));
    const { dialog } = renderInStickyColumn();

    await act(async () => {
      fireEvent.click(within(dialog).getByRole("button", { name: "Đăng ký miễn phí" }));
    });

    expect(within(dialog).getByRole("button", { name: "Đang đăng ký..." })).toHaveProperty("disabled", true);
    expect(within(dialog).getByRole("button", { name: "Đóng cửa sổ đăng ký" })).toHaveProperty("disabled", true);
    fireEvent.keyDown(document, { key: "Escape" });
    expect(screen.getByRole("dialog", DIALOG)).toBe(dialog);
  });
});
