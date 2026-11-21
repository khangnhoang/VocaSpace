// Nguồn duy nhất cho phần điều hướng tài khoản phụ thuộc quyền: Header (desktop) và MobileAccountSheet cùng dùng
// kết quả này, tránh hai menu lệch nhau về link khóa học, nhãn và link quản trị (F1 G3).
// English localization U1: nhãn là khóa dịch trong namespace `common`; Header dịch một lần rồi truyền nhãn đã dịch cho
// cả hai menu.
export const COURSE_WORKSPACE_LABEL = "account.courseWorkspace";
export const COURSE_INVITATION_LABEL = "account.courseInvitation";

export type AccountMenuInput = {
  role?: string | null;
  hasMembership: boolean;
  hasPendingInvitation: boolean;
};

export type AccountMenuState = {
  isAdmin: boolean;
  /** Khóa dịch nhãn link không gian khóa học; `null` nghĩa là ẩn link. */
  courseWorkspaceLabel: typeof COURSE_WORKSPACE_LABEL | typeof COURSE_INVITATION_LABEL | null;
};

export function getAccountMenuState({
  role,
  hasMembership,
  hasPendingInvitation,
}: AccountMenuInput): AccountMenuState {
  const isTeacher = role === "teacher";
  const showCourseWorkspace = isTeacher || hasMembership || hasPendingInvitation;
  // Chỉ có lời mời mà chưa phải teacher/thành viên thì nhãn nói đúng việc người dùng làm được: xem lời mời.
  const invitationOnly = hasPendingInvitation && !hasMembership && !isTeacher;

  return {
    isAdmin: role === "admin",
    courseWorkspaceLabel: showCourseWorkspace
      ? invitationOnly
        ? COURSE_INVITATION_LABEL
        : COURSE_WORKSPACE_LABEL
      : null,
  };
}
