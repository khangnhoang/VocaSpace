-- Trả lại quyền execute cho anon như trước GRANT-001; hai hàm vẫn tự kiểm tra auth.uid() bên trong.
grant execute on function public.create_chapter_ordered(uuid, text) to anon;
grant execute on function public.move_chapter_order(uuid, text) to anon;
