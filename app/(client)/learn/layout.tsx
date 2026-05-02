import { Metadata } from "next";
import { ReactNode } from "react";

/**
 * METADATA CONFIGURATION
 * Đảm bảo SEO và hiển thị tab trình duyệt chính xác cho khu vực học tập.
 */
export const metadata: Metadata = {
  title: {
    template: "%s | Vocaspace Learn",
    default: "Học tập và Rèn luyện | Vocaspace",
  },
  description:
    "Nền tảng học từ vựng TOEIC tối ưu với phương pháp Flashcard và Exercise thông minh.",
  robots: {
    index: false, // Thường các trang learn (dashboard) nên chặn index để bảo mật nội dung
    follow: false,
  },
};

interface LearnLayoutProps {
  children: ReactNode;
}

/**
 * ARCHITECTURAL THINKING:
 * Layout này bao bọc toàn bộ các route như /learn, /learn/[course-slug], [topic-slug].
 * Đây là nơi lý tưởng để đặt:
 * 1. Global Navigation cho học viên (Breadcrumbs, Progress tổng).
 * 2. Auth Guard cấp cao (đã có middleware nhưng check lại ở đây nếu cần data profile).
 * 3. Theme/Context Provider đặc thù cho việc học (vd: Sound effect settings).
 */
export default function LearnLayout({ children }: LearnLayoutProps) {
  // Self-Audit: Kiểm tra RLS/Performance
  // Tại layout này chúng ta hạn chế fetch dữ liệu nặng để tránh blocking render các trang con.

  return (
    <div className="relative min-h-screen bg-background flex flex-col">
      {/* 
        TOP NAVIGATION (BÀNH Ú'S STYLE: SẠCH SẼ - TINH GỌN) 
        Phần này sẽ luôn cố định khi user chuyển đổi giữa các khóa học/bài học.
      */}
      <header className="sticky top-0 z-50 w-full border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
        <div className="container flex h-16 items-center justify-between px-4 md:px-8">
          <div className="flex items-center gap-4">
            <span className="text-xl font-bold tracking-tight text-primary">
              VOCASPACE{" "}
              <span className="text-muted-foreground font-light text-sm">
                LEARN
              </span>
            </span>
          </div>

          <nav className="flex items-center gap-6">
            {/* Các shortcut nhanh có thể thêm ở đây */}
            <div className="hidden md:flex items-center gap-4 text-sm font-medium">
              <a
                href="/dashboard"
                className="hover:text-primary transition-colors"
              >
                Bảng điều khiển
              </a>
              <a
                href="/learn"
                className="text-primary border-b-2 border-primary"
              >
                Khóa học của tôi
              </a>
            </div>

            {/* User Profile / Avatar sẽ được inject vào đây */}
            <div className="w-8 h-8 rounded-full bg-secondary animate-pulse" />
          </nav>
        </div>
      </header>

      {/* 
        MAIN CONTENT AREA
        Sử dụng flex-1 để đảm bảo footer luôn ở dưới cùng nếu nội dung ngắn.
      */}
      <main className="flex-1 flex flex-col w-full overflow-hidden">
        {children}
      </main>

      {/* 
        OPTIONAL: Một mini-footer hoặc thanh trạng thái (Status Bar) 
        phù hợp cho ứng dụng dạng Web-app/LMS.
      */}
    </div>
  );
}
