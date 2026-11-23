import type { ReactNode } from "react";
import { ClientNamespaces } from "@/components/i18n/client-namespaces";

// Trang tổng quan khóa học đã ghi danh (/learn/[course-slug]) cần `learning` (thẻ chuỗi ngày học, ngày tương đối) và `learn` (chữ của
// màn hình, U3 H2/G4). Trang bài học bên dưới có layout riêng thay messages của provider này, nên layout đó tự liệt kê đủ.
export default function LearnCourseLayout({ children }: { children: ReactNode }) {
  return <ClientNamespaces namespaces={["learning", "learn"]}>{children}</ClientNamespaces>;
}
