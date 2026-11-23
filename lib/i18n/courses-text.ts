import viCourses from "@/messages/vi/courses.json";
import { staticTranslate, type Translate } from "./translate";

// Tiếng Việt lấy thẳng từ catalog `courses` cho các thành phần được gọi không qua provider (test gọi hàm trực tiếp, H7).
export const viCoursesText = staticTranslate("courses", viCourses);

export type RetryLabels = { retry: string; pending: string };

/** Nhãn nút "Thử lại" theo bản dịch `t` của namespace `courses`; nút mặc định dùng tiếng Việt khi người gọi không truyền. */
export function retryLabels(t: Translate): RetryLabels {
  return { retry: t("retry.retry"), pending: t("retry.pending") };
}
