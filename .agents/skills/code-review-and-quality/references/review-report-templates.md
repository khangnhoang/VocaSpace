# Review report templates

Read this reference for a formal multi-finding report or specialist package that needs the full template. Skip it when a small review has no actionable finding and needs only a compact verdict.

## Finding format

```txt
[Mức độ (canonical severity)] <tiêu đề ngắn>

Vị trí:
- <file và symbol hoặc line>

Vấn đề:
- <nội dung chưa đúng>

Tác động:
- <hệ quả quan sát được hoặc ảnh hưởng bảo trì>

Bằng chứng:
- <code, test, type, migration hoặc repository fact>

Thay đổi bắt buộc:
- <correction hợp lệ nhỏ nhất>
```

Với `Đề xuất (Suggestion)`, dùng `Cải thiện đề xuất` thay cho `Thay đổi bắt buộc`.

Mọi finding blocking (`Critical` hoặc `Required`) phải có bằng chứng và correction có thể thực hiện. `Suggestion`, `Nit` và `FYI` là non-blocking; cách Việt hóa nhãn không được làm thay đổi phân loại này.

## Báo cáo review

Use the language explicitly requested by the owner. When the owner communicates in Vietnamese and does not request otherwise, use natural Vietnamese headings and prose while preserving code identifiers, commands, paths, exact errors, machine-readable values, and canonical severity/verdict mappings.

```txt
## Phạm vi review
- Mục tiêu:
- Baseline và phạm vi diff:
- Skill liên quan:
- Bằng chứng kiểm tra đã rà soát:

## Tóm tắt
- Nội dung thay đổi:
- Đánh giá tổng thể:

## Phát hiện
### Nghiêm trọng (`Critical`)
### Bắt buộc (`Required`)
### Đề xuất (`Suggestion`)
### Tiểu tiết (`Nit`)
### Thông tin (`FYI`)

## Trạng thái kiểm tra
- Tự động:
- Manual QA:
- Chưa kiểm tra hoặc bị chặn:

## Rà soát phạm vi
- Dự kiến:
- Không liên quan:
- Còn thiếu:

## Thứ tự review đề xuất
1. ...

## Kết luận
- ...

## Hành động tiếp theo
- ...
```

Omit empty verbose sections for small reviews, but always state the verdict and next action.
