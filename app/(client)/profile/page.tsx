import ProfileLayout from "./_components/profile-layout";

export default async function ProfilePage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { tab } = await searchParams;
  // `?tab=payments` mở tab "Thanh toán" dưới lg; từ lg trở lên lịch sử luôn hiện nên giá trị này bị bỏ qua ở client.
  const initialTab = tab === "payments" ? "payments" : "profile";

  return (
    <div className="min-h-screen bg-slate-50 p-4 md:p-8">
      <div className="mx-auto max-w-3xl lg:max-w-6xl">
        <h1 className="mb-8 text-2xl font-bold text-slate-900">
          Quản lý tài khoản
        </h1>
        <ProfileLayout initialTab={initialTab} />
      </div>
    </div>
  );
}
