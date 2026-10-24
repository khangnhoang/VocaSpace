import type { Metadata } from "next";
import Link from "next/link";
import { LegalDocument, LegalSection } from "../_components/LegalDocument";

export const metadata: Metadata = {
  title: "Chính sách quyền riêng tư | VocaSpace",
};

// Nội dung là bản đã được Owner duyệt (A4b plan, Appendix A). Đổi chữ phải qua Owner; đổi cách thu thập dữ liệu,
// bên thứ ba hoặc cookie trong code thì phải cập nhật trang này cùng PR (G1, G2).
export default function PrivacyPage() {
  return (
    <LegalDocument title="Chính sách quyền riêng tư">
      <p>
        VocaSpace là một dự án do nhóm phát triển VocaSpace vận hành. Chính sách này cho biết chúng tôi thu thập dữ
        liệu gì khi bạn dùng VocaSpace, dùng để làm gì và bạn có những quyền gì.
      </p>

      <LegalSection title="1. Dữ liệu chúng tôi thu thập">
        <ul>
          <li>
            <strong>Thông tin tài khoản:</strong> email và mật khẩu. Mật khẩu được lưu dưới dạng băm (mã hoá một
            chiều), không lưu ở dạng đọc được.
          </li>
          <li>
            <strong>Thông tin hồ sơ bạn cung cấp:</strong> tên đăng nhập, họ tên, số điện thoại, ngày sinh, giới tính
            và ảnh đại diện.
          </li>
          <li>
            <strong>Khi đăng nhập bằng Google:</strong> email, họ tên và ảnh đại diện từ tài khoản Google của bạn.
            Chúng tôi không nhận mật khẩu Google và không truy cập dữ liệu khác trong tài khoản Google.
          </li>
          <li>
            <strong>Dữ liệu học tập:</strong> khoá học bạn tham gia, tiến độ học, trạng thái mở khoá các nội dung học,
            bài làm và kết quả ôn tập. Mỗi khi bạn trả lời một câu hỏi hoặc chấm điểm một thẻ ôn tập, chúng tôi ghi
            lại thời điểm đó (theo từng phút, kèm khoá học và bài học liên quan) để hiển thị chuỗi ngày học, các bài
            học gần đây và thời gian học ước tính của bạn.
          </li>
          <li>
            <strong>Nội dung của giáo viên:</strong> khoá học, bài học, câu hỏi, hình ảnh và tệp mà giáo viên tải lên.
          </li>
          <li>
            <strong>Thông tin thanh toán:</strong> mã đơn hàng, khoá học, số tiền, mã giảm giá đã dùng và trạng thái
            thanh toán. Bạn vẫn xem được tên khoá học đã thanh toán trong lịch sử thanh toán của mình, kể cả khi khoá
            học đó sau này bị ẩn. Chúng tôi không lưu số thẻ hay thông tin tài khoản ngân hàng của bạn.
          </li>
        </ul>
      </LegalSection>

      <LegalSection title="2. Chúng tôi dùng dữ liệu để làm gì">
        <ul>
          <li>Tạo và duy trì tài khoản, cho phép bạn đăng nhập.</li>
          <li>Gửi email xác minh tài khoản và khôi phục mật khẩu.</li>
          <li>Mở khoá học, lưu tiến độ và hiển thị kết quả học tập của bạn.</li>
          <li>Xử lý thanh toán khoá học.</li>
          <li>Hỗ trợ khi bạn liên hệ, giữ an toàn cho hệ thống và xử lý vi phạm.</li>
        </ul>
        <p>
          <strong>Ai xem được thông tin của bạn:</strong> tên đăng nhập, họ tên và ảnh đại diện có thể hiển thị cho
          người dùng khác và khách truy cập (ví dụ tên giáo viên trên trang khoá học). Ảnh đại diện được lưu ở dạng
          công khai, ai có đường dẫn ảnh đều xem được. Email, số điện thoại, ngày sinh và giới tính chỉ bạn và quản
          trị viên VocaSpace xem được; riêng email còn có thể hiển thị cho các cộng tác viên có quyền xem danh sách
          thành viên, thông tin tác giả/người duyệt hoặc ghi chú của khoá học, bao gồm người chỉ xem trước và cộng
          tác viên có tài khoản học viên.
        </p>
        <p>
          Dữ liệu về thời điểm học của bạn chỉ bạn xem được trong VocaSpace; giáo viên, học viên khác và quản trị viên
          không xem được dữ liệu này.
        </p>
        <p>
          Giáo viên và cộng tác viên soạn nội dung của một khoá học xem được số liệu tổng hợp của khoá học đó: số học
          viên ghi danh theo tháng và số học viên chưa bắt đầu, đang học hoặc đã hoàn thành. Số liệu này không kèm tên
          hay thông tin tài khoản của bạn, nhưng với khoá học có rất ít học viên, số liệu có thể phản ánh tiến độ của
          một người cụ thể.
        </p>
        <p>
          Khi quản trị viên VocaSpace duyệt, hạ về bản nháp hoặc gỡ một khoá học, họ sẽ xem được tên tác giả và nội dung của
          khoá học đó.
        </p>
        <p>
          Chúng tôi không bán dữ liệu của bạn, không dùng dữ liệu để quảng cáo và không theo dõi hành vi của bạn trên
          các trang web khác.
        </p>
      </LegalSection>

      <LegalSection title="3. Cookie">
        <p>
          VocaSpace dùng cookie để giữ phiên đăng nhập và để ghi nhớ trạng thái giao diện (ví dụ thanh bên đang đóng
          hay mở). Chúng tôi không dùng cookie quảng cáo hay công cụ phân tích hành vi.
        </p>
      </LegalSection>

      <LegalSection title="4. Dịch vụ bên thứ ba">
        <p>
          Để vận hành, VocaSpace dùng các dịch vụ sau. Mỗi dịch vụ chỉ nhận phần dữ liệu cần cho việc của nó, và có
          thể lưu dữ liệu tại máy chủ ngoài Việt Nam:
        </p>
        <ul>
          <li>
            <strong>Supabase:</strong> lưu cơ sở dữ liệu, tài khoản và tệp tải lên.
          </li>
          <li>
            <strong>Vercel:</strong> lưu trữ và chạy website.
          </li>
          <li>
            <strong>Resend:</strong> gửi email xác minh và khôi phục mật khẩu.
          </li>
          <li>
            <strong>Google:</strong> đăng nhập bằng Google, nếu bạn chọn cách này.
          </li>
          <li>
            <strong>PayOS:</strong> xử lý thanh toán khoá học.
          </li>
          <li>
            <strong>QR Server (api.qrserver.com):</strong> nhận nội dung mã QR của đơn hàng để tạo ảnh mã QR thanh
            toán.
          </li>
          <li>
            <strong>Cloudflare:</strong> chuyển tiếp email bạn gửi tới support@vocaspace.com.
          </li>
          <li>
            <strong>DiceBear:</strong> tạo ảnh đại diện mặc định trong trang quản trị, chỉ nhận mã định danh của tài
            khoản (không nhận email).
          </li>
        </ul>
        <p>
          Một số hình ảnh trên website được tải trực tiếp từ dịch vụ lưu trữ ảnh bên ngoài (ví dụ GitHub, Unsplash,
          hoặc địa chỉ ảnh do giáo viên dùng cho khoá học). Khi đó trình duyệt của bạn gửi tới các dịch vụ này thông
          tin kỹ thuật thông thường như địa chỉ IP.
        </p>
      </LegalSection>

      <LegalSection title="5. Lưu trữ và xoá dữ liệu">
        <p>
          Chúng tôi giữ dữ liệu của bạn khi tài khoản còn hoạt động. Bạn có thể yêu cầu xoá tài khoản bằng cách gửi
          email tới support@vocaspace.com từ email của tài khoản; chúng tôi sẽ xoá trong vòng 30 ngày. Thông tin đơn
          hàng có thể được giữ lâu hơn chỉ khi cần để giải quyết một vấn đề thanh toán.
        </p>
      </LegalSection>

      <LegalSection title="6. Quyền của bạn">
        <ul>
          <li>Xem và sửa thông tin hồ sơ tại trang Hồ sơ.</li>
          <li>Yêu cầu bản sao dữ liệu hoặc yêu cầu xoá tài khoản qua email.</li>
          <li>
            Ngừng đăng nhập bằng Google bất kỳ lúc nào; bạn vẫn có thể đặt mật khẩu qua &quot;Quên mật khẩu&quot;.
          </li>
        </ul>
      </LegalSection>

      <LegalSection title="7. Bảo mật">
        <p>
          Kết nối tới VocaSpace được mã hoá bằng HTTPS, và mỗi người dùng chỉ truy cập được dữ liệu mà họ có quyền
          xem. Không hệ thống nào an toàn tuyệt đối; nếu phát hiện vấn đề bảo mật, hãy báo cho chúng tôi qua email bên
          dưới.
        </p>
      </LegalSection>

      <LegalSection title="8. Người dưới 16 tuổi">
        <p>
          VocaSpace dành cho người từ 16 tuổi trở lên. Chúng tôi không cố ý thu thập dữ liệu của người dưới 16 tuổi.
          Nếu bạn biết một người dưới 16 tuổi đã tạo tài khoản, hãy liên hệ để chúng tôi xoá dữ liệu đó.
        </p>
      </LegalSection>

      <LegalSection title="9. Thay đổi chính sách">
        <p>
          Khi chính sách thay đổi, chúng tôi cập nhật trang này và ngày &quot;Cập nhật lần cuối&quot; ở đầu trang. Với
          thay đổi quan trọng, chúng tôi sẽ thông báo trên website.
        </p>
      </LegalSection>

      <LegalSection title="10. Liên hệ">
        <p>
          Mọi câu hỏi về quyền riêng tư, xin gửi tới <a href="mailto:support@vocaspace.com">support@vocaspace.com</a>.
        </p>
        <p>
          Xem thêm: <Link href="/terms">Điều khoản sử dụng</Link>.
        </p>
      </LegalSection>
    </LegalDocument>
  );
}
