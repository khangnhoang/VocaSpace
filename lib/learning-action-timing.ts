// LF2 CP2: đo thời gian server của Server Action học tập (AC1, G1, G8).
// Tắt mặc định; chỉ bật khi LEARNING_ACTION_TIMING=1. Chỉ ghi tên action, nhãn đường đi và thời lượng:
// không bao giờ ghi user id, id nội dung, đáp án hay token. Phải tắt hoặc gỡ trước khi merge.

export type ActionTimer = {
  /** Chạy một bước awaited, ghi thời lượng khi bật đo; kết quả và lỗi đi qua nguyên vẹn. */
  step<T>(name: string, run: () => PromiseLike<T>): PromiseLike<T>;
  /** Gắn nhãn đường đi (ví dụ `create`/`update`) để tách các nhánh cùng một action. */
  label(path: string): void;
  /** Ghi một dòng JSON gồm tổng thời lượng từ lúc vào action và từng bước. */
  end(): void;
};

const disabledTimer: ActionTimer = {
  step: (_name, run) => run(),
  label: () => {},
  end: () => {},
};

function round(ms: number) {
  return Math.round(ms * 100) / 100;
}

export function createActionTimer(action: string): ActionTimer {
  if (process.env.LEARNING_ACTION_TIMING !== "1") return disabledTimer;

  const startedAt = performance.now();
  const steps: Array<{ name: string; ms: number }> = [];
  let path = "unlabeled";
  let ended = false;

  return {
    async step(name, run) {
      const stepStartedAt = performance.now();
      try {
        return await run();
      } finally {
        steps.push({ name, ms: round(performance.now() - stepStartedAt) });
      }
    },
    label(next) {
      path = next;
    },
    end() {
      if (ended) return;
      ended = true;
      console.info(
        "[learning-action-timing]",
        JSON.stringify({ action, path, totalMs: round(performance.now() - startedAt), steps }),
      );
    },
  };
}
