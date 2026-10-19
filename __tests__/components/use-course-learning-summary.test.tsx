/**
 * @vitest-environment jsdom
 */

import { act, renderHook, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { getCourseLearningSummary } from "@/app/actions/learning-activity";
import { useCourseLearningSummary } from "@/hooks/use-course-learning-summary";
import type { CourseLearningSummaryResult } from "@/lib/schemas/learning-activity";

// Test plan:
// - Mục tiêu: FEAT3 AC7 - chip chuỗi ngày học trong workspace chỉ đọc lại từ server sau một hành động học đã lưu, và chỉ khi hôm nay
//   chưa học; một lần đọc tại một thời điểm; lần đọc lỗi không xóa kết quả tốt (AC10).
// - Loại test: hook với Server Action boundary mock. Ngày và chuỗi do SQL tính (đã kiểm ở integration), nên hook chỉ giữ kết quả server.
// - Đối tượng: useCourseLearningSummary.noteLearningAction.
// - Case thành công: chưa học hôm nay -> một hành động đọc lại đúng một lần với courseId và cập nhật chuỗi mới.
// - Case thất bại: đọc lỗi hoặc ném lỗi giữ kết quả cũ và cho phép thử lại ở hành động sau.
// - Ổn định/resilience: đã học hôm nay hoặc trang không truyền kết quả thì không gọi action; hành động liên tiếp khi đang đọc chỉ gọi một lần.
// - Qua nửa đêm: cùng một workspace đang mở, ngày VN (Asia/Ho_Chi_Minh) đổi thì hành động đầu tiên của ngày mới đọc lại và chuỗi 2 -> 3.
// - Invariant cần giữ: hook không tự tính chuỗi; chỉ so khóa ngày VN để biết khi nào cần đọc lại.
// - Kết quả verify gần nhất: xem milestone FEAT3 CP2 trong progress.md.

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

  it("re-reads on the first saved action after Vietnam midnight in the same mounted workspace (streak 2 to 3)", async () => {
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(new Date("2026-03-10T16:30:00Z")); // 23:30 ngày 10/03 giờ VN
    mockedGet.mockResolvedValue(result(3, true));
    const { result: hook } = renderHook(() => useCourseLearningSummary(COURSE_ID, result(2, true)));

    act(() => hook.current.noteLearningAction());
    expect(mockedGet).not.toHaveBeenCalled();

    vi.setSystemTime(new Date("2026-03-10T17:05:00Z")); // 00:05 ngày 11/03 giờ VN
    act(() => hook.current.noteLearningAction());
    await waitFor(() => expect(hook.current.summary).toEqual(result(3, true)));
    expect(mockedGet).toHaveBeenCalledExactlyOnceWith(COURSE_ID);

    act(() => hook.current.noteLearningAction());
    expect(mockedGet).toHaveBeenCalledTimes(1);
  });

  it("re-reads once after a saved action when the learner has not studied today, then stops", async () => {
    mockedGet.mockResolvedValue(result(3, true));
    const { result: hook } = renderHook(() => useCourseLearningSummary(COURSE_ID, result(2, false)));

    act(() => hook.current.noteLearningAction());
    await waitFor(() => expect(hook.current.summary).toEqual(result(3, true)));
    act(() => hook.current.noteLearningAction());
    act(() => hook.current.noteLearningAction());

    expect(mockedGet).toHaveBeenCalledExactlyOnceWith(COURSE_ID);
  });

  it("does not read again when the learner already studied today", () => {
    const { result: hook } = renderHook(() => useCourseLearningSummary(COURSE_ID, result(4, true)));

    act(() => hook.current.noteLearningAction());

    expect(mockedGet).not.toHaveBeenCalled();
    expect(hook.current.summary).toEqual(result(4, true));
  });

  it("does not read when the page passed no summary", () => {
    const { result: hook } = renderHook(() => useCourseLearningSummary(COURSE_ID, undefined));

    act(() => hook.current.noteLearningAction());

    expect(mockedGet).not.toHaveBeenCalled();
    expect(hook.current.summary).toBeUndefined();
  });

  it("starts only one read while another is in flight", async () => {
    let resolve!: (value: CourseLearningSummaryResult) => void;
    mockedGet.mockReturnValue(new Promise((r) => (resolve = r)));
    const { result: hook } = renderHook(() => useCourseLearningSummary(COURSE_ID, result(0, false)));

    act(() => hook.current.noteLearningAction());
    act(() => hook.current.noteLearningAction());
    expect(mockedGet).toHaveBeenCalledTimes(1);
    await act(async () => resolve(result(1, true)));

    await waitFor(() => expect(hook.current.summary).toEqual(result(1, true)));
  });

  it("keeps the earlier result after a failed read and retries on the next action", async () => {
    const initial = result(2, false);
    mockedGet.mockResolvedValueOnce({ success: false, error: "x" }).mockRejectedValueOnce(new Error("net")).mockResolvedValueOnce(result(3, true));
    const { result: hook } = renderHook(() => useCourseLearningSummary(COURSE_ID, initial));

    act(() => hook.current.noteLearningAction());
    await waitFor(() => expect(mockedGet).toHaveBeenCalledTimes(1));
    expect(hook.current.summary).toEqual(initial);

    act(() => hook.current.noteLearningAction());
    await waitFor(() => expect(mockedGet).toHaveBeenCalledTimes(2));
    expect(hook.current.summary).toEqual(initial);

    act(() => hook.current.noteLearningAction());
    await waitFor(() => expect(hook.current.summary).toEqual(result(3, true)));
    expect(mockedGet).toHaveBeenCalledTimes(3);
  });
});
