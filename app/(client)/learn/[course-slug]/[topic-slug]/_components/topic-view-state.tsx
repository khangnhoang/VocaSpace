"use client";

import { createContext, useContext, useState, type ReactNode } from "react";
import type { AnswerAttempt } from "./answer-attempt";

// ENLOC-004: `router.refresh()` (đổi ngôn ngữ) có thể đổi `workspaceKey` của trang vì tiến độ thẻ đổi, nên LearningWorkspace dựng lại
// và mất kết quả câu trả lời đang hiện. Store này nằm trong layout `[topic-slug]` (layout giữ nguyên qua `router.refresh()` và dựng lại khi
// đổi chủ đề hoặc tải lại trang) nên bản chụp chỉ sống khi học viên còn ở URL chủ đề; không dùng biến module (G4).

export type SettledAttempt = Extract<AnswerAttempt, { status: "settled" }>;

/** Nhận dạng dữ liệu server mà bản chụp được ghi cho; khác đi ở bất kỳ phần nào thì không khôi phục (G3). */
export type TopicViewIdentity = {
  topicId: string;
  flashcardIds: string;
  exerciseQuestionIds: string;
  memoryQuestionIds: string;
};

/** Chỉ state xem của các bước câu hỏi (G2). Hàng đợi thẻ, các tập thẻ, cổng và tiến độ luôn lấy từ dữ liệu server mới. */
export type TopicViewSnapshot = {
  identity: TopicViewIdentity;
  stage: "memory" | "exercise" | null;
  exerciseIndex: number;
  groupIndex: number;
  questionIndex: number;
  // Chỉ lần gửi đã có kết quả; lần gửi đang chờ không bao giờ mang qua (G5).
  settledAttempts: Record<string, SettledAttempt>;
  incorrectIds: Record<string, true>;
};

type TopicViewStore = { read: () => TopicViewSnapshot | null; write: (snapshot: TopicViewSnapshot) => void };

const TopicViewStoreContext = createContext<TopicViewStore | null>(null);

function createStore(): TopicViewStore {
  let snapshot: TopicViewSnapshot | null = null;
  return {
    read: () => snapshot,
    // Ghi không gây render: chỉ lần mount sau của workspace đọc.
    write: (next) => {
      snapshot = next;
    },
  };
}

export function TopicViewStateProvider({ children }: { children: ReactNode }) {
  // Một store ổn định cho mỗi lần mount của layout.
  const [store] = useState(createStore);
  return <TopicViewStoreContext.Provider value={store}>{children}</TopicViewStoreContext.Provider>;
}

/** Null khi không có provider (ví dụ test hoặc nơi khác render workspace): khi đó không mang state nào qua. */
export function useTopicViewStore(): TopicViewStore | null {
  return useContext(TopicViewStoreContext);
}

export function sameIdentity(left: TopicViewIdentity, right: TopicViewIdentity) {
  return (
    left.topicId === right.topicId &&
    left.flashcardIds === right.flashcardIds &&
    left.exerciseQuestionIds === right.exerciseQuestionIds &&
    left.memoryQuestionIds === right.memoryQuestionIds
  );
}
