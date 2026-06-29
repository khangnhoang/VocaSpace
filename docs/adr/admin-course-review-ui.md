# ADR: UI duyệt khóa học cho admin

## Trạng thái

Bản ghi quyết định kế thừa. Tài liệu này chỉ giữ lại các quyết định sản phẩm và thiết kế từ SOP cũ về admin course review UI. Đây không phải workflow triển khai đang hoạt động.

## Bối cảnh

VocaSpace cần một màn hình cho admin kiểm tra các khóa học đã gửi duyệt, approve khóa học đủ điều kiện publish, hoặc reject kèm feedback rõ ràng để giáo viên biết cần sửa gì.

Tài liệu gốc được viết cho workflow Gemini Web kiểu paste code thủ công. Workflow đó không còn khớp với quy trình Codex hiện tại của repo, nên các hướng dẫn từng bước, push instruction, PR template cũ, và chỉ dẫn riêng cho Gemini Web đã bị loại bỏ.

## Quyết định thiết kế

UI duyệt khóa học cho admin nên là một màn hình vận hành rõ ràng, dễ đọc, không mang phong cách landing page hoặc trang marketing:

* hiển thị các khóa học có thể duyệt trong bảng hoặc danh sách dễ scan;
* chỉ thêm search/filter khi có dữ liệu thật hoặc contract rõ ràng;
* tách rõ hành động approve và reject, có confirmation dialog cho hành động quan trọng;
* yêu cầu lý do reject rõ ràng trước khi gửi;
* giữ lại input hữu ích nếu lỗi có thể recover;
* chặn double submit khi action đang pending;
* hiển thị success/failure feedback trung thực, không giả vờ Server Action đã thành công;
* chỉ hiển thị rejection feedback cho giáo viên trong bề mặt quản lý khóa học của chính họ;
* validate input bằng Zod ở boundary client/server phù hợp;
* không đưa các field server-owned như reviewer identity, status transition, hoặc audit metadata thành input có thể sửa trong UI.

## Lý do

Approve hoặc reject khóa học ảnh hưởng trực tiếp tới nội dung learner có thể thấy và cách giáo viên hiểu trạng thái publish của khóa học. Vì vậy UI cần hành động dễ đoán, hậu quả rõ ràng, và feedback trung thực từ backend contract thật.

Zod vẫn là nguồn sự thật chính cho input không đáng tin cậy. Client-side validation có thể cải thiện trải nghiệm, nhưng server-side validation và authorization mới là nơi enforce thật.

## Lợi ích

* Admin có một bề mặt tập trung để duyệt khóa học.
* Giáo viên nhận được feedback có thể hành động được mà không lộ thông tin chỉ dành cho admin.
* UI tránh trạng thái success giả khi backend action chưa có hoặc chạy lỗi.
* Validation đi cùng quy tắc schema/type-boundary chung của VocaSpace.

## Tradeoff

* Màn hình admin nên ưu tiên tính vận hành, nên sẽ ít trang trí hơn các bề mặt client/marketing.
* Placeholder wiring chỉ chấp nhận được khi bị disable rõ hoặc được ghi là chưa hoàn tất; không được trông như production success.
* Các thay đổi lớn hơn như workflow review mới, RLS, migrations, hoặc status model mới phải nằm trong backend/schema work được duyệt riêng.

## Ghi chú workflow hiện tại

Khi triển khai, review, test, commit, hoặc chuẩn bị PR, dùng `AGENTS.md` và các skill hiện hành của repo. Không push hoặc tạo commit nếu project owner chưa yêu cầu rõ.
