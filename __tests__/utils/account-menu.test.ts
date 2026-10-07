import { describe, expect, it } from "vitest";
import {
  COURSE_INVITATION_LABEL,
  COURSE_WORKSPACE_LABEL,
  getAccountMenuState,
} from "@/lib/account-menu";

// Test plan:
// - Mục tiêu: helper thuần quyết định link quản trị, link khóa học và nhãn cho cả hai menu tài khoản (F1 G3).
// - Loại test: unit.
// - Đối tượng: getAccountMenuState.
// - Case thành công: student, teacher, member-only, invitation-only, admin; nhãn "Lời mời cộng tác" chỉ khi có lời mời mà chưa là teacher/thành viên.
// - Case thất bại: role thiếu/null/không biết không mở thêm link.
// - Bảo mật/phân quyền: link admin chỉ khi role đúng 'admin'; admin không tự có link khóa học.
// - Invariant cần giữ: điều kiện hiện link khóa học = teacher | thành viên | lời mời đang chờ, giống menu desktop trước F1.
// - Kết quả verify gần nhất: xem milestone F1 CP2 trong progress.md (`npx vitest run __tests__/utils/account-menu.test.ts`).

describe("getAccountMenuState", () => {
  it.each([
    ["student", { role: "student", hasMembership: false, hasPendingInvitation: false }, false, null],
    ["teacher", { role: "teacher", hasMembership: false, hasPendingInvitation: false }, false, COURSE_WORKSPACE_LABEL],
    ["member-only student", { role: "student", hasMembership: true, hasPendingInvitation: false }, false, COURSE_WORKSPACE_LABEL],
    ["invitation-only student", { role: "student", hasMembership: false, hasPendingInvitation: true }, false, COURSE_INVITATION_LABEL],
    ["member with a pending invitation", { role: "student", hasMembership: true, hasPendingInvitation: true }, false, COURSE_WORKSPACE_LABEL],
    ["teacher with a pending invitation", { role: "teacher", hasMembership: false, hasPendingInvitation: true }, false, COURSE_WORKSPACE_LABEL],
    ["admin with no workspace", { role: "admin", hasMembership: false, hasPendingInvitation: false }, true, null],
    ["admin who is also a member", { role: "admin", hasMembership: true, hasPendingInvitation: false }, true, COURSE_WORKSPACE_LABEL],
    ["user with no profile role", { role: null, hasMembership: false, hasPendingInvitation: false }, false, null],
    ["user with an unknown role", { role: "owner", hasMembership: false, hasPendingInvitation: false }, false, null],
  ])("returns the admin flag and course link for a %s", (_name, input, isAdmin, courseWorkspaceLabel) => {
    expect(getAccountMenuState(input)).toEqual({ isAdmin, courseWorkspaceLabel });
  });
});
