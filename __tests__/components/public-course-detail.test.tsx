import React, { useState, useTransition } from "react";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { renderToStaticMarkup } from "react-dom/server";
import { notFound, useRouter } from "next/navigation";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { getPublicCourseDetail } from "@/app/actions/public-course";
import { createCheckoutSession } from "@/app/actions/payment";
import { getFirstTopicSlugByCourseSlug } from "@/app/actions/course-navigation";
import CanonicalCourseDetailPage, {
  generateMetadata,
} from "@/app/(client)/courses/[course-slug]/page";
import PublicCourseDetailLoading from "@/app/(client)/courses/[course-slug]/loading";
import LegacyCourseDetailPage from "@/app/(client)/learn/[course-slug]/page";
import { PublicCourseDetailView } from "@/app/(client)/courses/_components/PublicCourseDetailView";
import { PublicCourseEnrollmentCard } from "@/app/(client)/courses/_components/PublicCourseEnrollmentCard";
import PublicCoursePaymentModal, {
  PublicCoursePaymentModalCloseButton,
} from "@/app/(client)/courses/_components/PublicCoursePaymentModal";
import PublicCoursePaymentStageDiscount from "@/app/(client)/courses/_components/PublicCoursePaymentStageDiscount";
import type { PublicCourseDetail } from "@/lib/schemas/public-course";
import { toast } from "sonner";

vi.mock("@/app/actions/public-course", () => ({
  getPublicCourseDetail: vi.fn(),
}));

vi.mock("@/app/actions/payment", () => ({
  createCheckoutSession: vi.fn(),
  cancelCheckoutSession: vi.fn(),
  checkPaymentStatus: vi.fn(),
}));

vi.mock("@/app/actions/discount", () => ({
  validateDiscountPreview: vi.fn(),
}));

vi.mock("@/app/actions/course-navigation", () => ({
  getFirstTopicSlugByCourseSlug: vi.fn(),
}));

vi.mock("@/utils/supabase/client", () => ({
  createClient: vi.fn(),
}));

vi.mock("canvas-confetti", () => ({ default: vi.fn() }));

vi.mock("sonner", () => ({
  toast: {
    success: vi.fn(),
    error: vi.fn(),
  },
}));

vi.mock("next/navigation", () => ({
  notFound: vi.fn(() => {
    throw new Error("NEXT_NOT_FOUND");
  }),
  useRouter: vi.fn(),
}));

vi.mock("react", async (importOriginal) => {
  const actual = await importOriginal<typeof import("react")>();
  return {
    ...actual,
    useState: vi.fn(actual.useState),
    useTransition: vi.fn(),
  };
});

// Test plan:
// - Mục tiêu: bảo vệ canonical/legacy public detail dùng chung DTO, renderer và public-only presentation.
// - Loại test: component/route static render, metadata và source contract có giới hạn.
// - Đối tượng: canonical/legacy detail pages, metadata, shared detail view, loading, enrollment và payment modal.
// - Case thành công: public detail đúng hierarchy; free/paid modal đúng copy, pending, close và enrollment transition.
// - Case thất bại: not-found dùng framework boundary; navigation lỗi sau free enrollment không đảo success.
// - Bảo mật/phân quyền: không render protected counts/content/contact/internal role; preview không tạo workspace link.
// - Ổn định/resilience: nullable/empty DTO vẫn render; free submit chống lặp; legacy không redirect.
// - Invariant cần giữ: workspace route không đổi, payment cancel chờ B1.5, old getCourseDetail path không còn production caller.
// - Kết quả verify gần nhất: xem evidence B1.4 hiện hành trong progress.md.

const mockedGetPublicCourseDetail = vi.mocked(getPublicCourseDetail);
const mockedNotFound = vi.mocked(notFound);
const mockedUseRouter = vi.mocked(useRouter);
const mockedUseState = vi.mocked(useState);
const mockedUseTransition = vi.mocked(useTransition);
const mockedCreateCheckoutSession = vi.mocked(createCheckoutSession);
const mockedGetFirstTopicSlug = vi.mocked(getFirstTopicSlugByCourseSlug);
const mockedToast = vi.mocked(toast);
const pushRoute = vi.fn();
const refreshRoute = vi.fn();

function detail(overrides: Partial<PublicCourseDetail> = {}): PublicCourseDetail {
  return {
    id: "11111111-1111-4111-8111-111111111111",
    title: "TOEIC nền tảng",
    slug: "toeic-nen-tang",
    description: "Lộ trình TOEIC rõ ràng cho người mới bắt đầu.",
    thumbnail_url: "https://example.com/toeic.webp",
    price: 250000,
    created_at: "2026-07-10T10:00:00.000Z",
    enrollment_count: 42,
    owner: {
      id: "22222222-2222-4222-8222-222222222222",
      full_name: "Nguyễn Minh Anh",
      avatar_url: null,
      bio: "Giảng viên TOEIC.",
      experience_years: 7,
      certifications: "TOEIC 990",
    },
    collaborators: [
      {
        id: "33333333-3333-4333-8333-333333333333",
        full_name: "Trần Gia Hân",
        avatar_url: null,
        bio: null,
        experience_years: null,
        certifications: null,
      },
    ],
    syllabus: [
      {
        id: "44444444-4444-4444-8444-444444444444",
        title: "Khởi động với nền tảng thật dài để kiểm tra khả năng xuống dòng an toàn",
        order_index: 0,
        topics: [
          {
            id: "55555555-5555-4555-8555-555555555555",
            title: "Chủ đề mở đầu",
            slug: "chu-de-mo-dau",
            order_index: 0,
            is_temporary_preview: true,
          },
          {
            id: "66666666-6666-4666-8666-666666666666",
            title: "Chủ đề luyện tập",
            slug: "chu-de-luyen-tap",
            order_index: 1,
            is_temporary_preview: false,
          },
        ],
      },
      {
        id: "77777777-7777-4777-8777-777777777777",
        title: "Chương đang chuẩn bị",
        order_index: 1,
        topics: [],
      },
    ],
    is_enrolled: false,
    ...overrides,
  };
}

function pageProps(slug = "toeic-nen-tang") {
  return { params: Promise.resolve({ "course-slug": slug }) };
}

function countOccurrences(source: string, value: string) {
  return source.split(value).length - 1;
}

function paymentModalProps(coursePrice: number) {
  return {
    isOpen: true,
    onClose: vi.fn(),
    paymentData: null,
    paymentId: null,
    courseId: detail().id,
    coursePrice,
    courseTitle: detail().title,
    thumbnailUrl: null,
    onGeneratePayment: vi.fn().mockResolvedValue(false),
    onSuccess: vi.fn(),
  };
}

function getEnrollmentModalWithState(course: PublicCourseDetail) {
  const setModalOpen = vi.fn();
  const setPaymentData = vi.fn();
  const setPaymentId = vi.fn();

  mockedUseState.mockReset();
  mockedUseState
    .mockReturnValueOnce([true, setModalOpen])
    .mockReturnValueOnce([{ checkoutUrl: "stale" }, setPaymentData])
    .mockReturnValueOnce(["stale-payment-id", setPaymentId]);

  const enrollmentCard = PublicCourseEnrollmentCard({ course });
  const modal = React.Children.toArray(enrollmentCard.props.children).find(
    (child) =>
      React.isValidElement(child) && child.type === PublicCoursePaymentModal,
  ) as React.ReactElement<{
    onGeneratePayment: (couponCode?: string) => Promise<boolean>;
  }>;

  return { modal, setModalOpen, setPaymentData, setPaymentId };
}

describe("public course detail routes and presentation", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockedUseState.mockImplementation(React.useState);
    mockedUseRouter.mockReturnValue({
      push: pushRoute,
      refresh: refreshRoute,
    } as ReturnType<typeof useRouter>);
    mockedUseTransition.mockReturnValue([
      false,
      (callback) => {
        void callback();
      },
    ]);
  });

  it("renders canonical success through the shared public detail view", async () => {
    mockedGetPublicCourseDetail.mockResolvedValue({
      status: "success",
      data: detail(),
    });

    const html = renderToStaticMarkup(
      await CanonicalCourseDetailPage(pageProps()),
    );

    expect(mockedGetPublicCourseDetail).toHaveBeenCalledWith("toeic-nen-tang");
    expect(countOccurrences(html, "<h1")).toBe(1);
    expect(html).toContain("TOEIC nền tảng");
    expect(html).toContain('href="/courses"');
    expect(html).toContain("Tổng quan khóa học");
  });

  it.each(["invalid slug", "unknown-course"])(
    "maps %s to the same public not-found boundary",
    async (slug) => {
      mockedGetPublicCourseDetail.mockResolvedValue({ status: "not_found" });

      await expect(CanonicalCourseDetailPage(pageProps(slug))).rejects.toThrow(
        "NEXT_NOT_FOUND",
      );
      expect(mockedNotFound).toHaveBeenCalledOnce();
    },
  );

  it("renders a safe retry state for recoverable errors without calling notFound", async () => {
    mockedGetPublicCourseDetail.mockResolvedValue({
      status: "error",
      error: "raw Supabase and Zod details",
    });

    const html = renderToStaticMarkup(
      await CanonicalCourseDetailPage(pageProps()),
    );

    expect(mockedNotFound).not.toHaveBeenCalled();
    expect(html).toContain('role="alert"');
    expect(html).toContain(">Thử lại</button>");
    expect(html).not.toContain("raw Supabase and Zod details");
  });

  it("keeps legacy detail on its URL while rendering the same shared view", async () => {
    mockedGetPublicCourseDetail.mockResolvedValue({
      status: "success",
      data: detail(),
    });

    const canonicalHtml = renderToStaticMarkup(
      await CanonicalCourseDetailPage(pageProps()),
    );
    const legacyHtml = renderToStaticMarkup(
      await LegacyCourseDetailPage(pageProps()),
    );

    expect(legacyHtml).toBe(canonicalHtml);
    const legacySource = readFileSync(
      join(process.cwd(), "app/(client)/learn/[course-slug]/page.tsx"),
      "utf8",
    );
    expect(legacySource).toContain("PublicCourseDetailRoute");
    expect(legacySource).not.toContain("redirect(");
    expect(legacySource).not.toContain("generateMetadata");
    expect(
      existsSync(
        join(
          process.cwd(),
          "app/(client)/learn/[course-slug]/[topic-slug]/page.tsx",
        ),
      ),
    ).toBe(true);
  });

  it("uses safe canonical metadata and hides non-success state", async () => {
    mockedGetPublicCourseDetail.mockResolvedValueOnce({
      status: "success",
      data: detail(),
    });

    await expect(generateMetadata(pageProps())).resolves.toMatchObject({
      title: "TOEIC nền tảng | VocaSpace",
      description: "Lộ trình TOEIC rõ ràng cho người mới bắt đầu.",
      alternates: { canonical: "/courses/toeic-nen-tang" },
    });

    mockedGetPublicCourseDetail.mockResolvedValueOnce({
      status: "error",
      error: "internal status",
    });
    const safeMetadata = await generateMetadata(pageProps("hidden-course"));

    expect(safeMetadata).toMatchObject({
      title: "Khóa học | VocaSpace",
      robots: { index: false, follow: false },
    });
    expect(JSON.stringify(safeMetadata)).not.toContain("internal status");
    expect(safeMetadata.alternates).toBeUndefined();
  });

  it("renders only public-safe stats, instructor fields and presentation-only syllabus", () => {
    const html = renderToStaticMarkup(<PublicCourseDetailView course={detail()} />);

    expect(html).toContain("2</p><p");
    expect(html).toContain("Chương học");
    expect(html).toContain("Chủ đề công khai");
    expect(html).toContain("42</p><p");
    expect(html).toContain("Nguyễn Minh Anh");
    expect(html).toContain("Trần Gia Hân");
    expect(html).toContain("Chương này chưa có chủ đề công khai.");
    expect(countOccurrences(html, "Xem trước tạm thời")).toBe(1);
    expect(html).toContain("không cấp quyền truy cập nội dung học");
    expect(html).not.toContain("Thẻ từ vựng");
    expect(html).not.toContain("Bài tập TOEIC");
    expect(html).not.toContain("original_price");
    expect(html).not.toMatch(/href="\/learn\/toeic-nen-tang\/(?:chu-de-mo-dau|chu-de-luyen-tap)"/);
  });

  it("places the enrollment action before detail sections in mobile document order", () => {
    const html = renderToStaticMarkup(<PublicCourseDetailView course={detail()} />);

    expect(html.indexOf("TOEIC nền tảng")).toBeLessThan(
      html.indexOf("Bắt đầu khóa học"),
    );
    expect(html.indexOf("Bắt đầu khóa học")).toBeLessThan(
      html.indexOf("Tổng quan khóa học"),
    );
  });

  it("handles null owner, empty collaborators, empty syllabus and missing image", () => {
    const html = renderToStaticMarkup(
      <PublicCourseDetailView
        course={detail({
          title: "Khóa học có tiêu đề rất dài ".repeat(5),
          description: null,
          thumbnail_url: null,
          owner: null,
          collaborators: [],
          syllabus: [],
        })}
      />,
    );

    expect(html).toContain("Thông tin giới thiệu khóa học đang được cập nhật.");
    expect(html).toContain("Thông tin giảng viên phụ trách đang được cập nhật.");
    expect(html).toContain("chưa có cộng tác viên công khai");
    expect(html).toContain("Đề cương đang được cập nhật");
    expect(html).toContain('role="img"');
    expect(html).toContain("Chưa có ảnh bìa cho khóa học");
  });

  it("shows enrolled continuation and unenrolled payment entry without legacy DTO fields", () => {
    const enrolledHtml = renderToStaticMarkup(
      <PublicCourseEnrollmentCard course={detail({ is_enrolled: true })} />,
    );
    const paidHtml = renderToStaticMarkup(
      <PublicCourseEnrollmentCard course={detail()} />,
    );
    const freeHtml = renderToStaticMarkup(
      <PublicCourseEnrollmentCard course={detail({ price: 0 })} />,
    );

    expect(enrolledHtml).toContain(">Tiếp tục học</button>");
    expect(paidHtml).toContain(">Đăng ký khóa học</button>");
    expect(freeHtml).toContain(">Đăng ký miễn phí</button>");
    expect(paidHtml).toContain('aria-hidden="true"');
    expect(paidHtml).toContain("inert");

    const enrollmentSource = readFileSync(
      join(
        process.cwd(),
        "app/(client)/courses/_components/PublicCourseEnrollmentCard.tsx",
      ),
      "utf8",
    );
    expect(enrollmentSource).toContain("getFirstTopicSlugByCourseSlug");
    expect(enrollmentSource).toContain("createCheckoutSession");
    expect(enrollmentSource).not.toContain("original_price");

    const paymentActionSource = readFileSync(
      join(process.cwd(), "app/actions/payment.ts"),
      "utf8",
    );
    expect(paymentActionSource).toContain(
      "cancelUrl: `${process.env.NEXT_PUBLIC_APP_URL}/learn/${courseId}`",
    );
  });

  it("renders free enrollment as confirmation without coupon or payment UI", () => {
    const freeHtml = renderToStaticMarkup(
      <PublicCoursePaymentModal {...paymentModalProps(0)} />,
    );
    const pendingHtml = renderToStaticMarkup(
      <PublicCoursePaymentStageDiscount
        coursePrice={0}
        courseTitle={detail().title}
        thumbnailUrl={null}
        couponCode=""
        discountAmount={0}
        finalAmount={0}
        couponLoading={false}
        isGenerating
        errorMsg=""
        successMsg=""
        onCouponChange={vi.fn()}
        onApplyCoupon={vi.fn()}
        onProceedToPayment={vi.fn()}
      />,
    );

    expect(freeHtml).toContain("Miễn phí");
    expect(freeHtml).toContain(">Đăng ký miễn phí</button>");
    expect(freeHtml).not.toContain("Mã giảm giá");
    expect(freeHtml).not.toContain("Áp dụng");
    expect(freeHtml).not.toContain("Thanh toán");
    expect(freeHtml).not.toContain("TIẾN HÀNH THANH TOÁN");
    expect(pendingHtml).toContain("disabled");
    expect(pendingHtml).toContain("Đang đăng ký...");
  });

  it("preserves coupon and payment presentation for paid courses", () => {
    const paidHtml = renderToStaticMarkup(
      <PublicCoursePaymentModal {...paymentModalProps(250000)} />,
    );

    expect(paidHtml).toContain("Mã giảm giá");
    expect(paidHtml).toContain("Áp dụng");
    expect(paidHtml).toContain("Thanh toán");
    expect(paidHtml).toContain("TIẾN HÀNH THANH TOÁN");
    expect(paidHtml).toContain("QUÉT MÃ THANH TOÁN");
    expect(paidHtml).toContain('aria-hidden="true" inert=""');
  });

  it("requires an explicit opt-in before Next Image may fetch local IPs", () => {
    const configSource = readFileSync(
      join(process.cwd(), "next.config.ts"),
      "utf8",
    );

    expect(configSource).toContain(
      'process.env.ALLOW_LOCAL_IMAGE_IP === "true"',
    );
    expect(configSource).not.toContain(
      'dangerouslyAllowLocalIP: process.env.NODE_ENV === "development"',
    );
  });

  it("closes and clears the modal before refreshing and navigating after free enrollment", async () => {
    mockedCreateCheckoutSession.mockResolvedValue({
      type: "free",
      message: "Đăng ký thành công!",
    });
    mockedGetFirstTopicSlug.mockResolvedValue({
      error: null,
      topicSlug: "chu-de-mo-dau",
    });
    const state = getEnrollmentModalWithState(detail({ price: 0 }));

    await expect(state.modal.props.onGeneratePayment()).resolves.toBe(false);

    expect(state.setModalOpen).toHaveBeenCalledWith(false);
    expect(state.setPaymentData).toHaveBeenCalledWith(null);
    expect(state.setPaymentId).toHaveBeenCalledWith(null);
    expect(mockedToast.success).toHaveBeenCalledWith("Đăng ký thành công!");
    expect(refreshRoute).toHaveBeenCalledOnce();
    expect(mockedGetFirstTopicSlug).toHaveBeenCalledWith("toeic-nen-tang");
    expect(pushRoute).toHaveBeenCalledWith(
      "/learn/toeic-nen-tang/chu-de-mo-dau",
    );
    expect(state.setModalOpen.mock.invocationCallOrder[0]).toBeLessThan(
      refreshRoute.mock.invocationCallOrder[0],
    );
    expect(state.setModalOpen.mock.invocationCallOrder[0]).toBeLessThan(
      mockedGetFirstTopicSlug.mock.invocationCallOrder[0],
    );
  });

  it("keeps successful free enrollment closed when learning-entry navigation fails", async () => {
    mockedCreateCheckoutSession.mockResolvedValue({
      type: "free",
      message: "Đăng ký thành công!",
    });
    mockedGetFirstTopicSlug.mockResolvedValue({
      error: "Khóa học chưa có chủ đề công khai.",
      topicSlug: null,
    });
    const state = getEnrollmentModalWithState(detail({ price: 0 }));

    await state.modal.props.onGeneratePayment();

    expect(state.setModalOpen).toHaveBeenCalledTimes(1);
    expect(state.setModalOpen).toHaveBeenCalledWith(false);
    expect(mockedToast.success).toHaveBeenCalledWith("Đăng ký thành công!");
    expect(mockedToast.error).toHaveBeenCalledTimes(1);
    expect(mockedToast.error).toHaveBeenCalledWith(
      "Khóa học chưa có chủ đề công khai.",
    );
    expect(refreshRoute).toHaveBeenCalledOnce();
    expect(pushRoute).not.toHaveBeenCalled();
  });

  it("uses an accessible shadcn icon control to close the enrollment modal", () => {
    const onClose = vi.fn();
    const closeButton = PublicCoursePaymentModalCloseButton({
      onClose,
    }) as React.ReactElement<{ onClick: () => void }>;
    const html = renderToStaticMarkup(
      <PublicCoursePaymentModalCloseButton onClose={onClose} />,
    );

    closeButton.props.onClick();

    expect(onClose).toHaveBeenCalledOnce();
    expect(html).toContain('aria-label="Đóng cửa sổ đăng ký"');
    expect(html).toContain("<svg");
    expect(html).not.toContain("×");
  });

  it("keeps loading geometry accessible without adding another main landmark", () => {
    const html = renderToStaticMarkup(<PublicCourseDetailLoading />);

    expect(html).toContain('aria-busy="true"');
    expect(html).toContain("Đang tải thông tin khóa học");
    expect(html).not.toContain("<main");
  });

  it("removes the obsolete detail data path and duplicate legacy presentation", () => {
    expect(existsSync(join(process.cwd(), "app/actions/course-detail.ts"))).toBe(
      false,
    );
    expect(
      existsSync(join(process.cwd(), "lib/schemas/course-detail.ts")),
    ).toBe(false);
    for (const legacyComponent of [
      "course-stats.tsx",
      "teacher-collab-group.tsx",
      "syllabus-accordion.tsx",
      "sticky-enroll-card.tsx",
    ]) {
      expect(
        existsSync(
          join(
            process.cwd(),
            "app/(client)/learn/[course-slug]/_components",
            legacyComponent,
          ),
        ),
      ).toBe(false);
    }
  });
});
