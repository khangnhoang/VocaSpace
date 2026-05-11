import ProfileSidebar from "./_components/profile-sidebar";
import CoursesPlaceholder from "./_components/courses-placeholder";

export default function ProfilePage() {
  return (
    <div className="min-h-screen bg-slate-50 p-4 md:p-8">
      <div className="mx-auto max-w-7xl">
        <h1 className="mb-8 text-2xl font-bold text-slate-900">
          Quản lý tài khoản
        </h1>

        {/* Layout Grid: 1 cột trên Mobile, 3 cột trên Desktop */}
        <div className="grid grid-cols-1 gap-6 md:grid-cols-3">
          {/* Cột trái (1/3) */}
          <div className="md:col-span-1">
            <ProfileSidebar />
          </div>

          {/* Cột phải (2/3) */}
          <div className="md:col-span-2">
            <CoursesPlaceholder />
          </div>
        </div>
      </div>
    </div>
  );
}
