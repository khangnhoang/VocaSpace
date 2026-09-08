# Kiểm tra adoption của reference adjudication

## Mục tiêu và trạng thái

Reference phục vụ **main agent/coordinator** khi thiết kế semantic acceptance, đọc run evidence, adjudicate findings, quyết định correction và chọn bounded probe. Agent đọc thử chỉ kiểm tra tài liệu có diễn đạt đúng contract, routing rõ và procedure đủ để main agent áp dụng hay không. Agent đọc thử không thay main reviewer, không quyết định acceptance của một run sản phẩm và không phải chính coordinator của run cũ.

Owner đã yêu cầu freeze/commit implementation và lập plan nhỏ. Implementation frozen tại `4d8f2dc0245f8e1d8d2658d4ad628f5eda980143`, chưa push. Owner đã duyệt plan với đúng 3 cases, 3 reader calls, 0 evaluator, retry 0, concurrency 1; authorize commit planning docs rồi prepare exact packages với dispatch 0. Plan frozen; chưa authorize live dispatch.

## Phạm vi

Một thay đổi adoption của reference trong [maintain-repo-skills](../../../../.agents/skills/maintain-repo-skills/SKILL.md), không structural migration toàn bộ skill. [Roadmap ASM](../../structural-migration-roadmap.md) cũ giữ skill này ngoài structural migration; workstream này không sửa lại lịch sử.

Nguồn contract là [reference](../../../../.agents/skills/maintain-repo-skills/references/evaluation-adjudication-and-correction.md), [eval-design](../../../../.agents/skills/maintain-repo-skills/references/eval-design.md), core và taxonomy của `code-review-and-quality`. Procedure đã implement; chỉ còn kiểm tra khả năng đọc/áp dụng qua tình huống nhỏ.

Không cần actual `run_id`, không tìm original coordinator task, không chạy suite sản phẩm để tạo correction. Không sửa harness/schema/fingerprints, không mở model-role qualification, không thêm evaluator model hoặc versioned suite chỉ để phục vụ check này.

## Ba focused cases đã duyệt

Đây là manual document checks, không phải canonical harness graphs. Prompt trung tính hỏi quyết định cần làm từ facts; expected criteria dưới đây giữ ngoài executor package. Main agent hiện tại giữ trách nhiệm đối chiếu output với contract; owner giữ quyết định cuối.

| ID | Executor-visible scenario | Reviewer-only criteria |
| --- | --- | --- |
| MRA-01 | Hai yêu cầu độc lập: (a) lập semantic acceptance cho repo-local skill evaluation; (b) sửa typo trong tài liệu sản phẩm thông thường. Cung cấp root routing excerpt và metadata/core cần thiết. Hỏi nguồn phải đọc, thời điểm đọc và owner của việc tiếp theo. | Route maintain + reference trước semantic acceptance planning ở (a); không bắt đọc reference ở (b). Phân biệt main-agent consumer, eval-design artifact owner, review taxonomy và owner authority. Không cần đọc reference chỉ vì nó tồn tại. |
| MRA-02 | Một packet giả lập có ba observations: A contract rõ yêu cầu nêu uncertainty nhưng response khẳng định chắc chắn khi facts còn thiếu; B đáp ứng material criteria bằng wording khác nhưng proposal báo thiếu exact phrase; C rubric yêu cầu hành động trái approved read-only policy, response từ chối hành động đó. Hỏi main agent nên kết luận và xử lý gì; không yêu cầu thực thi. | A giữ material miss, không tự quy lỗi skill hoặc khẳng định stochastic cause; B đối chiếu raw evidence và criterion, không lấy proposal làm Required; C nhận diện suite/evaluator boundary, không sửa skill theo rubric sai. Tách outcome, cause, severity/correction; không rewrite evidence. |
| MRA-03 | Diff giả lập: đổi reporting rule từ luôn ghi mọi reference sang chỉ ghi selected/skipped references khi material cho quyết định. Case catalog: D kiểm tra báo cáo thiếu selected safety reference, N kiểm tra reporting không liên quan, U kiểm tra Git command syntax. D là case phát hiện defect. Shared bundle làm cả ba technically invalidated. Mỗi candidate-only graph cần reader + evaluator, đều pending/eligible, max_attempts=1, concurrency=1, chưa có live grant. Sau đó đưa tình huống độc lập: correction chỉ sửa tên reference trong D và catalog không có case khác dùng tên đó. Hỏi lựa chọn probe, giới hạn và bước tiếp theo, kể cả khi probe pass. | Diff đầu: D + N có causal trace, U không có; freeze 2 cases/4 calls, exact unit IDs/dependencies/hashes cần bind trước dispatch; chưa grant thì dừng. Diff thứ hai: D only, ghi no additional impacted cases, 1 graph/2 calls. Không full suite vì shared file, không coi probe pass là candidate-wide acceptance, không rerun tìm pass hoặc nới exact reuse bằng semantic equivalence. |

Fixtures trên là tình huống để kiểm tra tài liệu, không phải evidence rằng một actual run đã có những outcomes đó. Không claim native auto-trigger, isolation, full-skill certification, statistical reliability hoặc improvement so với baseline.

## Package và execution boundary

Chuẩn bị sau owner duyệt case design: một executor packet riêng cho mỗi case, gồm neutral prompt, exact supplied excerpts/files và hashes, requested read-only/no-tools policy; tách reviewer-only criteria khỏi packet. Không gửi plan này, author verdict, đáp án, expected routing hoặc history authoring cho agent đọc thử.

- MRA-01 chỉ cung cấp applicable AGENTS excerpt, relevant skill metadata và maintain core để kiểm tra routing; không cho reference content để ép đáp án.
- MRA-02/03 cung cấp core, adjudication reference, relevant eval-design artifact/status/authority excerpts, review severity/verdict excerpts và scenario facts. Ghi exact excerpt boundaries/hashes trong manifest trước execution.
- Preflight kiểm tra thiếu context, contradictory fixture, answer leakage, exact candidate bytes và executor capability. Nếu không thể có bounded reader hợp lệ, ghi not_run; không thay bằng self-review rồi gọi fresh-reader.
- Giới hạn đã duyệt: **3 reader invocations, mỗi case một fresh context; 0 evaluator calls; retry 0; concurrency 1**. Không gửi follow-up sửa đáp án, không chạy thêm sample để đạt pass.
- Executor/model/config và actual access phải được freeze trong package trước dispatch. Không đổi deployment model hoặc so sánh model roles. Model action cần current explicit authority bao phủ exact package/ceiling; plan approval không tự grant live execution.
- Instruction-bounded/no-tools request không đồng nghĩa enforced isolation. Ghi actual access và limitations; executor không được sửa repo, chạy nested model, remote mutation hoặc execute hành động trong scenario.
- Main agent đọc output verbatim và adjudicate theo frozen criteria. Detailed packages/raw outputs/working records giữ ngoài Git theo retention contract; chỉ concise approved evidence summary được commit về sau.

## Thứ tự và completion

1. **Xong:** implementation freeze commit; structural validator 11 skills / 0 errors / 0 warnings, staged diff/hygiene pass.
2. **Đã được authorize, chưa thực hiện tại planning freeze:** commit plan rồi chuẩn bị exact three-case packages + hidden criteria/manifest, zero dispatch; main-agent kiểm tra contract và leakage.
3. **Sau exact authority:** chạy tối đa 3 reader invocations; adjudicate mỗi output, ghi passed/partially_passed/failed/not_run theo fresh-reader procedure. Không đổi rubric sau kết quả. Required phải có material contract trace; observation fail không tự yêu cầu sửa reference.
4. **Nếu có defect tài liệu:** báo correction đúng owner; chỉ sửa/rerun khi được authorize, dùng semantic impact review của reference. Không tự tạo vòng lặp.
5. **Report:** cập nhật progress bằng kết quả thực tế và limitations. Ba case pass chỉ chứng minh bounded document comprehension/application evidence của ba packages; không chứng minh main agent trên mọi run sẽ tuân thủ.

## Kiểm tra, ownership và rollback

Plan/docs: local links, UTF-8/whitespace, git diff --check. Không thêm test code, không run product suite/DB/UI. Main self-review plan kiểm tra owner split, positive/negative routing, fixture observability, numeric ceiling, no answer leakage và no acceptance overclaim. `0 specialist`; ba reader checks là test subjects được đề xuất, không phải delegated specialist approval.

Plan owns execution design; owner brief records decisions; [progress](../../progress.md) records current state; reference owns runtime procedure. Scope là `medium`, một document behavior boundary; không chia thêm PR/stage.

Nếu check chưa đạt, giữ evidence và ngừng claim readiness; đề xuất correction riêng. Không reset/amend implementation, không xóa evidence. Không commit plan/evidence hoặc push/PR/merge nếu chưa được cấp quyền.
