import type { ReactNode } from "react";
import { ClientNamespaces } from "@/components/i18n/client-namespaces";

// Trang bài học render LearningWorkspace (FlashcardStage, ReviewSheet, QuestionNavigator, ChoiceGroup...) nên cần `flashcard` (U2 H2),
// `learning` (chữ dùng chung của các thành phần học) và `learn` (chữ của màn hình, U3 H2/G4). Provider này thay messages của provider cha
// ([course-slug]/layout.tsx), nên liệt kê đủ mọi namespace mà cây bài học dùng.
export default function LearnTopicLayout({ children }: { children: ReactNode }) {
  return <ClientNamespaces namespaces={["flashcard", "learning", "learn"]}>{children}</ClientNamespaces>;
}
