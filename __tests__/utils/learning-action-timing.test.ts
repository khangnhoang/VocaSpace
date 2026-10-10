import { afterEach, describe, expect, it, vi } from "vitest";
import { createActionTimer } from "@/lib/learning-action-timing";

// Test plan:
// - Mục tiêu: bộ đo thời gian LF2 tắt mặc định và chỉ phát nhãn đường đi cùng thời lượng khi bật (G8).
// - Loại test: unit.
// - Đối tượng: createActionTimer.
// - Case thành công: bật bằng LEARNING_ACTION_TIMING=1 thì ghi đúng một dòng JSON gồm action, nhãn, tổng và từng bước.
// - Case thất bại: bước ném lỗi vẫn ném nguyên lỗi và vẫn được ghi thời lượng.
// - Bảo mật/phân quyền: dòng log chỉ có action, path, totalMs, steps; tắt thì không log gì.
// - Invariant cần giữ: kết quả bước đi qua nguyên vẹn dù bật hay tắt đo.
// - Kết quả verify gần nhất: passed bằng `npx vitest run __tests__/utils/learning-action-timing.test.ts`.

describe("createActionTimer", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
    vi.restoreAllMocks();
  });

  it("stays silent and passes results through when the flag is off", async () => {
    const info = vi.spyOn(console, "info").mockImplementation(() => {});
    const timer = createActionTimer("submitCardReview");

    await expect(timer.step("anything", async () => "value")).resolves.toBe("value");
    timer.label("card-review:create");
    timer.end();

    expect(info).not.toHaveBeenCalled();
  });

  it("logs one record with only the action, path label, total and step durations when enabled", async () => {
    vi.stubEnv("LEARNING_ACTION_TIMING", "1");
    const info = vi.spyOn(console, "info").mockImplementation(() => {});
    const timer = createActionTimer("submitQuestionAnswer");

    await expect(timer.step("auth.getUser", async () => ({ user: "secret-user" }))).resolves.toEqual({ user: "secret-user" });
    timer.label("question-answer:exercise");
    timer.end();
    timer.end();

    expect(info).toHaveBeenCalledTimes(1);
    const [tag, line] = info.mock.calls[0];
    expect(tag).toBe("[learning-action-timing]");
    const record = JSON.parse(line as string);
    expect(Object.keys(record).sort()).toEqual(["action", "path", "steps", "totalMs"]);
    expect(record).toMatchObject({ action: "submitQuestionAnswer", path: "question-answer:exercise" });
    expect(record.steps).toEqual([{ name: "auth.getUser", ms: expect.any(Number) }]);
    expect(line).not.toContain("secret-user");
  });

  it("rethrows a failing step unchanged and still records its duration", async () => {
    vi.stubEnv("LEARNING_ACTION_TIMING", "1");
    const info = vi.spyOn(console, "info").mockImplementation(() => {});
    const timer = createActionTimer("submitCardReview");
    const failure = new Error("boom");

    await expect(timer.step("mutation", async () => { throw failure; })).rejects.toBe(failure);
    timer.end();

    expect(JSON.parse(info.mock.calls[0][1] as string).steps).toEqual([{ name: "mutation", ms: expect.any(Number) }]);
  });
});
