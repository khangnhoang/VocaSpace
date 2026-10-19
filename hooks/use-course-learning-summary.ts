"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { getCourseLearningSummary } from "@/app/actions/learning-activity";
import type { CourseLearningSummaryResult } from "@/lib/schemas/learning-activity";

/**
 * FEAT3 AC7: chuỗi ngày học của khóa trong không gian học. Trang truyền kết quả đọc lúc tải; sau một hành động học đã lưu,
 * `noteLearningAction` đọc lại từ server (ngày và chuỗi do SQL tính, G3) nhưng chỉ khi hôm nay chưa có hành động nào:
 * khi hôm nay đã học, các hành động sau không đổi chuỗi nên không tốn thêm truy vấn. Một lần đọc tại một thời điểm, và
 * một lần đọc lỗi không xóa kết quả tốt đã có (AC10): lần hành động sau thử lại.
 */
export function useCourseLearningSummary(courseId: string, initial: CourseLearningSummaryResult | undefined) {
  const [summary, setSummary] = useState(initial);
  const studiedTodayRef = useRef(initial?.success === true && initial.data.studiedToday);
  const inFlightRef = useRef(false);
  const aliveRef = useRef(true);

  useEffect(() => {
    aliveRef.current = true;
    return () => {
      aliveRef.current = false;
    };
  }, []);

  const noteLearningAction = useCallback(() => {
    // Trang không truyền kết quả nào (không yêu cầu chuỗi ngày học) thì không đọc thêm.
    if (initial === undefined || studiedTodayRef.current || inFlightRef.current) return;
    inFlightRef.current = true;
    getCourseLearningSummary(courseId)
      .then((result) => {
        if (!result.success) return;
        if (result.data.studiedToday) studiedTodayRef.current = true;
        if (aliveRef.current) setSummary(result);
      })
      .catch(() => undefined)
      .finally(() => {
        inFlightRef.current = false;
      });
  }, [courseId, initial]);

  return { summary, noteLearningAction };
}
