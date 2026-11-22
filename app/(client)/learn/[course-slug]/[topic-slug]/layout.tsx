import type { ReactNode } from "react";
import { ClientNamespaces } from "@/components/i18n/client-namespaces";

// Trang bài học render LearningWorkspace (FlashcardStage và ReviewSheet) nên cần `flashcard` cho nhãn đánh giá (U2 H2); phần còn lại
// của khu học thuộc U3.
export default function LearnTopicLayout({ children }: { children: ReactNode }) {
  return <ClientNamespaces namespaces={["flashcard"]}>{children}</ClientNamespaces>;
}
