import { ReactNode } from "react";
import { ClientNamespaces } from "@/components/i18n/client-namespaces";

// `profile` cho thẻ hồ sơ, form sửa hồ sơ và form đổi mật khẩu (U2 H2, G4); `auth` vì đổi mật khẩu có thể trả chuỗi của `auth.actions`
// (mật khẩu trùng, quá yếu) mà client dịch lại khi ngôn ngữ của trang khác ngôn ngữ server. `ClientNamespaces` chỉ nhận namespace cấp
// một nên không chọn riêng hai khóa đó được; thu hẹp cần đổi helper dùng chung, ngoài phạm vi U2. Đặt ở layout (không bọc giá trị trả về của page) để test
// của page vẫn đọc được phần tử page trả về.
export default function ProfileLayout({ children }: { children: ReactNode }) {
  return <ClientNamespaces namespaces={["profile", "auth", "payments"]}>{children}</ClientNamespaces>;
}
