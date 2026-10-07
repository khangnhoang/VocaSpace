// Nguồn duy nhất cho phần điều hướng tài khoản phụ thuộc quyền: Header (desktop) và MobileAccountSheet cùng dùng
// kết quả này, tránh hai menu lệch nhau về link khóa học, nhãn và link quản trị (F1 G3).
export const COURSE_WORKSPACE_LABEL = "Khóa học của tôi";
export const COURSE_INVITATION_LABEL = "Lời mời cộng tác";

export type AccountMenuInput = {
  role?: string | null;
  hasMembership: boolean;
  hasPendingInvitation: boolean;
};

export type AccountMenuState = {
  isAdmin: boolean;
  /** Nhãn link không gian khóa học; `null` nghĩa là ẩn link. */
  courseWorkspaceLabel: string | null;
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
