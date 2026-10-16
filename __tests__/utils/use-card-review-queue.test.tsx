// @vitest-environment jsdom
import { act, cleanup, renderHook } from "@testing-library/react";
import { Rating } from "ts-fsrs";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { submitCardReview } from "@/app/actions/review";
import {
  CARD_REVIEW_RETRY_DELAY_MS,
  resetCardReviewQueueForTests,
  useCardReviewQueue,
} from "@/hooks/use-card-review-queue";

// Test plan:
// - Mục tiêu: hàng đợi lưu đánh giá thẻ dùng chung (LF8 G1, G2, G5, AC2, AC4, AC6) lưu từng đánh giá một theo thứ tự và báo đúng kết quả.
// - Loại: unit test của hook với jsdom; chỉ mock `submitCardReview` (có promise treo/giải phóng theo từng lần gọi) và fake timers cho độ trễ thử lại.
// - Case: FIFO và chỉ một lần lưu đang chạy; callback thành công nhận đúng request và kết quả; lỗi trả về hoặc ném đều thử lại đúng một lần sau độ trễ rồi mới báo lỗi cuối;
//   lần thử lại xong mới đến đánh giá kế tiếp; đếm đang chờ; listener `beforeunload` thêm khi có việc chờ và gỡ khi hết (preventDefault và returnValue rỗng);
//   `whenDrained` chạy ngay khi rảnh, đợi cả đánh giá thêm sau, hủy được; hai instance dùng chung một chuỗi; unmount vẫn lưu tiếp nhưng không gọi callback;
//   hàm reset của test làm mục treo thành vô hiệu.
// - Giới hạn: không kiểm tra server action thật, FSRS hay UI; thứ tự và gate trên màn hình do test của từng bề mặt và smoke kiểm tra.
// - Verify: `npx vitest run __tests__/utils/use-card-review-queue.test.tsx`.
vi.mock("@/app/actions/review", () => ({ submitCardReview: vi.fn() }));
const submit = vi.mocked(submitCardReview);

type Result = Awaited<ReturnType<typeof submitCardReview>>;
function deferred() {
  let resolve!: (value: Result) => void;
  let reject!: (reason: unknown) => void;
  const promise = new Promise<Result>((res, rej) => {
    resolve = res;
    reject = rej;
  });
  return { promise, resolve, reject };
}

const ok: Result = { success: true };

// jsdom không có BeforeUnloadEvent riêng; ghi lại giá trị gán cho `returnValue` để kiểm tra phần Safari.
function fireUnload() {
  const event = new Event("beforeunload", { cancelable: true }) as BeforeUnloadEvent;
  let returnValue: unknown;
  Object.defineProperty(event, "returnValue", { get: () => returnValue, set: (value) => { returnValue = value; }, configurable: true });
  window.dispatchEvent(event);
  return { prevented: event.defaultPrevented, returnValue };
}
const req = (cardId: string, rating: Rating = Rating.Good, generation = 0) => ({ cardId, rating, generation });

function setup() {
  const onSaved = vi.fn();
  const onFailed = vi.fn();
  const view = renderHook(() => useCardReviewQueue({ onSaved, onFailed }));
  return { ...view, onSaved, onFailed };
}

// Cho các microtask của chuỗi lưu chạy hết mà không cần timer.
const flush = () => act(async () => { await Promise.resolve(); });
async function settle(d: ReturnType<typeof deferred>, result: Result = ok) {
  await act(async () => {
    d.resolve(result);
    await Promise.resolve();
  });
}

beforeEach(() => {
  vi.useFakeTimers({ toFake: ["setTimeout", "clearTimeout"] });
  vi.resetAllMocks();
  resetCardReviewQueueForTests();
});
afterEach(() => {
  cleanup();
  resetCardReviewQueueForTests();
  vi.useRealTimers();
});

describe("useCardReviewQueue ordering", () => {
  it("sends ratings strictly one at a time and in the order given", async () => {
    const first = deferred();
    const second = deferred();
    const third = deferred();
    submit.mockReturnValueOnce(first.promise).mockReturnValueOnce(second.promise).mockReturnValueOnce(third.promise);
    const { result, onSaved } = setup();

    act(() => {
      result.current.enqueue(req("a", Rating.Again));
      result.current.enqueue(req("b", Rating.Easy));
      result.current.enqueue(req("c", Rating.Good));
    });
    await flush();
    expect(submit).toHaveBeenCalledTimes(1);
    expect(submit).toHaveBeenLastCalledWith("a", Rating.Again);

    await settle(first);
    expect(submit).toHaveBeenCalledTimes(2);
    expect(submit).toHaveBeenLastCalledWith("b", Rating.Easy);
    await settle(second);
    expect(submit).toHaveBeenCalledTimes(3);
    expect(submit).toHaveBeenLastCalledWith("c", Rating.Good);
    await settle(third);

    expect(onSaved.mock.calls.map(([request]) => request.cardId)).toEqual(["a", "b", "c"]);
  });

  it("sends a second rating of the same card only after the first settles", async () => {
    const first = deferred();
    submit.mockReturnValueOnce(first.promise).mockResolvedValueOnce(ok);
    const { result, onSaved } = setup();

    act(() => {
      result.current.enqueue(req("a", Rating.Again));
      result.current.enqueue(req("a", Rating.Good));
    });
    await flush();
    expect(submit).toHaveBeenCalledTimes(1);

    await settle(first);
    expect(submit).toHaveBeenCalledTimes(2);
    expect(submit).toHaveBeenLastCalledWith("a", Rating.Good);
    expect(onSaved).toHaveBeenCalledTimes(2);
  });

  it("passes the request and the server result to onSaved", async () => {
    const serverResult: Result = { success: true, progressError: "tiến độ chưa ghi" };
    submit.mockResolvedValueOnce(serverResult);
    const { result, onSaved, onFailed } = setup();

    act(() => result.current.enqueue(req("a", Rating.Hard, 3)));
    await flush();

    expect(onSaved).toHaveBeenCalledTimes(1);
    expect(onSaved).toHaveBeenCalledWith({ cardId: "a", rating: Rating.Hard, generation: 3 }, serverResult);
    expect(onFailed).not.toHaveBeenCalled();
  });
});

describe("useCardReviewQueue retry", () => {
  it("retries a returned error once after the delay and then saves", async () => {
    submit.mockResolvedValueOnce({ error: "boom" }).mockResolvedValueOnce(ok);
    const { result, onSaved, onFailed } = setup();

    act(() => result.current.enqueue(req("a")));
    await flush();
    expect(submit).toHaveBeenCalledTimes(1);
    expect(onFailed).not.toHaveBeenCalled();

    await act(async () => {
      await vi.advanceTimersByTimeAsync(CARD_REVIEW_RETRY_DELAY_MS - 1);
    });
    expect(submit).toHaveBeenCalledTimes(1);
    await act(async () => {
      await vi.advanceTimersByTimeAsync(1);
    });
    expect(submit).toHaveBeenCalledTimes(2);
    expect(submit).toHaveBeenLastCalledWith("a", Rating.Good);
    expect(onSaved).toHaveBeenCalledTimes(1);
    expect(onFailed).not.toHaveBeenCalled();
  });

  it("reports a final failure with the server message after one retry, then starts the next rating", async () => {
    submit
      .mockResolvedValueOnce({ error: "một" })
      .mockResolvedValueOnce({ error: "hai" })
      .mockResolvedValueOnce(ok);
    const { result, onSaved, onFailed } = setup();

    act(() => {
      result.current.enqueue(req("a", Rating.Again, 2));
      result.current.enqueue(req("b"));
    });
    await flush();
    // Trong lúc chờ thử lại, đánh giá kế tiếp chưa được gửi.
    expect(submit).toHaveBeenCalledTimes(1);
    await act(async () => {
      await vi.advanceTimersByTimeAsync(CARD_REVIEW_RETRY_DELAY_MS);
    });

    expect(submit).toHaveBeenCalledTimes(3);
    expect(submit.mock.calls.map(([cardId]) => cardId)).toEqual(["a", "a", "b"]);
    expect(onFailed).toHaveBeenCalledTimes(1);
    expect(onFailed).toHaveBeenCalledWith({ cardId: "a", rating: Rating.Again, generation: 2 }, "hai");
    expect(onSaved).toHaveBeenCalledTimes(1);
    expect(onSaved.mock.calls[0][0].cardId).toBe("b");
  });

  it("treats a thrown action as a failure that is retried once", async () => {
    submit.mockRejectedValueOnce(new Error("network")).mockRejectedValueOnce(new Error("network"));
    const { result, onSaved, onFailed } = setup();

    act(() => result.current.enqueue(req("a")));
    await flush();
    await act(async () => {
      await vi.advanceTimersByTimeAsync(CARD_REVIEW_RETRY_DELAY_MS);
    });

    expect(submit).toHaveBeenCalledTimes(2);
    expect(onSaved).not.toHaveBeenCalled();
    expect(onFailed).toHaveBeenCalledTimes(1);
    expect(onFailed).toHaveBeenCalledWith({ cardId: "a", rating: Rating.Good, generation: 0 }, undefined);
  });
});

describe("useCardReviewQueue pending state and leaving the page", () => {
  it("counts pending ratings and warns before unload only while something is pending", async () => {
    const first = deferred();
    const second = deferred();
    submit.mockReturnValueOnce(first.promise).mockReturnValueOnce(second.promise);
    const { result } = setup();
    expect(result.current.pendingCount).toBe(0);
    expect(fireUnload().prevented).toBe(false);

    act(() => {
      result.current.enqueue(req("a"));
      result.current.enqueue(req("b"));
    });
    expect(result.current.pendingCount).toBe(2);
    const warned = fireUnload();
    expect(warned.prevented).toBe(true);
    expect(warned.returnValue).toBe("");

    await settle(first);
    expect(result.current.pendingCount).toBe(1);
    expect(fireUnload().prevented).toBe(true);

    await settle(second);
    expect(result.current.pendingCount).toBe(0);
    expect(fireUnload().prevented).toBe(false);
  });

  it("keeps the unload warning through the retry delay and removes it after a final failure", async () => {
    submit.mockResolvedValue({ error: "x" });
    const { result } = setup();
    const unloadPrevented = () => fireUnload().prevented;

    act(() => result.current.enqueue(req("a")));
    await flush();
    expect(unloadPrevented()).toBe(true);
    await act(async () => {
      await vi.advanceTimersByTimeAsync(CARD_REVIEW_RETRY_DELAY_MS);
    });
    expect(result.current.pendingCount).toBe(0);
    expect(unloadPrevented()).toBe(false);
  });
});

describe("useCardReviewQueue whenDrained", () => {
  it("runs at once when nothing is pending", () => {
    const { result } = setup();
    const done = vi.fn();
    act(() => {
      result.current.whenDrained(done);
    });
    expect(done).toHaveBeenCalledTimes(1);
  });

  it("runs once after the last pending rating has been handled, including ratings added while waiting", async () => {
    const first = deferred();
    const second = deferred();
    submit.mockReturnValueOnce(first.promise).mockReturnValueOnce(second.promise);
    const { result, onSaved } = setup();
    const done = vi.fn(() => expect(onSaved).toHaveBeenCalledTimes(2));

    act(() => {
      result.current.enqueue(req("a"));
      result.current.whenDrained(done);
    });
    await flush();
    expect(done).not.toHaveBeenCalled();

    act(() => result.current.enqueue(req("b")));
    await settle(first);
    expect(done).not.toHaveBeenCalled();
    await settle(second);
    await flush();

    expect(done).toHaveBeenCalledTimes(1);
  });

  it("does not run after it is cancelled", async () => {
    const first = deferred();
    submit.mockReturnValueOnce(first.promise);
    const { result } = setup();
    const done = vi.fn();

    let cancel = () => {};
    act(() => {
      result.current.enqueue(req("a"));
      cancel = result.current.whenDrained(done);
    });
    cancel();
    await settle(first);
    await flush();

    expect(done).not.toHaveBeenCalled();
  });
});

describe("useCardReviewQueue shared chain and unmount", () => {
  it("serializes ratings of two instances through one chain", async () => {
    const first = deferred();
    submit.mockReturnValueOnce(first.promise).mockResolvedValueOnce(ok);
    const one = setup();
    const two = setup();

    act(() => one.result.current.enqueue(req("a")));
    await flush();
    act(() => two.result.current.enqueue(req("a", Rating.Easy)));
    await flush();
    expect(submit).toHaveBeenCalledTimes(1);

    await settle(first);
    expect(submit).toHaveBeenCalledTimes(2);
    expect(submit).toHaveBeenLastCalledWith("a", Rating.Easy);
    expect(one.onSaved).toHaveBeenCalledTimes(1);
    expect(two.onSaved).toHaveBeenCalledTimes(1);
  });

  it("keeps saving queued ratings after unmount, keeps the unload warning, and skips the callbacks", async () => {
    const first = deferred();
    const second = deferred();
    submit.mockReturnValueOnce(first.promise).mockReturnValueOnce(second.promise);
    const { result, unmount, onSaved, onFailed } = setup();
    const done = vi.fn();

    act(() => {
      result.current.enqueue(req("a"));
      result.current.enqueue(req("b"));
      result.current.whenDrained(done);
    });
    unmount();
    await flush();

    expect(fireUnload().prevented).toBe(true);

    await settle(first);
    expect(submit).toHaveBeenCalledTimes(2);
    expect(submit).toHaveBeenLastCalledWith("b", Rating.Good);
    await settle(second);
    await flush();

    expect(onSaved).not.toHaveBeenCalled();
    expect(onFailed).not.toHaveBeenCalled();
    expect(done).not.toHaveBeenCalled();
    expect(fireUnload().prevented).toBe(false);
  });

  it("lets a new instance wait for a rating that an unmounted instance left in flight", async () => {
    const first = deferred();
    submit.mockReturnValueOnce(first.promise).mockResolvedValueOnce(ok);
    const old = setup();
    act(() => old.result.current.enqueue(req("a")));
    old.unmount();
    await flush();

    const fresh = setup();
    act(() => fresh.result.current.enqueue(req("a", Rating.Easy)));
    await flush();
    expect(submit).toHaveBeenCalledTimes(1);

    await settle(first);
    expect(submit).toHaveBeenCalledTimes(2);
    expect(fresh.onSaved).toHaveBeenCalledTimes(1);
  });
});

describe("resetCardReviewQueueForTests", () => {
  it("makes a stuck rating inert so it cannot block or leak into the next test", async () => {
    const stuck = deferred();
    submit.mockReturnValueOnce(stuck.promise);
    const first = setup();
    act(() => first.result.current.enqueue(req("a")));
    await flush();

    resetCardReviewQueueForTests();
    expect(fireUnload().prevented).toBe(false);

    submit.mockResolvedValueOnce(ok);
    const next = setup();
    act(() => next.result.current.enqueue(req("b")));
    await flush();
    expect(submit).toHaveBeenLastCalledWith("b", Rating.Good);
    expect(next.onSaved).toHaveBeenCalledTimes(1);

    await settle(stuck);
    expect(first.onSaved).not.toHaveBeenCalled();
  });
});
