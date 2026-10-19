import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { getCourseLearningSummary } from "@/app/actions/learning-activity";
import { getPublicCourseDetail } from "@/app/actions/public-course";
import { PublicCourseDetailRoute } from "@/app/(client)/courses/_components/PublicCourseDetailRoute";
import type { PublicCourseDetail } from "@/lib/schemas/public-course";

// Test plan:
// - Mục tiêu: FEAT3 AC6 + AC6a + G5 - trang khóa học công khai cho học viên đã ghi danh có thẻ "đang học" bên phải (chuỗi ngày học,
//   tiến độ x/y, nút Tiếp tục, tối đa 3 chủ đề gần đây) và ảnh bìa ở phần đầu trang; khách và người chưa ghi danh giữ thẻ bán hàng.
// - Loại test: route orchestration + static render với action boundary mock. Hai thành phần nặng (giáo trình, hộp thanh toán) được thay
//   bằng stub vì không thuộc phạm vi; thẻ đăng ký và phần đầu trang render thật. Quy tắc dữ liệu của chuỗi ngày học được kiểm ở
//   integration và action test; điểm đến của nút chính được kiểm ở public-course-detail.test.tsx.
// - Đối tượng: PublicCourseDetailRoute, PublicCourseDetailView (header, aside, cột trái), PublicCourseEnrollmentCard.
// - Case thành công: thẻ đang học đủ nội dung theo thứ tự chuỗi -> tiến độ -> nút -> chủ đề gần đây; không có giá, ghi chú quyền truy
//   cập hay ảnh bìa trong thẻ; nhãn nút "Tiếp tục: <tên chủ đề>" hoặc "Xem tổng quan khóa học" khi không còn chủ đề kế tiếp.
// - Case thất bại: đọc chuỗi ngày học lỗi vẫn giữ tiến độ và nút, hiện trạng thái "chưa tải được" lặng lẽ thay cho chuỗi và chủ đề (AC10);
//   lỗi tải chi tiết công khai không đọc chuỗi.
// - Bảo mật/phân quyền: khách và người chưa ghi danh không gọi action chuỗi ngày học, thẻ bán hàng (giá, ghi chú, ảnh bìa trong thẻ)
//   không đổi và không có ảnh bìa ở phần đầu trang; payload công khai không bị đổi hay nhận thêm khóa nào.
// - Invariant cần giữ: dữ liệu người học đi qua prop riêng, không đi qua `course`; cột trái không còn khối chuỗi ngày học.
// - Kết quả verify gần nhất: xem milestone FEAT3 CP2 / AC6a trong progress.md.

vi.mock("@/app/actions/public-course", () => ({ getPublicCourseDetail: vi.fn() }));
vi.mock("@/app/actions/learning-activity", () => ({ getCourseLearningSummary: vi.fn() }));
vi.mock("@/app/actions/payment", () => ({ createCheckoutSession: vi.fn() }));
vi.mock("@/app/actions/course-navigation", () => ({ getFirstTopicSlugByCourseSlug: vi.fn() }));
vi.mock("next/navigation", () => ({
  notFound: vi.fn(() => {
    throw new Error("NEXT_NOT_FOUND");
  }),
  useRouter: () => ({ refresh: vi.fn(), push: vi.fn() }),
}));
vi.mock("@/app/(client)/courses/_components/PublicCoursePaymentModal", () => ({ default: () => null }));
vi.mock("@/app/(client)/courses/_components/PublicCourseSyllabus", () => ({
  PublicCourseSyllabus: () => null,
}));

const mockedGetDetail = vi.mocked(getPublicCourseDetail);
const mockedGetSummary = vi.mocked(getCourseLearningSummary);
const COURSE_ID = "11111111-1111-4111-8111-111111111111";
const FIRST_TOPIC_ID = "55555555-5555-4555-8555-555555555555";
const COVER_ALT = "Ảnh bìa khóa học TOEIC nền tảng";
const COVER_PLACEHOLDER = "Chưa có ảnh bìa cho khóa học TOEIC nền tảng";

function detail(overrides: Partial<PublicCourseDetail> = {}): PublicCourseDetail {
  return {
    id: COURSE_ID,
    title: "TOEIC nền tảng",
    slug: "toeic-nen-tang",
    description: "Lộ trình TOEIC rõ ràng.",
    thumbnail_url: "https://example.com/toeic.webp",
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
    syllabus: [
      {
        id: "44444444-4444-4444-8444-444444444444",
        title: "Chương 1",
        order_index: 0,
        topics: [
          { id: FIRST_TOPIC_ID, title: "Chủ đề mở đầu", slug: "chu-de-mo-dau", order_index: 0, is_preview: true },
          { id: "66666666-6666-4666-8666-666666666666", title: "Chủ đề luyện tập", slug: "chu-de-luyen-tap", order_index: 1, is_preview: false },
          { id: "88888888-8888-4888-8888-888888888888", title: "Chủ đề nâng cao", slug: "chu-de-nang-cao", order_index: 2, is_preview: false },
        ],
      },
    ],
    is_enrolled: false,
    learner_progress: null,
    ...overrides,
  };
}

const enrolled = (overrides: Partial<PublicCourseDetail> = {}) =>
  detail({
    is_enrolled: true,
    learner_progress: { completed_topic_ids: [FIRST_TOPIC_ID], next_topic_slug: "chu-de-luyen-tap" },
    ...overrides,
  });

const topic = (index: number, daysAgo: number) => ({
  topicId: `d0d0d0d0-0000-4000-8000-00000000000${index}`,
  slug: `topic-${index}`,
  title: `Chủ đề gần đây ${index}`,
  lastActivityAt: "2026-03-11T01:04:00+00:00",
  daysAgo,
});

const okSummary = {
  success: true as const,
  data: { streak: 3, studiedToday: true, recentTopics: [topic(1, 0), topic(2, 1), topic(3, 4)] },
};

async function renderRoute() {
  return renderToStaticMarkup(await PublicCourseDetailRoute({ courseSlug: "toeic-nen-tang" }));
}

// Ba vùng của trang: phần đầu (header), thẻ bên phải (aside) và cột trái còn lại.
function regions(html: string) {
  const headerStart = html.indexOf("<header");
  const headerEnd = html.indexOf("</header>") + "</header>".length;
  const asideStart = html.indexOf("<aside");
  const asideEnd = html.indexOf("</aside>") + "</aside>".length;
  return {
    header: html.slice(headerStart, headerEnd),
    aside: html.slice(asideStart, asideEnd),
    leftColumn: html.slice(asideEnd),
  };
}

describe("FEAT3 AC6a enrolled learner card on the public course page", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("shows the learning card in order: streak, progress, continue button, recent topics, without price or cover", async () => {
    const course = enrolled();
    const before = structuredClone(course);
    mockedGetDetail.mockResolvedValue({ status: "success", data: course });
    mockedGetSummary.mockResolvedValue(okSummary);

    const { aside } = regions(await renderRoute());

    expect(mockedGetSummary).toHaveBeenCalledExactlyOnceWith(COURSE_ID);
    const order = [
      "Chuỗi 3 ngày học khóa này",
      "Đã xong 1/3 chủ đề",
      ">Tiếp tục: Chủ đề luyện tập</button>",
      "HỌC GẦN ĐÂY",
    ].map((text) => aside.indexOf(text));
    expect(order.every((index) => index >= 0)).toBe(true);
    expect([...order].sort((a, b) => a - b)).toEqual(order);
    expect(aside).toContain('href="/learn/toeic-nen-tang/topic-1"');
    expect(aside).toContain('href="/learn/toeic-nen-tang/topic-3"');
    expect(aside).toContain("Hôm qua");
    expect(aside).toContain("4 ngày trước");
    expect(aside).toContain('role="progressbar"');
    expect(aside).toContain('aria-valuenow="33"');
    expect(aside).not.toContain("250.000");
    expect(aside).not.toContain("Nội dung học chỉ mở sau khi");
    expect(aside).not.toContain("Bắt đầu khóa học");
    expect(aside).not.toContain(COVER_ALT);
    expect(aside).not.toContain("Ảnh bìa");
    expect(course).toEqual(before);
  });

  it("labels the button 'Xem tổng quan khóa học' when there is no next topic and keeps progress counted from the visible topics", async () => {
    mockedGetDetail.mockResolvedValue({
      status: "success",
      data: enrolled({
        learner_progress: {
          completed_topic_ids: [FIRST_TOPIC_ID, "66666666-6666-4666-8666-666666666666", "88888888-8888-4888-8888-888888888888"],
          next_topic_slug: null,
        },
      }),
    });
    mockedGetSummary.mockResolvedValue(okSummary);

    const { aside } = regions(await renderRoute());

    expect(aside).toContain(">Xem tổng quan khóa học</button>");
    expect(aside).not.toContain("Tiếp tục:");
    expect(aside).toContain("Đã xong 3/3 chủ đề");
    expect(aside).toContain('aria-valuenow="100"');
  });

  it("ignores completed ids that are not visible topics when counting progress", async () => {
    mockedGetDetail.mockResolvedValue({
      status: "success",
      data: enrolled({
        learner_progress: {
          completed_topic_ids: [FIRST_TOPIC_ID, "99999999-9999-4999-8999-999999999999"],
          next_topic_slug: "chu-de-luyen-tap",
        },
      }),
    });
    mockedGetSummary.mockResolvedValue(okSummary);

    const { aside } = regions(await renderRoute());

    expect(aside).toContain("Đã xong 1/3 chủ đề");
  });

  it("keeps progress and the button and shows the quiet unavailable state in place of streak and recent topics", async () => {
    mockedGetDetail.mockResolvedValue({ status: "success", data: enrolled() });
    mockedGetSummary.mockResolvedValue({ success: false, error: "Không thể tải chuỗi ngày học lúc này." });

    const html = await renderRoute();
    const { aside } = regions(html);

    expect(html).toContain("TOEIC nền tảng");
    expect(aside).toContain("Chưa tải được chuỗi ngày học của khóa này");
    expect(aside).toContain('role="status"');
    expect(aside).not.toContain("HỌC GẦN ĐÂY");
    expect(aside).toContain("Đã xong 1/3 chủ đề");
    expect(aside).toContain(">Tiếp tục: Chủ đề luyện tập</button>");
    expect(html).not.toContain('role="alert"');
  });

  it("puts the cover in the header only, below the title, and leaves no learning-activity block in the left column", async () => {
    mockedGetDetail.mockResolvedValue({ status: "success", data: enrolled() });
    mockedGetSummary.mockResolvedValue(okSummary);

    const { header, leftColumn } = regions(await renderRoute());

    expect(header).toContain(COVER_ALT);
    expect(header.indexOf("TOEIC nền tảng")).toBeLessThan(header.indexOf(COVER_ALT));
    expect(header.indexOf(COVER_ALT)).toBeLessThan(header.indexOf("Lộ trình TOEIC rõ ràng."));
    expect(leftColumn).not.toContain("ngày học khóa này");
    expect(leftColumn).not.toContain("HỌC GẦN ĐÂY");
    expect(leftColumn).not.toContain("course-learning-activity-title");
    expect(leftColumn).not.toContain("Chưa tải được chuỗi ngày học");
  });

  it("shows the cover placeholder in the header for an enrolled learner when the course has no cover", async () => {
    mockedGetDetail.mockResolvedValue({ status: "success", data: enrolled({ thumbnail_url: null }) });
    mockedGetSummary.mockResolvedValue(okSummary);

    const { header, aside } = regions(await renderRoute());

    expect(header).toContain(COVER_PLACEHOLDER);
    expect(aside).not.toContain("Chưa có ảnh bìa");
  });
});

describe("FEAT3 public course page for guests and not-enrolled visitors", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("keeps the sales card with price, access note and the cover inside the card, and reads nothing", async () => {
    const visitor = detail();
    const before = structuredClone(visitor);
    mockedGetDetail.mockResolvedValue({ status: "success", data: visitor });

    const { header, aside, leftColumn } = regions(await renderRoute());

    expect(mockedGetSummary).not.toHaveBeenCalled();
    expect(aside).toContain("Bắt đầu khóa học");
    expect(aside).toContain("250.000");
    expect(aside).toContain(">Đăng ký khóa học</button>");
    expect(aside).toContain("Nội dung học chỉ mở sau khi");
    expect(aside).toContain(COVER_ALT);
    expect(aside.indexOf(COVER_ALT)).toBeLessThan(aside.indexOf("Bắt đầu khóa học"));
    expect(header).not.toContain(COVER_ALT);
    expect(header).not.toContain("Chưa có ảnh bìa");
    for (const region of [aside, leftColumn]) {
      expect(region).not.toContain("ngày học khóa này");
      expect(region).not.toContain("HỌC GẦN ĐÂY");
      expect(region).not.toContain("Đã xong");
    }
    expect(visitor).toEqual(before);
    expect(Object.keys(visitor)).not.toContain("learning_summary");
  });

  it("keeps the free-course sales card and the cover placeholder inside the card", async () => {
    mockedGetDetail.mockResolvedValue({ status: "success", data: detail({ price: 0, thumbnail_url: null }) });

    const { header, aside } = regions(await renderRoute());

    expect(aside).toContain("Miễn phí");
    expect(aside).toContain(">Đăng ký miễn phí</button>");
    expect(aside).toContain(COVER_PLACEHOLDER);
    expect(header).not.toContain(COVER_PLACEHOLDER);
  });

  it("does not read the summary when the public detail itself failed", async () => {
    mockedGetDetail.mockResolvedValue({ status: "error", error: "internal" });

    const html = await renderRoute();

    expect(mockedGetSummary).not.toHaveBeenCalled();
    expect(html).toContain("Chưa thể tải thông tin khóa học");
  });
});
