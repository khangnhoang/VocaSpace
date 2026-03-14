import type { Metadata } from "next";
import { Plus_Jakarta_Sans } from "next/font/google";

const jakarta = Plus_Jakarta_Sans({ 
  subsets: ["latin", "vietnamese"],
  variable: "--font-jakarta",
});

export const metadata: Metadata = {
  title: "Xác thực | VocaSpace",
  description: "Đăng nhập hoặc tạo tài khoản mới",
};

export default function AuthLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <div className={`${jakarta.className} min-h-screen w-full flex items-center justify-center bg-slate-100 p-4`}>
      <div className="w-full max-w-400">
        {children}</div>
    </div>
  );
}
