-- AUTH-016: /register lưu 'nam'/'nữ' còn /profile dùng 'male'/'female', nên user đăng ký xong
-- không lưu được /profile. Một bộ giá trị chuẩn: male, female, other (tiếng Việt chỉ ở nhãn).
-- Chuyển dữ liệu cũ trước rồi mới thêm CHECK để migration chạy được trên database đã có dữ liệu.
-- Chỉ push sau khi bản app gửi male/female/other đã deploy READY; nếu không, mọi đăng ký bằng
-- app cũ (gửi 'nam'/'nữ') sẽ lỗi ở handle_new_user.
update public.profiles set gender = 'male' where gender = 'nam';
update public.profiles set gender = 'female' where gender = 'nữ';

alter table public.profiles
  add constraint profiles_gender_check
  check (gender is null or gender in ('male', 'female', 'other'));
