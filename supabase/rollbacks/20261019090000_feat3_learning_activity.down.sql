-- Rollback FEAT3: dừng ghi hoạt động học trước, rồi gỡ phần đọc. Chỉ chạy sau khi gỡ code gọi `feat3_learning_summary`.
-- Bảng `user_learning_activity` và lịch sử trong đó được GIỮ NGUYÊN; xóa bảng làm mất lịch sử học nên cần Owner duyệt riêng.
drop trigger if exists feat3_record_answer_activity on public.user_question_answers;
drop trigger if exists feat3_record_card_activity on public.user_flashcards;
drop function if exists public.feat3_learning_summary(uuid);
drop function if exists private.feat3_recent_topics(uuid, uuid, date, integer);
drop function if exists private.feat3_week_study_minutes(uuid, date, timestamptz);
drop function if exists private.feat3_streak(uuid, uuid, date);
drop function if exists private.feat3_day_has_activity(uuid, uuid, date);
drop function if exists private.feat3_record_answer_activity();
drop function if exists private.feat3_record_card_activity();
drop function if exists private.feat3_record_learning_activity(uuid, uuid);
drop function if exists private.feat3_ict_day_start(date);
drop function if exists private.feat3_ict_date(timestamptz);
