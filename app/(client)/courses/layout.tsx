import type { ReactNode } from "react";
import { ClientNamespaces } from "@/components/i18n/client-namespaces";

// `courses` cho các thành phần client của danh mục. Trang chi tiết và xem thử có layout riêng thêm `learning` và `flashcard`, để
// danh mục không tải những namespace nó không dùng (U2 G4, H2). Đặt ở layout (không bọc giá trị trả về của page) để test của page
// vẫn đọc được phần tử page trả về.
export default function CoursesLayout({ children }: { children: ReactNode }) {
  return <ClientNamespaces namespaces={["courses"]}>{children}</ClientNamespaces>;
}
