import ProfileSidebar from "./_components/profile-sidebar";

export default function ProfilePage() {
  return (
    <div className="min-h-screen bg-slate-50 p-4 md:p-8">
      <div className="mx-auto max-w-3xl">
        <h1 className="mb-8 text-2xl font-bold text-slate-900">
          Quản lý tài khoản
        </h1>
        <ProfileSidebar />
      </div>
    </div>
  );
}
