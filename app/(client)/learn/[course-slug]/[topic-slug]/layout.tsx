import type { ReactNode } from "react";
import { ClientNamespaces } from "@/components/i18n/client-namespaces";
import { TopicViewStateProvider } from "./_components/topic-view-state";

// Trang bài học render LearningWorkspace (FlashcardStage, ReviewSheet, QuestionNavigator, ChoiceGroup...) nên cần `flashcard` (U2 H2),
// `learning` (chữ dùng chung của các thành phần học) và `learn` (chữ của màn hình, U3 H2/G4). Provider này thay messages của provider cha
// ([course-slug]/layout.tsx), nên liệt kê đủ mọi namespace mà cây bài học dùng.
// TopicViewStateProvider (ENLOC-004) giữ state xem của câu hỏi qua lần dựng lại của workspace sau `router.refresh()`; layout này sống đến khi
// học viên rời URL chủ đề hoặc tải lại trang, nên state đó không sang lần học sau.
export default function LearnTopicLayout({ children }: { children: ReactNode }) {
  return (
    <ClientNamespaces namespaces={["flashcard", "learning", "learn"]}>
      <TopicViewStateProvider>{children}</TopicViewStateProvider>
    </ClientNamespaces>
  );
}
