import type { ReactNode } from "react";
import { ClientNamespaces } from "@/components/i18n/client-namespaces";

// Bảng điều khiển học (/learn) render LearnDashboardClient và ReviewSheet nên cần `flashcard` cho nhãn đánh giá (U2 H2). Nhóm route
// `(dashboard)` không đổi URL; trang tổng quan khóa học /learn/[course-slug] không render hai thành phần đó nên không nhận namespace này.
export default function LearnDashboardLayout({ children }: { children: ReactNode }) {
  return <ClientNamespaces namespaces={["flashcard"]}>{children}</ClientNamespaces>;
}
