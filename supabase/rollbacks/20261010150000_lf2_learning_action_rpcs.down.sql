-- Rollback của 20261010150000_lf2_learning_action_rpcs.sql: chỉ gỡ ba hàm, không đụng cổng MEMORY-002.
-- Chạy SAU khi đã deploy lại code không còn gọi hai RPC `lf2_submit_*`.
-- Không nằm trong supabase/migrations nên Supabase CLI không tự áp dụng; chạy thủ công khi cần quay lui.
drop function public.lf2_submit_card_review(uuid, uuid, timestamptz, jsonb, smallint, timestamptz);
drop function public.lf2_submit_question_answer(uuid, uuid);
drop function private.lf2_answer_precheck(uuid, uuid);
