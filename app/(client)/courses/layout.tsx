import type { ReactNode } from "react";
import { ClientNamespaces } from "@/components/i18n/client-namespaces";

// `courses` cho các thành phần client của danh mục, trang chi tiết và xem thử; `learning` cho thẻ "đang học" và bộ điều hướng câu
// hỏi dùng chung; `flashcard` cho FlashcardStage trong xem thử (U2 H2). Đặt ở layout (không bọc giá trị trả về của page) để test
// của page vẫn đọc được phần tử page trả về.
export default function CoursesLayout({ children }: { children: ReactNode }) {
  return <ClientNamespaces namespaces={["courses", "learning", "flashcard"]}>{children}</ClientNamespaces>;
}
