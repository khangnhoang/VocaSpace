-- Rollback TPORT1: chỉ chạy sau khi gỡ code gọi `get_teacher_course_portfolio`. Hàm chỉ đọc nên không có dữ liệu cần hoàn tác.
drop function if exists public.get_teacher_course_portfolio();
