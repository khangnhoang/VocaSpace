DROP POLICY IF EXISTS "Cards - Staff Select Deleted" ON public.cards;

-- Khi xóa mềm, bản ghi mới có removed_at khác NULL và cần còn nhìn thấy được
-- với giáo viên quản trị khóa học để UPDATE hoàn tất; học viên và anonymous vẫn
-- chỉ đi qua policy đọc thẻ đang hoạt động.
CREATE POLICY "Cards - Staff Select Deleted"
ON public.cards
FOR SELECT
TO authenticated
USING (
  removed_at IS NOT NULL
  AND EXISTS (
    SELECT 1
    FROM public.topics t
    WHERE t.id = cards.topic_id
      AND public.has_course_management_access(t.course_id)
  )
);
