import { beforeEach, describe, expect, it, vi } from "vitest";
import { getCourseLearningSummary, getLearningSummary } from "@/app/actions/learning-activity";
import { createClient } from "@/utils/supabase/server";

// Test plan:
// - Mục tiêu: FEAT3 CP2 - hai Server Action đọc tóm tắt chuỗi ngày học chỉ qua RPC `feat3_learning_summary`, parse bằng Zod và
//   không bao giờ throw, để không trang nào bị chặn bởi khối này (AC10).
// - Loại test: Server Action với Supabase boundary mock (RPC). Quy tắc streak, ngày, tuần và quyền đọc được kiểm bằng DB thật ở
//   `__tests__/integration/feat3-learning-activity.test.ts`.
// - Đối tượng: getLearningSummary, getCourseLearningSummary.
// - Case thành công: JSON snake_case của RPC thành dữ liệu camelCase (tổng thể: streak, 7 ngày, phút tuần; khóa học: streak, tối đa 3 chủ đề).
// - Case thất bại: RPC lỗi (ví dụ chưa có hàm trên DB chưa migrate), trả null (chưa đăng nhập), JSON sai hình dạng, hơn 3 chủ đề,
//   Supabase client ném lỗi: đều thành `{ success: false }` và không throw; courseId không phải uuid không gọi RPC.
// - Bảo mật/phân quyền: action chỉ gửi `p_course_id` đã parse (hoặc không gửi gì), không bao giờ gửi user id; chỉ gọi RPC, không đọc bảng nào.
// - Invariant cần giữ: một lần gọi RPC cho mỗi lần đọc; lỗi không rò chi tiết DB ra kết quả.
// - Kết quả verify gần nhất: xem milestone FEAT3 CP2 trong progress.md.

vi.mock("@/utils/supabase/server", () => ({ createClient: vi.fn() }));

const mockedCreateClient = vi.mocked(createClient);
const COURSE_ID = "c0c0c0c0-0000-4000-8000-000000000001";

const overallRaw = {
  streak: 3,
  studied_today: false,
  days: Array.from({ length: 7 }, (_, index) => ({ date: `2026-03-${String(index + 5).padStart(2, "0")}`, studied: index >= 3 })),
  week_study_minutes: 85,
};
const topicRaw = (index: number) => ({
  topic_id: `d0d0d0d0-0000-4000-8000-00000000000${index}`,
  slug: `topic-${index}`,
  title: `Chủ đề ${index}`,
  last_activity_at: "2026-03-11T01:04:00+00:00",
  days_ago: index,
});
const courseRaw = { streak: 2, studied_today: true, recent_topics: [topicRaw(1)] };

function useRpc(result: { data?: unknown; error?: unknown } | Error) {
  const rpc = vi.fn(async () => {
    if (result instanceof Error) throw result;
    return { data: result.data ?? null, error: result.error ?? null };
  });
  const from = vi.fn();
  mockedCreateClient.mockResolvedValue({ rpc, from } as never);
  return { rpc, from };
}

describe("FEAT3 learning summary actions", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.spyOn(console, "error").mockImplementation(() => undefined);
  });

  it("returns the overall summary as camelCase from one argument-less RPC call", async () => {
    const { rpc, from } = useRpc({ data: overallRaw });

    await expect(getLearningSummary()).resolves.toEqual({
      success: true,
      data: {
        streak: 3,
        studiedToday: false,
        days: overallRaw.days,
        weekStudyMinutes: 85,
      },
    });
    expect(rpc).toHaveBeenCalledExactlyOnceWith("feat3_learning_summary", {});
    expect(from).not.toHaveBeenCalled();
  });

  it("returns a course summary with its recent topics and sends only the parsed course id", async () => {
    const { rpc } = useRpc({ data: courseRaw });

    await expect(getCourseLearningSummary(COURSE_ID)).resolves.toEqual({
      success: true,
      data: {
        streak: 2,
        studiedToday: true,
        recentTopics: [
          {
            topicId: topicRaw(1).topic_id,
            slug: "topic-1",
            title: "Chủ đề 1",
            lastActivityAt: "2026-03-11T01:04:00+00:00",
            daysAgo: 1,
          },
        ],
      },
    });
    expect(rpc).toHaveBeenCalledExactlyOnceWith("feat3_learning_summary", { p_course_id: COURSE_ID });
  });

  it("does not call the RPC for a course id that is not a uuid", async () => {
    const { rpc } = useRpc({ data: courseRaw });

    await expect(getCourseLearningSummary("not-a-uuid")).resolves.toMatchObject({ success: false });
    expect(mockedCreateClient).not.toHaveBeenCalled();
    expect(rpc).not.toHaveBeenCalled();
  });

  it.each([
    ["the RPC is missing or errors (database not migrated yet)", { error: { code: "PGRST202", message: "function not found" } }],
    ["the RPC returns null (no signed-in user)", { data: null }],
    ["the RPC returns another shape", { data: { streak: "3" } }],
    ["the overall RPC result carries course keys", { data: courseRaw }],
  ])("returns an unavailable result without throwing when %s", async (_name, result) => {
    useRpc(result);

    await expect(getLearningSummary()).resolves.toEqual({ success: false, error: expect.any(String) });
  });

  it.each([
    ["the RPC errors", { error: { message: "boom" } }],
    ["the RPC returns more than three recent topics", { data: { ...courseRaw, recent_topics: [1, 2, 3, 4].map(topicRaw) } }],
    ["a topic has a negative day offset", { data: { ...courseRaw, recent_topics: [{ ...topicRaw(1), days_ago: -1 }] } }],
    ["the course RPC result carries overall keys", { data: overallRaw }],
  ])("returns an unavailable course result without throwing when %s", async (_name, result) => {
    useRpc(result);

    await expect(getCourseLearningSummary(COURSE_ID)).resolves.toEqual({ success: false, error: expect.any(String) });
  });

  it("turns a thrown client or network failure into an unavailable result", async () => {
    useRpc(new Error("network down"));
    await expect(getLearningSummary()).resolves.toMatchObject({ success: false });
    await expect(getCourseLearningSummary(COURSE_ID)).resolves.toMatchObject({ success: false });

    mockedCreateClient.mockRejectedValue(new Error("no cookies"));
    await expect(getLearningSummary()).resolves.toMatchObject({ success: false });
  });

  it("does not leak the database error text into the result", async () => {
    useRpc({ error: { message: "relation public.secret does not exist" } });

    const result = await getLearningSummary();

    expect(JSON.stringify(result)).not.toContain("secret");
  });
});
