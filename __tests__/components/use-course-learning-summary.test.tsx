/**
 * @vitest-environment jsdom
 */

import { act, renderHook, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { getCourseLearningSummary } from "@/app/actions/learning-activity";
import { useCourseLearningSummary } from "@/hooks/use-course-learning-summary";
import type { CourseLearningSummaryResult } from "@/lib/schemas/learning-activity";

// Test plan:
// - Mục tiêu: FEAT3 AC7/G3 - chip chuỗi ngày học trong workspace đọc lại từ server sau mỗi hành động học đã lưu; client không quyết định
//   gì theo ngày hay đồng hồ trình duyệt; một lần đọc tại một thời điểm và kết quả cuối phản ánh hành động cuối; lần đọc lỗi không
//   xóa kết quả tốt (AC10).
// - Loại test: hook với Server Action boundary mock. Ngày và chuỗi do SQL tính (đã kiểm ở integration), nên hook chỉ giữ kết quả server.
// - Đối tượng: useCourseLearningSummary.noteLearningAction.
// - Case thành công: mỗi hành động đã lưu đọc lại đúng một lần với courseId và cập nhật chuỗi mới, kể cả khi kết quả cũ đã báo học hôm nay.
// - Case thất bại: đọc lỗi hoặc ném lỗi giữ kết quả cũ và cho phép thử lại ở hành động sau.
// - Ổn định/resilience: trang không truyền kết quả thì không gọi action; hành động đến khi đang đọc gộp thành đúng một lần đọc lại sau đó.
// - Nửa đêm/đồng hồ lệch: kết quả dựng trước nửa đêm VN (Asia/Ho_Chi_Minh) rồi hydrate sau nửa đêm, đồng hồ trình duyệt lệch bất kỳ,
//   hay cùng workspace mở qua nửa đêm đều đọc lại ở hành động đầu tiên và chuỗi 2 -> 3.
// - Invariant cần giữ: hook không tính ngày hay chuỗi và không đọc đồng hồ.
// - Kết quả verify gần nhất: xem milestone FEAT3 correction trong progress.md.

vi.mock("@/app/actions/learning-activity", () => ({ getCourseLearningSummary: vi.fn() }));

const mockedGet = vi.mocked(getCourseLearningSummary);
const COURSE_ID = "c0c0c0c0-0000-4000-8000-000000000001";

const result = (streak: number, studiedToday: boolean): CourseLearningSummaryResult => ({
  success: true,
  data: { streak, studiedToday, recentTopics: [] },
});

describe("useCourseLearningSummary", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("re-reads after each saved action, even when the earlier result already says studied today", async () => {
    mockedGet.mockResolvedValueOnce(result(3, true)).mockResolvedValueOnce(result(3, true));
    const { result: hook } = renderHook(() => useCourseLearningSummary(COURSE_ID, result(3, true)));

    act(() => hook.current.noteLearningAction());
    await waitFor(() => expect(mockedGet).toHaveBeenCalledTimes(1));
    await act(async () => undefined);
    act(() => hook.current.noteLearningAction());
    await waitFor(() => expect(mockedGet).toHaveBeenCalledTimes(2));

    expect(mockedGet).toHaveBeenNthCalledWith(1, COURSE_ID);
    expect(mockedGet).toHaveBeenNthCalledWith(2, COURSE_ID);
  });

  it.each([
    ["a summary rendered before Vietnam midnight and hydrated after it", "2026-03-10T17:05:00Z"],
    ["a browser clock that lags a day", "2026-03-09T01:00:00Z"],
    ["a browser clock that runs a day ahead", "2026-03-12T01:00:00Z"],
  ])("re-reads on the first action and moves the streak 2 to 3 for %s", async (_name, now) => {
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(new Date(now));
    mockedGet.mockResolvedValue(result(3, true));
    // Kết quả SQL đã báo studiedToday từ trước nửa đêm; hook không được suy ra ngày từ đồng hồ.
    const { result: hook } = renderHook(() => useCourseLearningSummary(COURSE_ID, result(2, true)));

    act(() => hook.current.noteLearningAction());

    await waitFor(() => expect(hook.current.summary).toEqual(result(3, true)));
    expect(mockedGet).toHaveBeenCalledExactlyOnceWith(COURSE_ID);
  });

  it("re-reads again in the same mounted workspace after the clock crosses Vietnam midnight", async () => {
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(new Date("2026-03-10T16:30:00Z"));
    mockedGet.mockResolvedValueOnce(result(2, true)).mockResolvedValueOnce(result(3, true));
    const { result: hook } = renderHook(() => useCourseLearningSummary(COURSE_ID, result(2, true)));

    act(() => hook.current.noteLearningAction());
    await waitFor(() => expect(mockedGet).toHaveBeenCalledTimes(1));
    await act(async () => undefined);
    vi.setSystemTime(new Date("2026-03-10T17:05:00Z"));
    act(() => hook.current.noteLearningAction());

    await waitFor(() => expect(hook.current.summary).toEqual(result(3, true)));
    expect(mockedGet).toHaveBeenCalledTimes(2);
  });

  it("does not read when the page passed no summary", () => {
    const { result: hook } = renderHook(() => useCourseLearningSummary(COURSE_ID, undefined));

    act(() => hook.current.noteLearningAction());

    expect(mockedGet).not.toHaveBeenCalled();
    expect(hook.current.summary).toBeUndefined();
  });

  it("coalesces actions that arrive during a read into one trailing read that reflects the last action", async () => {
    let resolveFirst!: (value: CourseLearningSummaryResult) => void;
    mockedGet
      .mockReturnValueOnce(new Promise((resolve) => (resolveFirst = resolve)))
      .mockResolvedValueOnce(result(2, true));
    const { result: hook } = renderHook(() => useCourseLearningSummary(COURSE_ID, result(1, false)));

    act(() => hook.current.noteLearningAction());
    act(() => hook.current.noteLearningAction());
    act(() => hook.current.noteLearningAction());
    expect(mockedGet).toHaveBeenCalledTimes(1);
    await act(async () => resolveFirst(result(1, true)));

    await waitFor(() => expect(hook.current.summary).toEqual(result(2, true)));
    expect(mockedGet).toHaveBeenCalledTimes(2);
  });

  it("keeps the earlier result after a failed read and retries on the next action", async () => {
    const initial = result(2, false);
    mockedGet
      .mockResolvedValueOnce({ success: false, error: "x" })
      .mockRejectedValueOnce(new Error("net"))
      .mockResolvedValueOnce(result(3, true));
    const { result: hook } = renderHook(() => useCourseLearningSummary(COURSE_ID, initial));

    act(() => hook.current.noteLearningAction());
    await waitFor(() => expect(mockedGet).toHaveBeenCalledTimes(1));
    await act(async () => undefined);
    expect(hook.current.summary).toEqual(initial);

    act(() => hook.current.noteLearningAction());
    await waitFor(() => expect(mockedGet).toHaveBeenCalledTimes(2));
    await act(async () => undefined);
    expect(hook.current.summary).toEqual(initial);

    act(() => hook.current.noteLearningAction());
    await waitFor(() => expect(hook.current.summary).toEqual(result(3, true)));
    expect(mockedGet).toHaveBeenCalledTimes(3);
  });
});
