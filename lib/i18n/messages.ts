import enAuth from "@/messages/en/auth.json";
import enCommon from "@/messages/en/common.json";
import enCourses from "@/messages/en/courses.json";
import enFlashcard from "@/messages/en/flashcard.json";
import enHome from "@/messages/en/home.json";
import enLearn from "@/messages/en/learn.json";
import enLearning from "@/messages/en/learning.json";
import enProfile from "@/messages/en/profile.json";
import enTeacherMedia from "@/messages/en/teacherMedia.json";
import enValidation from "@/messages/en/validation.json";
import viAuth from "@/messages/vi/auth.json";
import viCommon from "@/messages/vi/common.json";
import viCourses from "@/messages/vi/courses.json";
import viFlashcard from "@/messages/vi/flashcard.json";
import viHome from "@/messages/vi/home.json";
import viLearn from "@/messages/vi/learn.json";
import viLearning from "@/messages/vi/learning.json";
import viProfile from "@/messages/vi/profile.json";
import viTeacherMedia from "@/messages/vi/teacherMedia.json";
import viValidation from "@/messages/vi/validation.json";
import type { Locale } from "./config";

// Mỗi namespace là một tệp riêng (H2) để các unit sau thêm namespace mà ít đụng nhau. Bộ tiếng Việt là bộ gốc về kiểu;
// test parity bắt lệch khóa giữa hai ngôn ngữ.
const viMessages = {
  common: viCommon,
  validation: viValidation,
  auth: viAuth,
  home: viHome,
  flashcard: viFlashcard,
  courses: viCourses,
  learning: viLearning,
  learn: viLearn,
  profile: viProfile,
  teacherMedia: viTeacherMedia,
};
export type AppMessages = typeof viMessages;

export const MESSAGES: Record<Locale, AppMessages> = {
  vi: viMessages,
  en: {
    common: enCommon,
    validation: enValidation,
    auth: enAuth,
    home: enHome,
    flashcard: enFlashcard,
    courses: enCourses,
    learning: enLearning,
    learn: enLearn,
    profile: enProfile,
    teacherMedia: enTeacherMedia,
  },
};

// G5/G4: client chỉ nhận các namespace mà subtree của nó dùng. `common` và `validation` luôn có vì provider gốc gửi chúng,
// và provider lồng nhau thay (không gộp) messages của provider cha khi truyền `messages` (use-intl), nên mỗi provider lồng
// phải liệt kê đủ cả hai.
export const CLIENT_NAMESPACES = ["common", "validation"] as const satisfies readonly (keyof AppMessages)[];

export function pickClientMessages(locale: Locale, extra: readonly (keyof AppMessages)[] = []) {
  const messages = MESSAGES[locale];
  const namespaces = [...CLIENT_NAMESPACES, ...extra] as const;
  return Object.fromEntries(namespaces.map((namespace) => [namespace, messages[namespace]]));
}
