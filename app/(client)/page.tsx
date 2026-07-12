import Image from "next/image";
import Link from "next/link";
import { Suspense } from "react";
import { Button } from "@/components/ui/button";
import {
  Carousel,
  CarouselContent,
  CarouselItem,
  CarouselNext,
  CarouselPrevious,
} from "@/components/ui/carousel";
import {
  Activity,
  Sparkles,
  GraduationCap,
  Facebook,
  Instagram,
  Youtube,
} from "lucide-react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import PublicCourseHighlights from "./_components/PublicCourseHighlights";
import { PublicCourseGridSkeleton } from "./courses/_components/PublicCourseStates";

export default function Home() {
  return (
    <div className="w-full flex flex-col overflow-hidden">
      <div className="container mx-auto px-4 pt-8 md:pt-12">
        <Carousel opts={{ loop: true }} className="w-full relative">
          <CarouselContent>
            <CarouselItem>
              <section className="grid grid-cols-1 lg:grid lg:grid-cols-2 bg-white border border-gray-100 rounded-2xl items-center gap-6 p-4 shadow-sm hover:shadow-md transition-shadow overflow-hidden h-full">
                <div className="grid grid-cols-1 justify-center gap-4 p-2 md:p-6 order-2 lg:order-1 w-full">
                  <p className="text-xs font-bold tracking-wider text-slate-500 uppercase">
                    Hành Trình Không Bao Giờ Kết Thúc
                  </p>
                  <h1 className="text-2xl md:text-3xl font-extrabold text-gray-900 leading-tight">
                    Làm chủ TOEIC/IELTS với phương pháp Spaced Repetition
                  </h1>
                  <p className="text-gray-600 text-sm">
                    Kích thích não bộ ghi nhớ sâu từ vựng trọng tâm. Tối ưu thời
                    gian ôn luyện để đạt mục tiêu trong thời gian ngắn nhất.
                  </p>
                  <Button className="bg-[#5FE8EF] hover:bg-[#42d2da] text-white font-bold text-sm h-12 px-8 rounded-md mt-2 transition-colors w-full lg:w-1/2 cursor-pointer">
                    Bắt đầu học ngay
                  </Button>
                </div>

                <div className="w-full h-full order-1 relative aspect-video md:min-h-75">
                  <Image
                    src="https://images.microcms-assets.io/assets/9cdac7ef8232473589442464f6671b47/f24d5fca20e749debe66faf64b607a46/03-001.jpg"
                    alt="Luyện thi TOEIC"
                    fill
                    priority
                    sizes="(max-width: 768px) 100vw, (max-width: 1200px) 50vw, 33vw"
                    className="rounded-2xl object-contain md:object-cover lg:object-cover"
                  />
                </div>
              </section>
            </CarouselItem>
            <CarouselItem>
              <section className="grid grid-cols-1 lg:grid lg:grid-cols-2 bg-white border border-gray-100 lg:rounded-2xl items-center gap-6 p-4 shadow-sm hover:shadow-md transition-shadow overflow-hidden h-full">
                <div className="grid grid-cols-1 justify-center gap-4 p-2 md:p-6 order-2 lg:order-1 w-full">
                  <p className="text-xs font-bold tracking-wider text-blue-500 uppercase">
                    Bức phá TOEIC 800+
                  </p>
                  <h2 className="text-2xl md:text-3xl font-extrabold text-gray-900 leading-tight">
                    Phá Vỡ Bức Tường Khoảng Cách Cùng Chúng Tôi
                  </h2>
                  <p className="text-gray-600 text-sm">
                    Các phương pháp giảng dạy chuẩn quốc tế mà bạn chỉ có thể
                    biết từ VocaSpace.
                  </p>
                  <Button className="bg-[#5FE8EF] hover:bg-[#42d2da] text-white font-bold text-sm h-12 px-8 rounded-md mt-2 transition-colors w-full lg:w-1/2 cursor-pointer">
                    Khám phá lộ trình
                  </Button>
                </div>
                <div className="w-full h-full order-1 relative aspect-video md:min-h-75 overflow-hidden rounded-2xl">
                  <Image
                    src="https://edusa.vn/wp-content/uploads/2023/04/toeic-khoa-1-vuot-chuogn-ngai-vat.webp"
                    alt="Toeic"
                    fill
                    sizes="(max-width: 768px) 100vw, (max-width: 1200px) 50vw, 33vw" // <--- THÊM DÒNG NÀY
                    className="object-contain rounded-2xl md:object-cover lg:object-cover"
                  />
                </div>
              </section>
            </CarouselItem>
          </CarouselContent>
          <CarouselPrevious className="hidden md:flex -left-4 lg:-left-12 border-gray-200" />
          <CarouselNext className="hidden md:flex -right-4 lg:-right-12 border-gray-200" />
        </Carousel>
      </div>

      <Suspense
        fallback={
          <section className="container mx-auto px-4 py-10 lg:py-14">
            <PublicCourseGridSkeleton
              count={4}
              label="Đang tải khóa học nổi bật"
            />
          </section>
        }
      >
        <PublicCourseHighlights />
      </Suspense>
      <div className="w-full flex items-center justify-center">
        <div className="border border-gray-100 lg:mt-2 mb-4 w-2/3 lg:w-full"></div>
      </div>
      <div>
        <h2 className="text-2xl font-bold text-center">
          Tại sao chọn VocaSpace?
        </h2>
        <div className="container mx-auto grid grid-cols-1 md:grid-cols-3 gap-8 p-4 lg:py-12">
          <div className="flex flex-col items-center text-center p-6 bg-white rounded-2xl border border-gray-100 hover:border-blue-100 hover:shadow-lg transition-all duration-300 group">
            <div className="p-4 bg-blue-50 text-blue-600 rounded-full mb-4 group-hover:-translate-y-1 transition-transform">
              <Activity size={32} />
            </div>
            <h3 className="text-lg font-bold text-gray-900 mb-2">
              Spaced Repetition
            </h3>
            <p className="text-gray-600 text-sm leading-relaxed">
              Ghi nhớ từ vựng vĩnh viễn với thuật toán lặp lại ngắt quãng thông
              minh, tối ưu hóa thời gian ôn tập.
            </p>
          </div>

          <div className="flex flex-col items-center text-center p-6 bg-white rounded-2xl border border-gray-100 hover:border-[#5FE8EF]/30 hover:shadow-lg transition-all duration-300 group">
            <div className="p-4 bg-[#5FE8EF]/10 text-[#2db2b9] rounded-full mb-4 group-hover:-translate-y-1 transition-transform">
              <Sparkles size={32} />
            </div>
            <h3 className="text-lg font-bold text-gray-900 mb-2">
              AI Assistant
            </h3>
            <p className="text-gray-600 text-sm leading-relaxed">
              Hỗ trợ giải đáp thắc mắc 24/7.
            </p>
          </div>

          <div className="flex flex-col items-center text-center p-6 bg-white rounded-2xl border border-gray-100 hover:border-orange-100 hover:shadow-lg transition-all duration-300 group">
            <div className="p-4 bg-orange-50 text-orange-500 rounded-full mb-4 group-hover:-translate-y-1 transition-transform">
              <GraduationCap size={32} />
            </div>
            <h3 className="text-lg font-bold text-gray-900 mb-2">
              Interactive Exercises
            </h3>
            <p className="text-gray-600 text-sm leading-relaxed">
              Bài tập trắc nghiệm và Video tương tác sinh động.
            </p>
          </div>
        </div>
      </div>
      <div className="w-full flex justify-center">
        <div className="border border-gray-100 lg:mt-2 mb-4 w-2/3 lg:w-full"></div>
      </div>
      <div className="container mx-auto p-4 flex flex-col my-8">
        <h2 className="text-2xl md:text-2xl font-extrabold text-gray-900 mb-6">
          Học viên nói gì về VocaSpace?
        </h2>

        {/* CARD ĐÁNH GIÁ ĐÃ ĐƯỢC NÂNG CẤP */}
        <div className="flex flex-col p-6 gap-4 bg-white border border-gray-100 rounded-2xl w-full md:w-1/2 shadow-sm hover:shadow-xl hover:-translate-y-2 transition-all duration-300 cursor-default">
          {/* 1. Phần Header Card: Avatar + Tên + Đánh giá Sao xếp ngang */}
          <div className="flex items-center gap-4">
            {/* Vòng sáng nhẹ quanh Avatar */}
            <Avatar className="h-14 w-14 border-2 border-blue-50 ring-2 ring-[#5FE8EF]/20">
              <AvatarImage src="https://github.com/shadcn.png" />
              <AvatarFallback>CV</AvatarFallback>
            </Avatar>

            <div className="flex flex-col">
              <p className="font-bold text-gray-900 text-lg">Cao Thế Vinh</p>
              {/* Thêm dòng sao đánh giá cho uy tín */}
              <div className="flex text-yellow-400 text-sm mt-0.5">★★★★★</div>
            </div>
          </div>

          {/* 2. Phần Nội dung: Nằm trọn vẹn ở dưới, in nghiêng, màu xám */}
          <div>
            <p className="text-gray-600 italic leading-relaxed text-sm md:text-base relative">
              <span className="text-3xl text-gray-200 absolute -top-2 -left-2 font-serif"></span>
              &nbsp;&nbsp;&nbsp;Khóa học tinh gọn học rất được. Hệ thống Spaced
              Repetition hoạt động cực kỳ mượt mà, giúp mình tiết kiệm được cả
              đống thời gian học từ vựng.
            </p>
          </div>
        </div>
      </div>
      <div>
        <div className="w-full flex items-center justify-center">
          <div className="border border-gray-100 lg:mt-2 mb-4 w-2/3 lg:w-full"></div>
        </div>
        <footer className="bg-[#1D1F22] text-white py-12">
          {/* Khu vực nội dung chính: Tự động dàn ngang (flex-row) trên màn hình vừa và lớn (md) */}
          <div className="container mx-auto px-4 flex flex-col gap-10 md:flex-row md:justify-between md:items-start">
            {/* Cột 1: Logo & Slogan */}
            <div className="flex flex-col gap-4 items-center md:items-start text-center md:text-left md:w-1/3">
              <h2 className="text-3xl font-extrabold tracking-tight bg-linear-to-r from-[#5FE8EF] to-blue-500 bg-clip-text text-transparent cursor-pointer hover:scale-105 transition-transform duration-300">
                VocaSpace
              </h2>
              <p className="text-gray-400 text-sm max-w-xs leading-relaxed">
                Hành trình không bao giờ kết thúc. Nền tảng học tập thông minh
                giúp bạn làm chủ ngôn ngữ và công nghệ.
              </p>

              {/* Icon Mạng xã hội: Có hiệu ứng hover sáng đèn và nảy lên */}
              <div className="flex gap-4 mt-2">
                <Link
                  href="https://facebook.com"
                  target="_blank"
                  className="p-2 bg-white/5 rounded-full text-gray-400 hover:bg-blue-600 hover:text-white hover:-translate-y-1 transition-all duration-300 shadow-lg"
                >
                  <Facebook size={20} />
                </Link>
                <Link
                  href="https://instagram.com"
                  target="_blank"
                  className="p-2 bg-white/5 rounded-full text-gray-400 hover:bg-pink-600 hover:text-white hover:-translate-y-1 transition-all duration-300 shadow-lg"
                >
                  <Instagram size={20} />
                </Link>
                <Link
                  href="https://www.youtube.com"
                  target="_blank"
                  className="p-2 bg-white/5 rounded-full text-gray-400 hover:bg-red-600 hover:text-white hover:-translate-y-1 transition-all duration-300 shadow-lg"
                >
                  <Youtube size={20} />
                </Link>
              </div>
            </div>

            {/* Cột 2: Điều hướng (Sử dụng hiệu ứng trượt ngang khi hover) */}
            <div className="flex flex-col gap-3 items-center md:items-start">
              <h3 className="font-semibold text-lg text-gray-200 mb-2">
                Điều hướng
              </h3>
              <Link
                href="#"
                className="text-gray-400 hover:text-[#5FE8EF] hover:translate-x-2 transition-all duration-300"
              >
                Home
              </Link>
              <Link
                href="#"
                className="text-gray-400 hover:text-[#5FE8EF] hover:translate-x-2 transition-all duration-300"
              >
                Product
              </Link>
              <Link
                href="#"
                className="text-gray-400 hover:text-[#5FE8EF] hover:translate-x-2 transition-all duration-300"
              >
                Contact Us
              </Link>
            </div>

            {/* Cột 3: Pháp lý */}
            <div className="flex flex-col gap-3 items-center md:items-start">
              <h3 className="font-semibold text-lg text-gray-200 mb-2">
                Pháp lý
              </h3>
              <Link
                href="#"
                className="text-gray-400 hover:text-[#5FE8EF] hover:translate-x-2 transition-all duration-300"
              >
                Privacy Policy
              </Link>
              <Link
                href="#"
                className="text-gray-400 hover:text-[#5FE8EF] hover:translate-x-2 transition-all duration-300"
              >
                Terms of Use
              </Link>
            </div>
          </div>

          {/* Đường kẻ phân cách (Dùng border-t thay cho div trắng tốn diện tích) */}
          <div className="container mx-auto px-4 mt-12 pt-8 border-t border-gray-700/50">
            <p className="text-center text-sm text-gray-500">
              Copyright © 2026 VocaSpace. All rights reserved.
            </p>
          </div>
        </footer>
      </div>
    </div>
  );
}
