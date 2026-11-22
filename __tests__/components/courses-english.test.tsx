// @vitest-environment jsdom

import { cleanup, fireEvent, render, renderToStaticMarkup, screen, waitFor } from "@/__tests__/support/intl";
import { setServerTestLocale } from "@/__tests__/support/i18n-request";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { getCourseLearningSummary } from "@/app/actions/learning-activity";
import { getPublicCourseCatalogListing, getPublicCourseDetail } from "@/app/actions/public-course";
import CoursesPage, { generateMetadata as coursesMetadata } from "@/app/(client)/courses/page";
import { generateMetadata as detailMetadata } from "@/app/(client)/courses/[course-slug]/page";
import { PublicCourseDetailRoute } from "@/app/(client)/courses/_components/PublicCourseDetailRoute";
import { PublicCoursePreviewExperience } from "@/app/(client)/courses/[course-slug]/preview/[topic-slug]/_components/PublicCoursePreviewExperience";
import { PublicCoursePreviewUnavailable } from "@/app/(client)/courses/[course-slug]/preview/[topic-slug]/_components/PublicCoursePreviewUnavailable";
import PublicCourseDetailLoading from "@/app/(client)/courses/[course-slug]/loading";
import CourseLearningActivity, {
  CourseStreakLine,
  RecentTopicsList,
} from "@/components/learning-activity/CourseLearningActivity";
import { formatRelativeDay, translateRelativeDay } from "@/lib/learning-activity-format";
import { asTranslate, staticTranslate } from "@/lib/i18n/translate";
import { viLearningText } from "@/lib/i18n/learning-text";
import enLearning from "@/messages/en/learning.json";
import type { PublicCourseDetail, PublicCourseCatalogListingItem } from "@/lib/schemas/public-course";
import type { PublicCoursePreview } from "@/lib/schemas/public-course-preview";

// Test plan:
// - Mục tiêu: English localization U2 CP3 — /courses, trang chi tiết khóa học, trang xem thử và các thành phần học tập dùng chung hiện
//   tiếng Anh khi ngôn ngữ là `en`; U3 (người gọi không truyền `t`) vẫn nhận tiếng Việt nguyên văn (H7). Assertion tiếng Việt của
//   test hiện có không đổi; file này chỉ thêm bản tiếng Anh.
// - Loại: component render trong jsdom với provider dùng chung (`__tests__/support/intl`); hàm async phía server gọi trực tiếp với
//   `setServerTestLocale`. Dữ liệu khóa học dùng tên tiếng Anh nên mọi chữ có dấu còn lại trong HTML là lỗi dịch.
// - Case: hero + số liệu, trang đầu và phân trang, trạng thái trống/lỗi/không có kết quả, metadata, chi tiết (khách và học viên đã ghi
//   danh gồm thẻ hoạt động), xem thử (bộ điều hướng câu hỏi, phản hồi đáp án, không khả dụng), helper ngày tương đối.
// - Giới hạn: cấu hình namespace thật của provider lồng nhau (`courses`, `learning`, `flashcard` ở courses/layout.tsx) chỉ được chứng
//   minh bằng build thật (H2); helper này cấp mọi namespace.

const mocks = vi.hoisted(() => ({
  answer: vi.fn(),
  getPreview: vi.fn(),
  getFirstTopic: vi.fn(),
  push: vi.fn(),
  refresh: vi.fn(),
}));

vi.mock("@/app/actions/public-course", () => ({
  getPublicCourseCatalogListing: vi.fn(),
  getPublicCourseDetail: vi.fn(),
}));
vi.mock("@/app/actions/learning-activity", () => ({ getCourseLearningSummary: vi.fn() }));
vi.mock("@/app/actions/payment", () => ({ createCheckoutSession: vi.fn() }));
vi.mock("@/app/actions/public-course-preview", () => ({
  answerPublicCoursePreviewQuestion: mocks.answer,
  getPublicCoursePreview: mocks.getPreview,
}));
vi.mock("@/app/actions/course-navigation", () => ({ getFirstTopicSlugByCourseSlug: mocks.getFirstTopic }));
vi.mock("next/navigation", () => ({
  notFound: vi.fn(() => {
    throw new Error("NEXT_NOT_FOUND");
  }),
  redirect: vi.fn((url: string) => {
    throw new Error(`NEXT_REDIRECT ${url}`);
  }),
  useRouter: () => ({ push: mocks.push, refresh: mocks.refresh }),
  useSearchParams: () => new URLSearchParams(window.location.search),
}));
vi.mock("next/image", () => ({
  // eslint-disable-next-line @next/next/no-img-element
  default: ({ alt, src }: { alt: string; src: string }) => <img alt={alt} src={src} />,
}));
vi.mock("@/app/(client)/courses/_components/PublicCoursePaymentModal", () => ({ default: () => null }));

const mockedListing = vi.mocked(getPublicCourseCatalogListing);
const mockedDetail = vi.mocked(getPublicCourseDetail);
const mockedSummary = vi.mocked(getCourseLearningSummary);

const VIETNAMESE_DIACRITIC = /[̀-ͯ]/;
const hasVietnamese = (text: string) => VIETNAMESE_DIACRITIC.test(text.normalize("NFD").replace(/đ/gi, "d"));
const text = (html: string) => html.replace(/<!-- -->/g, "");

function listingItem(index: number, overrides: Partial<PublicCourseCatalogListingItem> = {}): PublicCourseCatalogListingItem {
  return {
    id: `00000000-0000-4000-8000-${String(index).padStart(12, "0")}`,
    title: `Course ${String(index).padStart(2, "0")}`,
    slug: `course-${index}`,
    thumbnail_url: null,
    price: index % 2 === 0 ? 0 : 120000,
    created_at: "2026-07-01T00:00:00.000Z",
    enrollment_count: 100 - index,
    recent_enrollment_count: 0,
    topic_count: 2,
    card_count: 20,
    preview_topic_slug: index % 3 === 0 ? `topic-${index}` : null,
    instructor_name: null,
    description_excerpt: null,
    ...overrides,
  };
}

const COURSE_ID = "11111111-1111-4111-8111-111111111111";
const FIRST_TOPIC_ID = "55555555-5555-4555-8555-555555555555";

function detail(overrides: Partial<PublicCourseDetail> = {}): PublicCourseDetail {
  return {
    id: COURSE_ID,
    title: "TOEIC foundations",
    slug: "toeic-foundations",
    description: "A clear TOEIC path for beginners.",
    thumbnail_url: "https://example.com/toeic.webp",
    price: 250000,
    created_at: "2026-07-10T10:00:00.000Z",
    enrollment_count: 1042,
    is_preview_suspended: false,
    owner: {
      id: "22222222-2222-4222-8222-222222222222",
      full_name: "Minh Anh",
      avatar_url: null,
      bio: null,
      experience_years: 7,
      certifications: null,
    },
    collaborators: [],
    syllabus: [
      {
        id: "44444444-4444-4444-8444-444444444444",
        title: "Getting started",
        order_index: 0,
        topics: [
          { id: FIRST_TOPIC_ID, title: "Opening topic", slug: "opening-topic", order_index: 0, is_preview: true },
          { id: "66666666-6666-4666-8666-666666666666", title: "Practice topic", slug: "practice-topic", order_index: 1, is_preview: false },
        ],
      },
      { id: "77777777-7777-4777-8777-777777777777", title: "Coming soon", order_index: 1, topics: [] },
    ],
    is_enrolled: false,
    learner_progress: null,
    ...overrides,
  };
}

const enrolled = (overrides: Partial<PublicCourseDetail> = {}) =>
  detail({
    is_enrolled: true,
    learner_progress: { completed_topic_ids: [FIRST_TOPIC_ID], next_topic_slug: "practice-topic" },
    ...overrides,
  });

const recent = (index: number, daysAgo: number) => ({
  topicId: `d0d0d0d0-0000-4000-8000-00000000000${index}`,
  slug: `recent-${index}`,
  title: `Recent topic ${index}`,
  lastActivityAt: "2026-03-11T01:04:00+00:00",
  daysAgo,
});

async function renderCatalog(search: Record<string, string> = {}) {
  return text(
    renderToStaticMarkup(await CoursesPage({ searchParams: Promise.resolve(search) }), { locale: "en" }),
  );
}

beforeEach(() => {
  setServerTestLocale("en");
  window.history.replaceState(null, "", "/courses");
  window.matchMedia = vi.fn().mockReturnValue({ matches: false, addEventListener: vi.fn(), removeEventListener: vi.fn() });
  Element.prototype.scrollIntoView = vi.fn();
});

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
  setServerTestLocale("vi");
});

describe("/courses in English", () => {
  it("shows the hero facts with English plurals, the first page and the pagination summary", async () => {
    mockedListing.mockResolvedValue({
      status: "success",
      data: { courses: Array.from({ length: 14 }, (_, index) => listingItem(index + 1)), enrolledCourseIds: [] },
    });

    const html = await renderCatalog();

    expect(html).toContain("Find the course that fits your goal");
    expect(html).toMatch(/<b[^>]*>14<\/b> courses/);
    expect(html).toMatch(/<b[^>]*>7<\/b> free courses/);
    expect(html).toContain("Showing 1–12 of 14 courses");
    expect(html).toContain('aria-label="View details of the Course 01 course"');
    expect(html).toContain("99 learners");
    expect(html).toContain("₫");
    expect(hasVietnamese(html)).toBe(false);
  });

  it("uses the singular for exactly one of a count", async () => {
    mockedListing.mockResolvedValue({
      status: "success",
      data: { courses: [listingItem(1, { enrollment_count: 1, topic_count: 1, card_count: 1 })], enrolledCourseIds: [] },
    });

    const html = await renderCatalog();

    expect(html).toMatch(/<b[^>]*>1<\/b> course\b/);
    expect(html).toContain("1 learner<");
    expect(html).toContain("1 topic<");
    expect(html).toContain("1 vocabulary card<");
  });

  it("renders the empty and error states in English and keeps the safe error out of the page", async () => {
    mockedListing.mockResolvedValueOnce({ status: "success", data: { courses: [], enrolledCourseIds: [] } });
    const emptyHtml = await renderCatalog();
    mockedListing.mockResolvedValueOnce({ status: "error", error: "safe public error" });
    const errorHtml = await renderCatalog();

    expect(emptyHtml).toContain("No courses are public yet");
    expect(emptyHtml).toContain("Back to home");
    expect(errorHtml).toContain("Couldn&#x27;t load the course list");
    expect(errorHtml).toContain(">Try again</button>");
    expect(errorHtml).not.toContain("safe public error");
    expect(hasVietnamese(emptyHtml)).toBe(false);
    expect(hasVietnamese(errorHtml)).toBe(false);
  });

  it("keeps URL parameters Vietnamese and canonical while the labels are English", async () => {
    mockedListing.mockResolvedValue({
      status: "success",
      data: { courses: Array.from({ length: 14 }, (_, index) => listingItem(index + 1)), enrolledCourseIds: [] },
    });

    await expect(renderCatalog({ trang: "9", "sap-xep": "bogus", gia: "free" })).rejects.toThrow(
      "NEXT_REDIRECT /courses?gia=free",
    );
  });

  it("shows the no-results state with English chips and suggestions when the URL filters match nothing", async () => {
    window.history.replaceState(null, "", "/courses?q=zzzz&gia=paid");
    mockedListing.mockResolvedValue({
      status: "success",
      data: { courses: Array.from({ length: 14 }, (_, index) => listingItem(index + 1)), enrolledCourseIds: [] },
    });
    const view = render(
      (await CoursesPage({ searchParams: Promise.resolve({ q: "zzzz", gia: "paid" }) })) as React.ReactElement,
      { locale: "en" },
    );

    expect(await screen.findByText(/No courses matching/)).toBeTruthy();
    expect(screen.getByRole("button", { name: "Clear all filters" })).toBeTruthy();
    expect(screen.getByRole("search")).toBeTruthy();
    expect(screen.getByLabelText("Search courses by name")).toBeTruthy();
    expect(hasVietnamese(view.container.textContent ?? "")).toBe(false);
  });

  it("translates the page metadata", async () => {
    const metadata = await coursesMetadata();

    expect(metadata.title).toBe("Courses | VocaSpace");
    expect(metadata.description).toBe("Explore every public course on VocaSpace.");
  });
});

describe("course detail in English", () => {
  const route = async () =>
    text(renderToStaticMarkup(await PublicCourseDetailRoute({ courseSlug: "toeic-foundations" }), { locale: "en" }));

  it("shows the guest page in English: price, enrollment card, stats and syllabus", async () => {
    mockedDetail.mockResolvedValue({ status: "success", data: detail() });

    const html = await route();

    expect(html).toContain("Start the course");
    expect(html).toContain("Enroll in the course");
    expect(html).toContain("Course syllabus");
    expect(html).toContain("Chapter 1");
    expect(html).toContain("Preview this lesson");
    expect(html).toContain("1,042");
    expect(html).toContain("7 years of experience");
    expect(html).toContain("Cover image of the TOEIC foundations course");
    expect(mockedSummary).not.toHaveBeenCalled();
    expect(hasVietnamese(html)).toBe(false);
  });

  it("shows the free price label and the enrolled card with streak, progress and recent topics in English", async () => {
    mockedDetail.mockResolvedValueOnce({ status: "success", data: detail({ price: 0 }) });
    const freeHtml = await route();
    mockedDetail.mockResolvedValueOnce({ status: "success", data: enrolled() });
    mockedSummary.mockResolvedValue({
      success: true,
      data: { streak: 3, studiedToday: true, recentTopics: [recent(1, 0), recent(2, 1), recent(3, 4)] },
    });
    const learningHtml = await route();

    expect(freeHtml).toContain("Enroll for free");
    expect(freeHtml).toContain("Free");
    expect(learningHtml).toContain("You&#x27;re studying this course");
    expect(learningHtml).toContain("Continue: Practice topic");
    expect(learningHtml).toContain("1/2 topics done");
    expect(learningHtml).toContain("3 days studying this course in a row");
    expect(learningHtml).toContain("You studied this course today.");
    expect(learningHtml).toContain("Today");
    expect(learningHtml).toContain("Yesterday");
    expect(learningHtml).toContain("4 days ago");
    expect(hasVietnamese(learningHtml)).toBe(false);
  });

  it("shows the quiet unavailable activity state in English and the error page when the course fails to load", async () => {
    mockedDetail.mockResolvedValueOnce({ status: "success", data: enrolled() });
    mockedSummary.mockResolvedValue({ success: false, error: "x" } as never);
    const quiet = await route();
    mockedDetail.mockResolvedValueOnce({ status: "error", error: "safe" });
    const failed = await route();

    expect(quiet).toContain("Couldn&#x27;t load this course&#x27;s study streak");
    expect(failed).toContain("Couldn&#x27;t load the course");
    expect(failed).toContain(">Try again</button>");
    expect(hasVietnamese(quiet + failed)).toBe(false);
  });

  it("translates the detail metadata and the loading skeleton", async () => {
    mockedDetail.mockResolvedValue({ status: "success", data: detail({ description: "" }) });
    const metadata = await detailMetadata({ params: Promise.resolve({ "course-slug": "toeic-foundations" }) });
    const loading = renderToStaticMarkup(<PublicCourseDetailLoading />, { locale: "en" });

    expect(metadata.title).toBe("TOEIC foundations | VocaSpace");
    expect(metadata.description).toBe("Explore the TOEIC foundations course on VocaSpace.");
    expect(loading).toContain("Loading the course");
    expect(hasVietnamese(loading)).toBe(false);
  });
});

describe("course preview in English", () => {
  const questionId = "55555555-5555-4555-8555-555555555555";
  const optionId = "66666666-6666-4666-8666-666666666666";

  function preview(): PublicCoursePreview {
    return {
      course: { slug: "toeic-foundations", title: "TOEIC foundations" },
      topic: {
        id: "11111111-1111-4111-8111-111111111111",
        slug: "opening-topic",
        title: "Opening topic",
        description: "A short preview.",
      },
      flashcards: [],
      exercises: [
        {
          id: "33333333-3333-4333-8333-333333333333",
          title: "Practice set",
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
                  content: "Choose the correct answer.",
                  order_index: 0,
                  options: [
                    { id: optionId, content: "Option A", label: "A", order_index: 0 },
                    { id: "99999999-9999-4999-8999-999999999999", content: "Option B", label: "B", order_index: 1 },
                  ],
                },
              ],
            },
          ],
        },
      ],
    };
  }

  it("names the question list and gives answer feedback in English", async () => {
    mocks.answer.mockResolvedValue({ status: "success", data: { isCorrect: true, explanation: "Because." } });
    const view = render(
      <PublicCoursePreviewExperience data={preview()} isEnrolled={false} returnToCourseHref="/courses/toeic-foundations" />,
      { locale: "en" },
    );

    expect(screen.getByText("Preview · Progress isn't saved")).toBeTruthy();
    expect(screen.getByRole("button", { name: /Question list/ })).toBeTruthy();
    fireEvent.click(screen.getByRole("radio", { name: "Option A" }));
    fireEvent.click(screen.getByRole("button", { name: "Confirm answer" }));

    expect(await screen.findByText("Correct!")).toBeTruthy();
    expect(screen.getByText("Because.")).toBeTruthy();
    expect(hasVietnamese(view.container.textContent ?? "")).toBe(false);
  });

  it("shows a translated retry error when the answer cannot be checked", async () => {
    mocks.answer.mockResolvedValue({ status: "error", error: "Couldn't check your answer right now. Please try again." });
    render(
      <PublicCoursePreviewExperience data={preview()} isEnrolled={false} returnToCourseHref="/courses/toeic-foundations" />,
      { locale: "en" },
    );

    fireEvent.click(screen.getByRole("radio", { name: "Option A" }));
    fireEvent.click(screen.getByRole("button", { name: "Confirm answer" }));

    await waitFor(() => expect(screen.getByRole("alert").textContent).toContain("Couldn't check your answer"));
  });

  it("renders the unavailable and error screens in English", () => {
    const unavailable = renderToStaticMarkup(
      <PublicCoursePreviewUnavailable kind="unavailable" returnToCourseHref="/courses/toeic-foundations" />,
      { locale: "en" },
    );
    const failed = renderToStaticMarkup(
      <PublicCoursePreviewUnavailable kind="error" returnToCourseHref="/courses/toeic-foundations" />,
      { locale: "en" },
    );

    expect(unavailable).toContain("The preview isn&#x27;t available right now");
    expect(unavailable).toContain("Back to the course");
    expect(failed).toContain("Couldn&#x27;t load the preview");
    expect(failed).toContain(">Try again</button>");
    expect(hasVietnamese(unavailable + failed)).toBe(false);
  });
});

describe("shared learning components keep U3 callers in Vietnamese (H7)", () => {
  const data = { streak: 3, studiedToday: false, recentTopics: [recent(1, 0)] };

  it("renders Vietnamese by default even inside an English provider", () => {
    const html = renderToStaticMarkup(
      <CourseLearningActivity result={{ success: true, data }} courseSlug="toeic" />,
      { locale: "en" },
    );

    expect(html).toContain("Hôm nay");
    expect(html).not.toContain("Today");
    expect(hasVietnamese(html)).toBe(true);
  });

  it("renders English when the U2 caller passes the translator", () => {
    const t = asTranslate(staticTranslate("learning", enLearning));
    const html = renderToStaticMarkup(
      <>
        <CourseStreakLine data={data} t={t} />
        <RecentTopicsList courseSlug="toeic" topics={data.recentTopics} t={t} />
      </>,
      { locale: "en" },
    );

    expect(html).toContain("3 days studying this course in a row");
    expect(html).toContain("Today");
    expect(hasVietnamese(html.replace("Recent topic 1", ""))).toBe(false);
  });

  it("formats a relative day the same as before in Vietnamese and in English through the translator", () => {
    expect([0, 1, 2, 9].map((days) => formatRelativeDay(days))).toEqual(["Hôm nay", "Hôm qua", "2 ngày trước", "9 ngày trước"]);
    expect([0, 1, 2, 9].map((days) => translateRelativeDay(days, viLearningText))).toEqual([
      "Hôm nay",
      "Hôm qua",
      "2 ngày trước",
      "9 ngày trước",
    ]);
    const en = asTranslate(staticTranslate("learning", enLearning));
    expect([0, 1, 2, 9].map((days) => translateRelativeDay(days, en))).toEqual(["Today", "Yesterday", "2 days ago", "9 days ago"]);
  });
});
