import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { getCourseLearningSummary } from "@/app/actions/learning-activity";
import { getPublicCourseDetail } from "@/app/actions/public-course";
import { PublicCourseDetailRoute } from "@/app/(client)/courses/_components/PublicCourseDetailRoute";
import type { PublicCourseDetail } from "@/lib/schemas/public-course";

// Test plan:
// - Mục tiêu: FEAT3 AC6 + G5 - trang khóa học công khai chỉ đọc chuỗi ngày học cho học viên đã đăng nhập và ghi danh, và đọc riêng
//   ngoài payload công khai đã cache; khách và người chưa ghi danh không đổi gì.
// - Loại test: route orchestration + static render với action boundary mock. Hai thành phần client nặng (thẻ ghi danh, giáo trình)
//   được thay bằng stub vì không thuộc phạm vi; quy tắc dữ liệu của chuỗi ngày học được kiểm ở integration và action test.
// - Đối tượng: PublicCourseDetailRoute, PublicCourseDetailView (khối CourseLearningActivity).
// - Case thành công: học viên đã ghi danh thấy khối với chuỗi và tối đa 3 chủ đề, mỗi chủ đề là liên kết vào workspace với ngày tương đối.
// - Case thất bại: đọc chuỗi ngày học lỗi vẫn render trang đầy đủ với trạng thái "chưa tải được" lặng lẽ (AC10).
// - Bảo mật/phân quyền: khách và người chưa ghi danh không gọi action chuỗi ngày học, không có khối nào trong HTML; payload công khai
//   (kết quả getPublicCourseDetail) không bị đổi hay nhận thêm khóa nào.
// - Invariant cần giữ: dữ liệu người học đi qua prop riêng `learningSummary`, không đi qua `course`.
// - Kết quả verify gần nhất: xem milestone FEAT3 CP2 trong progress.md.

vi.mock("@/app/actions/public-course", () => ({ getPublicCourseDetail: vi.fn() }));
vi.mock("@/app/actions/learning-activity", () => ({ getCourseLearningSummary: vi.fn() }));
vi.mock("next/navigation", () => ({
  notFound: vi.fn(() => {
    throw new Error("NEXT_NOT_FOUND");
  }),
  useRouter: () => ({ refresh: vi.fn() }),
}));
vi.mock("@/app/(client)/courses/_components/PublicCourseEnrollmentCard", () => ({
  PublicCourseEnrollmentCard: () => null,
}));
vi.mock("@/app/(client)/courses/_components/PublicCourseSyllabus", () => ({
  PublicCourseSyllabus: () => null,
}));

const mockedGetDetail = vi.mocked(getPublicCourseDetail);
const mockedGetSummary = vi.mocked(getCourseLearningSummary);
const COURSE_ID = "11111111-1111-4111-8111-111111111111";

function detail(overrides: Partial<PublicCourseDetail> = {}): PublicCourseDetail {
  return {
    id: COURSE_ID,
    title: "TOEIC nền tảng",
    slug: "toeic-nen-tang",
    description: "Lộ trình TOEIC rõ ràng.",
    thumbnail_url: null,
    price: 250000,
    created_at: "2026-07-10T10:00:00.000Z",
    enrollment_count: 42,
    is_preview_suspended: false,
    owner: {
      id: "22222222-2222-4222-8222-222222222222",
      full_name: "Nguyễn Minh Anh",
      avatar_url: null,
      bio: null,
      experience_years: null,
      certifications: null,
    },
    collaborators: [],
    syllabus: [],
    is_enrolled: false,
    learner_progress: null,
    ...overrides,
  };
}

const topic = (index: number, daysAgo: number) => ({
  topicId: `d0d0d0d0-0000-4000-8000-00000000000${index}`,
  slug: `topic-${index}`,
  title: `Chủ đề gần đây ${index}`,
  lastActivityAt: "2026-03-11T01:04:00+00:00",
  daysAgo,
});

async function renderRoute() {
  return renderToStaticMarkup(await PublicCourseDetailRoute({ courseSlug: "toeic-nen-tang" }));
}

describe("FEAT3 course streak on the public course page", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("shows the course streak and up to three recent topics to an enrolled learner, read separately from the public payload", async () => {
    const enrolled = detail({ is_enrolled: true, learner_progress: { completed_topic_ids: [], next_topic_slug: null } });
    const before = structuredClone(enrolled);
    mockedGetDetail.mockResolvedValue({ status: "success", data: enrolled });
    mockedGetSummary.mockResolvedValue({
      success: true,
      data: { streak: 3, studiedToday: true, recentTopics: [topic(1, 0), topic(2, 1), topic(3, 4)] },
    });

    const html = await renderRoute();

    expect(mockedGetSummary).toHaveBeenCalledExactlyOnceWith(COURSE_ID);
    expect(html).toContain("Chuỗi 3 ngày học khóa này");
    expect(html).toContain('href="/learn/toeic-nen-tang/topic-1"');
    expect(html).toContain('href="/learn/toeic-nen-tang/topic-3"');
    expect(html).toContain("Hôm qua");
    expect(html).toContain("4 ngày trước");
    expect(enrolled).toEqual(before);
  });

  it("still renders the whole page with a quiet unavailable state when the summary cannot be read", async () => {
    mockedGetDetail.mockResolvedValue({
      status: "success",
      data: detail({ is_enrolled: true, learner_progress: { completed_topic_ids: [], next_topic_slug: null } }),
    });
    mockedGetSummary.mockResolvedValue({ success: false, error: "Không thể tải chuỗi ngày học lúc này." });

    const html = await renderRoute();

    expect(html).toContain("TOEIC nền tảng");
    expect(html).toContain("Chưa tải được chuỗi ngày học của khóa này");
    expect(html).not.toContain('role="alert"');
  });

  it("does not read or render anything for a visitor who is not enrolled", async () => {
    const visitor = detail();
    const before = structuredClone(visitor);
    mockedGetDetail.mockResolvedValue({ status: "success", data: visitor });

    const html = await renderRoute();

    expect(mockedGetSummary).not.toHaveBeenCalled();
    expect(html).toContain("TOEIC nền tảng");
    expect(html).not.toContain("ngày học khóa này");
    expect(html).not.toContain("HỌC GẦN ĐÂY");
    expect(visitor).toEqual(before);
    expect(Object.keys(visitor)).not.toContain("learning_summary");
  });

  it("does not read the summary when the public detail itself failed", async () => {
    mockedGetDetail.mockResolvedValue({ status: "error", error: "internal" });

    const html = await renderRoute();

    expect(mockedGetSummary).not.toHaveBeenCalled();
    expect(html).toContain("Chưa thể tải thông tin khóa học");
  });
});
