"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { getCourseLearningSummary } from "@/app/actions/learning-activity";
import type { CourseLearningSummaryResult } from "@/lib/schemas/learning-activity";

/**
 * FEAT3 AC7: chuỗi ngày học của khóa trong không gian học. Trang truyền kết quả đọc lúc tải; sau mỗi hành động học đã lưu,
 * `noteLearningAction` đọc lại từ server. Ngày và chuỗi do SQL tính (G3) nên phía client không quyết định gì theo đồng hồ
 * trình duyệt (tab mở qua nửa đêm, hydrate muộn hay đồng hồ lệch đều đúng). Một lần đọc tại một thời điểm: hành động đến khi
 * đang đọc được gộp thành một lần đọc lại sau đó, nên kết quả cuối luôn phản ánh hành động cuối. Một lần đọc lỗi không xóa
 * kết quả tốt đã có (AC10): hành động sau thử lại.
 */
export function useCourseLearningSummary(courseId: string, initial: CourseLearningSummaryResult | undefined) {
  const [summary, setSummary] = useState(initial);
  const inFlightRef = useRef(false);
  const pendingRef = useRef(false);
  const aliveRef = useRef(true);

  useEffect(() => {
    aliveRef.current = true;
    return () => {
      aliveRef.current = false;
    };
  }, []);

  const noteLearningAction = useCallback(() => {
    // Trang không truyền kết quả nào (không yêu cầu chuỗi ngày học) thì không đọc thêm.
    if (initial === undefined) return;
    if (inFlightRef.current) {
      pendingRef.current = true;
      return;
    }

    const read = () => {
      inFlightRef.current = true;
      pendingRef.current = false;
      getCourseLearningSummary(courseId)
        .then((result) => {
          if (result.success && aliveRef.current) setSummary(result);
        })
        .catch(() => undefined)
        .finally(() => {
          inFlightRef.current = false;
          if (pendingRef.current && aliveRef.current) read();
        });
    };
    read();
  }, [courseId, initial]);

  return { summary, noteLearningAction };
}
