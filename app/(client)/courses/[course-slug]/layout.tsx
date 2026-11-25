import type { ReactNode } from "react";
import { ClientNamespaces } from "@/components/i18n/client-namespaces";

// Chi tiết khóa học và xem thử: `learning` cho thẻ "đang học" và bộ điều hướng câu hỏi dùng chung (U2 G4, H2), `payments` cho hộp
// thoại đăng ký và thanh toán của trang chi tiết (U5 G4). Provider lồng nhau thay thế message của cha nên phải liệt kê lại `courses`.
export default function CourseSlugLayout({ children }: { children: ReactNode }) {
  return <ClientNamespaces namespaces={["courses", "learning", "payments"]}>{children}</ClientNamespaces>;
}
