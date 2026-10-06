import Link from "next/link";

const LINK_CLASS =
  "text-blue-600 underline underline-offset-2 hover:text-blue-700 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600";

// Chỉ là dòng thông báo, không có checkbox: tiếp tục đăng nhập/đăng ký (email hoặc Google) được coi là đồng ý (A4b decision 6).
export function LegalConsentNotice() {
  return (
    <p className="text-center text-xs leading-5 text-gray-500">
      Bằng việc tiếp tục, bạn xác nhận đã đủ 16 tuổi và đồng ý với{" "}
      <Link href="/terms" className={LINK_CLASS}>
        Điều khoản sử dụng
      </Link>{" "}
      và{" "}
      <Link href="/privacy" className={LINK_CLASS}>
        Chính sách quyền riêng tư
      </Link>{" "}
      của VocaSpace.
    </p>
  );
}
