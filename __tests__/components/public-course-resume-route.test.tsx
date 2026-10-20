import { beforeEach, describe, expect, it, vi } from "vitest";
import { getPublicCourseDetail } from "@/app/actions/public-course";
import { resumePendingCheckout } from "@/app/actions/payment";
import CourseDetailPage from "@/app/(client)/courses/[course-slug]/page";
import type { PublicCourseDetail } from "@/lib/schemas/public-course";
import type { ResumeCheckoutResult } from "@/lib/schemas/payment";

// Test plan:
// - Mục tiêu: FEAT6 AC11/G8 ở tầng route - ?thanh-toan=tiep-tuc chỉ gọi hành động mở lại khi trang khóa học thật sự render.
// - Loại test: route orchestration; action boundary được mock, PublicCourseDetailView được thay bằng stub để bắt props.
// - Đối tượng: CourseDetailPage (searchParams) và PublicCourseDetailRoute.
// - Case thành công: có tham số đúng giá trị -> hành động được gọi một lần với id khóa học và kết quả chuyển xuống view; không tham số hoặc giá trị lạ -> không gọi.
// - Case thất bại: khóa học không tìm thấy hoặc không công khai -> notFound như cũ; lỗi tải -> màn hình lỗi như cũ; cả hai không gọi hành động mở lại.
// - Bảo mật/phân quyền: quyết định đủ điều kiện nằm ở resumePendingCheckout (kiểm riêng); route không tự dựng dữ liệu thanh toán.
// - Invariant cần giữ: không có tham số thì trang không đổi và không tốn truy vấn nào thêm.
// - Kết quả verify gần nhất: passed bằng `npx vitest run __tests__/components/public-course-resume-route.test.tsx`.

vi.mock("@/app/actions/public-course", () => ({ getPublicCourseDetail: vi.fn() }));
vi.mock("@/app/actions/learning-activity", () => ({ getCourseLearningSummary: vi.fn() }));
vi.mock("@/app/actions/payment", () => ({ resumePendingCheckout: vi.fn() }));
vi.mock("next/navigation", () => ({
  notFound: vi.fn(() => {
    throw new Error("NEXT_NOT_FOUND");
  }),
}));
vi.mock("@/app/(client)/courses/_components/PublicCourseDetailView", () => ({
  PublicCourseDetailView: vi.fn(() => null),
}));
vi.mock("@/app/(client)/courses/_components/PublicCourseStates", () => ({
  PublicCourseFeedback: () => null,
}));

const mockedGetDetail = vi.mocked(getPublicCourseDetail);
const mockedResume = vi.mocked(resumePendingCheckout);
const COURSE_ID = "11111111-1111-4111-8111-111111111111";

function course(overrides: Partial<PublicCourseDetail> = {}) {
  return { id: COURSE_ID, slug: "toeic-nen-tang", is_enrolled: false, ...overrides } as PublicCourseDetail;
}

function render(searchParams?: Record<string, string | string[] | undefined>) {
  return CourseDetailPage({
    params: Promise.resolve({ "course-slug": "toeic-nen-tang" }),
    searchParams: searchParams ? Promise.resolve(searchParams) : undefined,
  });
}

// Route trả về element của view; resolve props bằng cách đọc element thay vì render.
async function renderedViewProps(searchParams?: Record<string, string | string[] | undefined>) {
  const element = (await render(searchParams)) as { props: Record<string, unknown> };
  return element.props;
}

describe("course page resume entry route (AC11, G8)", () => {
  const resumed: ResumeCheckoutResult = {
    status: "none",
    reason: "unavailable",
  };

  beforeEach(() => {
    vi.clearAllMocks();
    mockedResume.mockResolvedValue(resumed);
  });

  it("calls the resume action once with the course id and passes the result to the view when the parameter is tiep-tuc", async () => {
    mockedGetDetail.mockResolvedValue({ status: "success", data: course() });

    const props = await renderedViewProps({ "thanh-toan": "tiep-tuc" });

    expect(mockedResume).toHaveBeenCalledTimes(1);
    expect(mockedResume).toHaveBeenCalledWith({ courseId: COURSE_ID });
    expect(props.resumeCheckout).toBe(resumed);
  });

  it.each([
    ["no search params at all", undefined],
    ["an empty search params object", {}],
    ["an unknown value", { "thanh-toan": "khac" }],
    ["another parameter", { other: "tiep-tuc" }],
  ])("does not call the resume action for %s", async (_label, searchParams) => {
    mockedGetDetail.mockResolvedValue({ status: "success", data: course() });

    const props = await renderedViewProps(searchParams);

    expect(mockedResume).not.toHaveBeenCalled();
    expect(props.resumeCheckout).toBeUndefined();
  });

  it("uses the first value when the parameter is repeated", async () => {
    mockedGetDetail.mockResolvedValue({ status: "success", data: course() });

    await renderedViewProps({ "thanh-toan": ["tiep-tuc", "khac"] });

    expect(mockedResume).toHaveBeenCalledTimes(1);
  });

  it("still shows notFound for a missing or unpublished course and makes no resume call", async () => {
    mockedGetDetail.mockResolvedValue({ status: "not_found" });

    await expect(render({ "thanh-toan": "tiep-tuc" })).rejects.toThrow("NEXT_NOT_FOUND");
    expect(mockedResume).not.toHaveBeenCalled();
  });

  it("still shows the load error screen and makes no resume call", async () => {
    mockedGetDetail.mockResolvedValue({ status: "error", error: "boom" });

    const element = (await render({ "thanh-toan": "tiep-tuc" })) as { props: Record<string, unknown> };

    expect(element.props.className).toContain("container");
    expect(mockedResume).not.toHaveBeenCalled();
  });
});
