// File: app/admin/user-management/_components/types.ts
export interface AppUser {
  id: string;
  name: string;
  email: string;
  avatar: string;
  role: "admin" | "teacher" | "student";
  joinDate: string;
  phone: string;
  username: string;
}

export const roleDisplayNames = {
  admin: "Quản trị viên",
  teacher: "Giáo viên",
  student: "Học viên",
};

// Định nghĩa cấu trúc dữ liệu thô móc từ bảng profiles dưới Database lên
export interface ProfileData {
  id: string;
  full_name: string | null;
  email: string;
  username: string | null;
  phone: string | null;
  avatar_url: string | null;
  role: "admin" | "teacher" | "student";
  created_at: string;
}