import type { ReactNode } from "react";
import { ClientNamespaces } from "@/components/i18n/client-namespaces";

// Bảng điều khiển học (/learn) render LearnDashboardClient, ReviewSheet và thẻ chuỗi ngày học nên cần `flashcard` (nhãn đánh giá, U2 H2),
// `learning` (thứ, ngày-tháng, thời lượng) và `learn` (chữ của màn hình, U3 H2/G4). Nhóm route `(dashboard)` không đổi URL.
export default function LearnDashboardLayout({ children }: { children: ReactNode }) {
  return <ClientNamespaces namespaces={["flashcard", "learning", "learn"]}>{children}</ClientNamespaces>;
}
