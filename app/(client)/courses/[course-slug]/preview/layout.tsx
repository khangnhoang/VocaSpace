import type { ReactNode } from "react";
import { ClientNamespaces } from "@/components/i18n/client-namespaces";

// `flashcard` chỉ cho FlashcardStage trong xem thử (U2 H2); liệt kê lại các namespace của layout cha vì provider lồng nhau thay
// thế message của cha.
export default function CoursePreviewLayout({ children }: { children: ReactNode }) {
  return <ClientNamespaces namespaces={["courses", "learning", "flashcard"]}>{children}</ClientNamespaces>;
}
