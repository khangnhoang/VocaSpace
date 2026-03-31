import Header from "@/components/ui/header";

export default function ClientLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <div className="flex flex-col min-h-screen bg-gray-50">
      {/* Header chỉ hiển thị cho các trang nằm trong group (client) */}
      <Header />
      
      {/* Chứa nội dung của trang chủ, courses, login, register... */}
      <main className="flex-1">
        {children}
      </main>
    </div>
  );
}