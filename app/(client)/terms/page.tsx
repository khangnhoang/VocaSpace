import type { Metadata } from "next";
import Link from "next/link";
import { LegalDocument, LegalSection } from "../_components/LegalDocument";

export const metadata: Metadata = {
  title: "Điều khoản sử dụng | VocaSpace",
};

// Nội dung là bản đã được Owner duyệt (A4b plan, Appendix B). Đổi chữ phải qua Owner (G1).
export default function TermsPage() {
  return (
    <LegalDocument title="Điều khoản sử dụng">
      <p>
        VocaSpace là một dự án do nhóm phát triển VocaSpace vận hành: nền tảng học từ vựng trực tuyến, nơi giáo viên
        tạo khoá học và học viên học theo khoá học. Khi tạo tài khoản, đăng nhập hoặc sử dụng VocaSpace, bạn đồng ý với
        các điều khoản dưới đây và với <Link href="/privacy">Chính sách quyền riêng tư</Link>.
      </p>

      <LegalSection title="1. Độ tuổi">
        <p>Bạn phải từ 16 tuổi trở lên để sử dụng VocaSpace.</p>
      </LegalSection>

      <LegalSection title="2. Tài khoản">
        <ul>
          <li>Bạn cung cấp thông tin đúng và giữ bí mật mật khẩu của mình.</li>
          <li>Bạn chịu trách nhiệm về hoạt động diễn ra trong tài khoản của mình.</li>
          <li>
            Nếu bạn đăng nhập bằng Google với email trùng với một tài khoản VocaSpace đã có, bạn sẽ vào chính tài
            khoản đó.
          </li>
          <li>Nếu nghi ngờ tài khoản bị người khác sử dụng, hãy đổi mật khẩu và báo cho chúng tôi.</li>
        </ul>
      </LegalSection>

      <LegalSection title="3. Quy tắc sử dụng">
        <p>Bạn không được:</p>
        <ul>
          <li>dùng VocaSpace cho mục đích trái pháp luật;</li>
          <li>tải lên nội dung vi phạm bản quyền, xúc phạm, lừa đảo hoặc độc hại;</li>
          <li>truy cập trái phép tài khoản, dữ liệu hoặc hệ thống của VocaSpace;</li>
          <li>làm gián đoạn hoặc gây quá tải hệ thống;</li>
          <li>chia sẻ hoặc bán lại quyền truy cập khoá học trả phí.</li>
        </ul>
      </LegalSection>

      <LegalSection title="4. Nội dung của giáo viên">
        <p>
          Giáo viên giữ quyền sở hữu nội dung mình tạo và chịu trách nhiệm bảo đảm có quyền sử dụng mọi nội dung tải
          lên, bao gồm bản quyền hình ảnh, âm thanh và tài liệu. Khi đăng nội dung lên VocaSpace, giáo viên cho phép
          VocaSpace lưu trữ và hiển thị nội dung đó cho người học để vận hành dịch vụ. VocaSpace có thể gỡ nội dung vi
          phạm điều khoản này hoặc pháp luật.
        </p>
      </LegalSection>

      <LegalSection title="5. Khoá học và thanh toán">
        <ul>
          <li>
            Khoá học trả phí được thanh toán qua PayOS. Khi thanh toán thành công, khoá học được mở trong tài khoản
            của bạn.
          </li>
          <li>
            Khoản thanh toán thành công không được hoàn lại, trừ khi lỗi từ hệ thống (ví dụ đã trừ tiền nhưng khoá học
            không được mở); khi đó VocaSpace sẽ mở khoá học hoặc hoàn tiền.
          </li>
        </ul>
      </LegalSection>

      <LegalSection title="6. Khoá học bị gỡ">
        <p>
          Khoá học có thể bị gỡ khi giáo viên ngừng cung cấp hoặc khi vi phạm chính sách; khi đó bạn có thể không truy
          cập được khoá học nữa. Nếu bạn đã thanh toán cho khoá học bị gỡ, hãy liên hệ support@vocaspace.com,
          VocaSpace sẽ hỗ trợ phù hợp, ví dụ cấp mã giảm giá cho khoá học khác.
        </p>
      </LegalSection>

      <LegalSection title="7. Tạm khoá và chấm dứt">
        <p>
          VocaSpace có thể tạm khoá hoặc xoá tài khoản vi phạm các điều khoản này. Bạn có thể ngừng sử dụng và yêu cầu
          xoá tài khoản bất kỳ lúc nào theo <Link href="/privacy">Chính sách quyền riêng tư</Link>.
        </p>
      </LegalSection>

      <LegalSection title="8. Giới hạn trách nhiệm">
        <p>
          VocaSpace được cung cấp theo hiện trạng. Chúng tôi cố gắng giữ dịch vụ hoạt động ổn định nhưng không cam kết
          dịch vụ luôn liên tục hoặc không có lỗi. Trong phạm vi pháp luật cho phép, VocaSpace không chịu trách nhiệm
          cho thiệt hại gián tiếp phát sinh từ việc sử dụng dịch vụ.
        </p>
      </LegalSection>

      <LegalSection title="9. Thay đổi điều khoản">
        <p>
          Khi điều khoản thay đổi, chúng tôi cập nhật trang này và ngày &quot;Cập nhật lần cuối&quot; ở đầu trang. Với
          thay đổi quan trọng, chúng tôi sẽ thông báo trên website. Tiếp tục sử dụng VocaSpace sau thay đổi nghĩa là
          bạn đồng ý với điều khoản mới.
        </p>
      </LegalSection>

      <LegalSection title="10. Liên hệ">
        <p>
          Mọi câu hỏi về điều khoản, xin gửi tới <a href="mailto:support@vocaspace.com">support@vocaspace.com</a>.
        </p>
      </LegalSection>
    </LegalDocument>
  );
}
