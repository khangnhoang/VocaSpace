# Production Release Gate

## Mục tiêu

Production release gate dùng Vercel Deployment Checks để giữ production deployment chưa được gán vào custom production domains cho đến khi check bắt buộc pass.

Vercel Git Integration vẫn là cơ chế build/deploy. GitHub Actions chỉ cung cấp tín hiệu ổn định `production-gate`.

## Cấu hình Vercel bắt buộc

Các bước này làm thủ công trong Vercel UI:

1. Mở Vercel project đã kết nối với GitHub.
2. Vào Project Settings -> Deployment Checks.
3. Chọn Add Check.
4. Chọn provider GitHub.
5. Chọn check `production-gate`.
6. Đánh dấu check này là required cho Production.
7. Giữ Vercel Git Integration enabled.
8. Giữ production automatic aliasing enabled.
9. Sau workflow run đầu tiên có `production-gate`, xác nhận Vercel thấy đúng check name này.

## Giới hạn phạm vi

- Không dùng Vercel CLI deploy trong phase này.
- Không dùng Jenkins.
- Không giả định có GitHub branch protection cho private repo này.
- Không tắt Vercel Git Integration.
- Không thêm `vercel.json` để disable auto-deploy.

## Caveats

- `Force Promote` trong Vercel có thể bypass gate.
- Manual Vercel actions bởi người có đủ quyền có thể bypass repo process.
- Gate này không ngăn direct push vào `main`; nó chỉ bảo vệ production domain promotion.
- Không rename `production-gate` nếu chưa update Vercel Deployment Checks.
- Tránh duplicate job name `production-gate` ở workflow khác.
- Nếu GitHub Actions bị disable hoặc Vercel không đọc được GitHub checks, deployment có thể nằm chờ và chưa được promote cho đến khi được sửa.

## Rollback

Rollback production từ Vercel dashboard nếu cần. Sau rollback, kiểm tra custom production domains đang trỏ về deployment mong muốn.
