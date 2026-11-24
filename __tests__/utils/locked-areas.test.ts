import { describe, expect, it } from "vitest";
import { isLockedAreaPath } from "@/lib/i18n/locked-areas";

// Test plan:
// - Mục tiêu: U9 AC8 - quy tắc đường dẫn của khóa tiếng Việt khu giáo viên và admin.
// - Loại test: hàm thuần.
// - Case: khóa /teacher, /teacher/..., /admin, /admin/... và đúng một route API; không khóa các tên giống (/teachers, /teacher-guide,
//   /administrator, /adminish), route media GET học viên dùng, hay đường dẫn thiếu.

describe("isLockedAreaPath", () => {
  it.each([
    "/teacher",
    "/teacher/",
    "/teacher/courses",
    "/teacher/courses/abc/edit",
    "/admin",
    "/admin/user-management",
    "/teacher/missing",
    "/admin/missing",
    "/api/question-group-media/upload",
  ])("locks %s", (pathname) => {
    expect(isLockedAreaPath(pathname)).toBe(true);
  });

  it.each([
    "/",
    "/courses",
    "/learn",
    "/teachers",
    "/teacher-guide",
    "/teacherish",
    "/administrator",
    "/adminish",
    "/admin-panel",
    "/profile/teacher",
    "/api/question-group-media/abc/image",
    "/api/question-group-media/upload/extra",
    "/api/question-group-media",
    "/Teacher",
    "",
    null,
    undefined,
  ])("does not lock %j", (pathname) => {
    expect(isLockedAreaPath(pathname)).toBe(false);
  });
});

// F1: matcher của proxy cũng khớp đường dẫn đã giải mã, nên dạng mã hóa của khu bị khóa tới proxy và render not-found gốc;
// not-found đó phải khóa tiếng Việt như dạng thường.
describe("isLockedAreaPath with percent-encoded segments", () => {
  it.each([
    "/%61dmin",
    "/%61dmin/missing",
    "/%61dmin/missing.png",
    "/%74eacher/courses",
    "/%74%65acher",
    "/admin/%",
    "/admin/%E0%A4%A",
    "/api/question-group-media/%75pload",
  ])("locks %s", (pathname) => {
    expect(isLockedAreaPath(pathname)).toBe(true);
  });

  it.each([
    "/%61dministrator",
    "/%74eachers",
    "/teacher-guide%2Fx",
    "/admin%2Fx",
    "/admin%2Fx.png",
    "/%E0%A4%A",
    "/%",
    "/api/question-group-media/abc/%69mage",
    "/api/question-group-media/%75pload/extra",
  ])("does not lock %s and does not throw", (pathname) => {
    expect(isLockedAreaPath(pathname)).toBe(false);
  });
});
