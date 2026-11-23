import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { Rating } from "ts-fsrs";
import { getLearnDashboard } from "@/app/actions/learn-dashboard";
import { getCourseLearningSummary, getLearningSummary } from "@/app/actions/learning-activity";
import { getDeckReviewCards } from "@/app/actions/profile";
import { submitCardReview } from "@/app/actions/review";
import { submitCardReviewLocalized } from "@/app/actions/review-localized";
import { getDeckReviewCardsLocalized } from "@/app/actions/review-deck-localized";
import { setServerTestLocale } from "@/__tests__/support/i18n-request";
import type { Locale } from "@/lib/i18n/config";
import { createClient } from "@/utils/supabase/server";

// Test plan:
// - Mục tiêu: English localization U3 AC3 (CP1) - mọi đường trả message của getLearnDashboard, getLearningSummary,
//   getCourseLearningSummary (dùng chung thông báo "chưa tải được"), getDeckReviewCards và submitCardReview trả đúng câu đã dịch
//   theo ngôn ngữ của request; tiếng Việt đúng nguyên văn cũ; hình dạng kết quả, mã lỗi và việc trả về trước mọi truy vấn giữ nguyên.
// - Loại test: Server Action với next-intl thật (cấu hình request bản test chọn ngôn ngữ); Supabase bị mock.
// - Đối tượng: getLearnDashboard, getLearningSummary, getCourseLearningSummary, getDeckReviewCards, submitCardReview và hai wrapper
//   `*Localized` (ngôn ngữ của server + khóa catalog từng trường).
// - Case chính: từng message ở vi (nguyên văn cũ) và en; wrapper trả khóa riêng cho `error` và `progressError`, và chỉ trường mà kết
//   quả thật sự trả mới có khóa.
// - Giới hạn: không kiểm DB thật; các integration lf2-* giữ phần đó. Đường nhánh lỗi RPC/mutation của submitCardReview dùng chung một
//   thông báo nên chỉ kiểm một đường đại diện.

vi.mock("server-only", () => ({}));
vi.mock("@/utils/supabase/server", () => ({ createClient: vi.fn() }));
vi.mock("@/lib/supabase/service-role", () => ({ createServiceRoleClient: vi.fn() }));

const mockedCreateClient = vi.mocked(createClient);

const LOCALES: Locale[] = ["vi", "en"];
const ids = {
  user: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
  course: "11111111-1111-4111-8111-111111111111",
  chapter: "22222222-2222-4222-8222-222222222222",
  topic: "33333333-3333-4333-8333-333333333333",
  card: "44444444-4444-4444-8444-444444444444",
};

const TEXT = {
  dashAuth: { vi: "Vui lòng đăng nhập để xem dashboard học tập.", en: "Please sign in to view your learning dashboard." },
  dashQuery: { vi: "Không thể tải dashboard học tập lúc này.", en: "Couldn't load the learning dashboard right now." },
  dashInvalid: { vi: "Dữ liệu dashboard học tập không hợp lệ.", en: "The learning dashboard data is invalid." },
  summary: { vi: "Không thể tải chuỗi ngày học lúc này.", en: "Couldn't load your learning streak right now." },
  deckAuth: { vi: "Vui lòng đăng nhập để tiếp tục ôn tập.", en: "Please sign in to keep reviewing." },
  deckLoad: { vi: "Không thể tải ngữ liệu thẻ ôn tập lúc này.", en: "Couldn't load the review card data right now." },
  deckQueue: { vi: "Hệ thống gặp sự cố khi tổng hợp hàng đợi ôn tập.", en: "Something went wrong while building the review queue." },
  reviewInvalid: { vi: "Dữ liệu đánh giá thẻ không hợp lệ.", en: "The card rating data is invalid." },
  reviewAuth: { vi: "Vui lòng đăng nhập", en: "Please sign in" },
  reviewContext: { vi: "Không thể kiểm tra thẻ ôn tập lúc này.", en: "Couldn't check the review card right now." },
  reviewUnavailable: { vi: "Thẻ ôn tập không khả dụng.", en: "This review card isn't available." },
  reviewEnroll: { vi: "Bạn cần ghi danh khóa học để lưu ôn tập.", en: "You need to enroll in the course to save your review." },
  reviewMeta: { vi: "Dữ liệu ôn tập hiện tại không hợp lệ.", en: "The current review data is invalid." },
  reviewSync: { vi: "Chưa thể đồng bộ tiến độ ôn tập.", en: "Couldn't sync your review progress." },
  reviewProgress: {
    vi: "Thẻ đã lưu nhưng chưa thể ghi nhận tiến độ bài học.",
    en: "The card was saved, but your lesson progress couldn't be recorded.",
  },
} as const;

function query(data: unknown[] = [], error: unknown = null) {
  const q: Record<string, unknown> = {};
  let from = 0;
  let to = Number.MAX_SAFE_INTEGER;
  for (const method of ["select", "eq", "in", "is", "order", "lte", "limit"]) q[method] = vi.fn(() => q);
  q.range = vi.fn((a: number, b: number) => {
    from = a;
    to = b;
    return q;
  });
  q.then = (resolve: (value: unknown) => unknown, reject: (reason: unknown) => unknown) =>
    Promise.resolve({ data: error ? [] : data.slice(from, to + 1), error }).then(resolve, reject);
  return q;
}

function supabaseWith(
  tables: Record<string, unknown>,
  user: { id: string } | null = { id: ids.user },
  rpc: unknown = vi.fn(),
) {
  const from = vi.fn((table: string) => {
    if (!(table in tables)) throw new Error(`Unexpected table ${table}`);
    return tables[table];
  });
  mockedCreateClient.mockResolvedValue({
    auth: { getUser: vi.fn().mockResolvedValue({ data: { user }, error: null }) },
    from,
    rpc,
  } as never);
  return from;
}

describe.each(LOCALES)("learn actions in %s", (locale) => {
  const text = (key: keyof typeof TEXT) => TEXT[key][locale];

  beforeEach(() => {
    vi.clearAllMocks();
    setServerTestLocale(locale);
    vi.spyOn(console, "error").mockImplementation(() => undefined);
  });
  afterEach(() => {
    vi.restoreAllMocks();
    setServerTestLocale("vi");
  });

  describe("getLearnDashboard", () => {
    it("asks an unauthenticated learner to sign in before any query", async () => {
      const from = supabaseWith({}, null);
      await expect(getLearnDashboard()).resolves.toEqual({ success: false, errorCode: "AUTH_REQUIRED", error: text("dashAuth") });
      expect(from).not.toHaveBeenCalled();
    });

    it("keeps QUERY_FAILED with a translated message when a primary query fails", async () => {
      supabaseWith({ enrollments: query([], { message: "boom" }), user_flashcards: query(), payments: query() });
      await expect(getLearnDashboard()).resolves.toEqual({ success: false, errorCode: "QUERY_FAILED", error: text("dashQuery") });
    });

    it("keeps INVALID_DATA with a translated message for malformed aggregated output", async () => {
      supabaseWith({
        enrollments: query([
          { id: "e1", course_id: "c1", course: { id: "c1", title: "", slug: "s", thumbnail_url: null, status: "published", removed_at: null } },
        ]),
        user_flashcards: query(),
        payments: query(),
        chapters: query(),
      });
      await expect(getLearnDashboard()).resolves.toEqual({ success: false, errorCode: "INVALID_DATA", error: text("dashInvalid") });
    });
  });

  describe("learning summary", () => {
    it("translates the unavailable message of both summary actions on every failure path", async () => {
      mockedCreateClient.mockResolvedValue({ rpc: vi.fn(async () => ({ data: null, error: { message: "x" } })) } as never);
      await expect(getLearningSummary()).resolves.toEqual({ success: false, error: text("summary") });
      await expect(getCourseLearningSummary(ids.course)).resolves.toEqual({ success: false, error: text("summary") });

      mockedCreateClient.mockRejectedValue(new Error("network"));
      await expect(getLearningSummary()).resolves.toEqual({ success: false, error: text("summary") });

      const rpc = vi.fn();
      mockedCreateClient.mockResolvedValue({ rpc } as never);
      await expect(getCourseLearningSummary("not-a-uuid")).resolves.toEqual({ success: false, error: text("summary") });
      expect(rpc).not.toHaveBeenCalled();
    });
  });

  describe("getDeckReviewCards", () => {
    it("asks an unauthenticated learner to sign in before any query", async () => {
      const from = supabaseWith({}, null);
      await expect(getDeckReviewCards()).resolves.toEqual({ error: text("deckAuth") });
      expect(from).not.toHaveBeenCalled();
    });

    it("translates the load failure of the metadata and of the card query", async () => {
      supabaseWith({ user_flashcards: query([], { message: "boom" }) });
      await expect(getDeckReviewCards()).resolves.toEqual({ error: text("deckLoad") });

      const metaOk = query([]);
      const cardsFail = query([], { message: "boom" });
      let calls = 0;
      supabaseWith({});
      mockedCreateClient.mockResolvedValue({
        auth: { getUser: vi.fn().mockResolvedValue({ data: { user: { id: ids.user } }, error: null }) },
        from: vi.fn(() => (calls++ === 0 ? metaOk : cardsFail)),
      } as never);
      await expect(getDeckReviewCards()).resolves.toEqual({ error: text("deckLoad") });
    });

    it("translates the unexpected failure message", async () => {
      mockedCreateClient.mockResolvedValue({
        auth: { getUser: vi.fn().mockResolvedValue({ data: { user: { id: ids.user } }, error: null }) },
        from: vi.fn(() => {
          throw new Error("boom");
        }),
      } as never);
      await expect(getDeckReviewCards()).resolves.toEqual({ error: text("deckQueue") });
    });
  });

  describe("submitCardReview", () => {
    const card = (overrides: Record<string, unknown> = {}) => ({
      id: ids.card,
      topic_id: ids.topic,
      removed_at: null,
      topic: {
        id: ids.topic,
        chapter_id: ids.chapter,
        course_id: ids.course,
        status: "published",
        removed_at: null,
        chapter: { id: ids.chapter, course_id: ids.course, removed_at: null },
        course: { id: ids.course, enrollments: [{ id: "en", user_id: ids.user }] },
      },
      user_flashcards: [],
      ...overrides,
    });
    const cardsQuery = (data: unknown, error: unknown = null) => {
      const q: Record<string, unknown> = {};
      for (const method of ["select", "eq", "is"]) q[method] = vi.fn(() => q);
      q.maybeSingle = vi.fn().mockResolvedValue({ data, error });
      return q;
    };

    it("rejects malformed input before creating a database client", async () => {
      await expect(submitCardReview("bad-id", Rating.Manual)).resolves.toEqual({ error: text("reviewInvalid") });
      expect(mockedCreateClient).not.toHaveBeenCalled();
    });

    it("asks for sign-in without a query or an RPC", async () => {
      const rpc = vi.fn();
      const from = supabaseWith({}, null, rpc);
      await expect(submitCardReview(ids.card, Rating.Good)).resolves.toEqual({ error: text("reviewAuth") });
      expect(from).not.toHaveBeenCalled();
      expect(rpc).not.toHaveBeenCalled();
    });

    it("translates a context query failure, an unavailable card and a missing enrollment", async () => {
      supabaseWith({ cards: cardsQuery(null, { message: "boom" }) });
      await expect(submitCardReview(ids.card, Rating.Good)).resolves.toEqual({ error: text("reviewContext") });

      supabaseWith({ cards: cardsQuery(null) });
      await expect(submitCardReview(ids.card, Rating.Good)).resolves.toEqual({ error: text("reviewUnavailable") });

      const enrollments = cardsQuery(null);
      supabaseWith({
        cards: cardsQuery(card({ topic: { ...card().topic, course: { id: ids.course, enrollments: [] } } })),
        enrollments,
      });
      await expect(submitCardReview(ids.card, Rating.Good)).resolves.toEqual({ error: text("reviewEnroll") });
    });

    it("translates invalid stored FSRS metadata and a failed mutation without calling the RPC for the first", async () => {
      const rpc = vi.fn();
      supabaseWith({ cards: cardsQuery(card({ user_flashcards: [{ id: "uf", user_id: ids.user, card_id: ids.card, fsrs_meta: { nope: true } }] })) }, { id: ids.user }, rpc);
      await expect(submitCardReview(ids.card, Rating.Good)).resolves.toEqual({ error: text("reviewMeta") });
      expect(rpc).not.toHaveBeenCalled();

      supabaseWith({ cards: cardsQuery(card()) }, { id: ids.user }, vi.fn().mockResolvedValue({ data: null, error: { message: "boom" } }));
      await expect(submitCardReview(ids.card, Rating.Good)).resolves.toEqual({ error: text("reviewSync") });
    });

    it("saves the review and translates the progress warning when progress cannot be recorded", async () => {
      supabaseWith({ cards: cardsQuery(card()) }, { id: ids.user }, vi.fn().mockResolvedValue({ data: { status: "ok", progress: { bad: true } }, error: null }));
      await expect(submitCardReview(ids.card, Rating.Good)).resolves.toEqual({ success: true, progressError: text("reviewProgress") });
    });
  });
});

describe("localized wrappers record one reference per field", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.spyOn(console, "error").mockImplementation(() => undefined);
  });
  afterEach(() => {
    vi.restoreAllMocks();
    setServerTestLocale("vi");
  });

  it("returns the server locale and the key of `error` for a failed review", async () => {
    setServerTestLocale("en");
    mockedCreateClient.mockResolvedValue({
      auth: { getUser: vi.fn().mockResolvedValue({ data: { user: null }, error: null }) },
    } as never);
    const { result, ...reply } = await submitCardReviewLocalized(ids.card, Rating.Good);
    expect(result).toEqual({ error: "Please sign in" });
    expect(reply).toEqual({ locale: "en", messageRefs: { error: { key: "learn.actions.review.authRequired" } } });
  });

  it("returns the key of `progressError` and no key for a field the result does not carry", async () => {
    setServerTestLocale("vi");
    const cardRow = {
      id: ids.card,
      topic_id: ids.topic,
      removed_at: null,
      topic: {
        id: ids.topic,
        chapter_id: ids.chapter,
        course_id: ids.course,
        status: "published",
        removed_at: null,
        chapter: { id: ids.chapter, course_id: ids.course, removed_at: null },
        course: { id: ids.course, enrollments: [{ id: "en", user_id: ids.user }] },
      },
      user_flashcards: [],
    };
    const q: Record<string, unknown> = {};
    for (const method of ["select", "eq", "is"]) q[method] = vi.fn(() => q);
    q.maybeSingle = vi.fn().mockResolvedValue({ data: cardRow, error: null });
    mockedCreateClient.mockResolvedValue({
      auth: { getUser: vi.fn().mockResolvedValue({ data: { user: { id: ids.user } }, error: null }) },
      from: vi.fn(() => q),
      rpc: vi.fn().mockResolvedValue({ data: { status: "ok", progress: { bad: true } }, error: null }),
    } as never);
    const { result, ...reply } = await submitCardReviewLocalized(ids.card, Rating.Good);
    expect(result).toEqual({ success: true, progressError: "Thẻ đã lưu nhưng chưa thể ghi nhận tiến độ bài học." });
    expect(reply).toEqual({ locale: "vi", messageRefs: { progressError: { key: "learn.actions.review.progressSync" } } });
  });

  it("returns the key of `error` for the deck loader and none for a successful result", async () => {
    setServerTestLocale("en");
    mockedCreateClient.mockResolvedValue({
      auth: { getUser: vi.fn().mockResolvedValue({ data: { user: null }, error: null }) },
    } as never);
    const failed = await getDeckReviewCardsLocalized();
    expect(failed.messageRefs).toEqual({ error: { key: "learn.actions.deck.authRequired" } });

    mockedCreateClient.mockResolvedValue({
      auth: { getUser: vi.fn().mockResolvedValue({ data: { user: { id: ids.user } }, error: null }) },
      from: vi.fn(() => query([])),
    } as never);
    const ok = await getDeckReviewCardsLocalized();
    expect(ok.result).toMatchObject({ success: true });
    expect(ok.messageRefs).toEqual({});
  });
});
