"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { getCourseLearningSummary } from "@/app/actions/learning-activity";
import type { CourseLearningSummaryResult } from "@/lib/schemas/learning-activity";

const VN_TIME_ZONE = "Asia/Ho_Chi_Minh";

// Chỉ để biết "đã sang ngày mới chưa" khi tab mở qua nửa đêm; chuỗi và ngày học vẫn do SQL tính (G3).
function vnDayKey() {
  return new Intl.DateTimeFormat("en-CA", { timeZone: VN_TIME_ZONE }).format(new Date());
}

/**
 * FEAT3 AC7: chuỗi ngày học của khóa trong không gian học. Trang truyền kết quả đọc lúc tải; sau một hành động học đã lưu,
 * `noteLearningAction` đọc lại từ server (ngày và chuỗi do SQL tính, G3) nhưng chỉ khi hôm nay chưa có hành động nào:
 * khi hôm nay (giờ Asia/Ho_Chi_Minh) đã học, các hành động sau không đổi chuỗi nên không tốn thêm truy vấn; sang ngày mới trong
 * cùng một phiên thì hành động đầu tiên đọc lại. Một lần đọc tại một thời điểm, và
 * một lần đọc lỗi không xóa kết quả tốt đã có (AC10): lần hành động sau thử lại.
 */
export function useCourseLearningSummary(courseId: string, initial: CourseLearningSummaryResult | undefined) {
  const [summary, setSummary] = useState(initial);
  // Ngày (giờ VN) mà kết quả đã báo là có học; sang ngày khác thì không còn đúng.
  const studiedDayRef = useRef<string | null>(initial?.success === true && initial.data.studiedToday ? vnDayKey() : null);
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
    const dayKey = vnDayKey();
    if (initial === undefined || studiedDayRef.current === dayKey || inFlightRef.current) return;
    inFlightRef.current = true;
    getCourseLearningSummary(courseId)
      .then((result) => {
        if (!result.success) return;
        if (result.data.studiedToday) studiedDayRef.current = dayKey;
        if (aliveRef.current) setSummary(result);
      })
      .catch(() => undefined)
      .finally(() => {
        inFlightRef.current = false;
      });
  }, [courseId, initial]);

  return { summary, noteLearningAction };
}
